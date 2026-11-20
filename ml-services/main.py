"""Internal LangChain indexing and retrieval. Express selects the authorized corpus."""
import base64
import hashlib
import io
import math
import os
import re
import secrets
from collections import Counter
from urllib.request import Request, urlopen
import json

from fastapi import FastAPI, Depends, Header, HTTPException
from langchain_core.embeddings import Embeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pydantic import BaseModel, Field
from pypdf import PdfReader

STOP = set("a an the i my am me we you your is are be can could should how when what where which who would of to for in with it do does at and or from on by about after before company policy onboarding have has get much begin".split())

class PolicyEmbeddings(Embeddings):
    """Use configured model embeddings or normalized local token vectors."""
    def embed_documents(self, texts):
        if os.getenv("EMBEDDINGS_URL"):
            req = Request(os.environ["EMBEDDINGS_URL"], data=json.dumps({"input": texts, "model": os.environ["EMBEDDINGS_MODEL"]}).encode(), headers={"Content-Type": "application/json", "Authorization": "Bearer " + os.getenv("EMBEDDINGS_KEY", "")})
            with urlopen(req, timeout=20) as response:
                return [r["embedding"] for r in sorted(json.load(response)["data"], key=lambda r: r["index"])]
        result = []
        for text in texts:
            v = [0.0] * 512
            for token, count in Counter(re.findall(r"[a-z0-9]+", text.lower())).items():
                if token in STOP: continue
                stem = token.rstrip("s") if len(token) > 4 else token
                idx = int.from_bytes(hashlib.blake2s(stem.encode(), digest_size=4).digest(), "big") % len(v)
                v[idx] += 1 + math.log(count)
            result.append(v)
        return result

    def embed_query(self, text):
        return self.embed_documents([text])[0]

encoder = PolicyEmbeddings()
splitter = RecursiveCharacterTextSplitter(chunk_size=850, chunk_overlap=100)
def authorize(x_service_key: str = Header(default="")):
    key = os.environ.get("RAG_SECRET") or "local-joinflow"
    if not key or not secrets.compare_digest(x_service_key, key):
        raise HTTPException(403, "Unauthorized")

app = FastAPI(dependencies=[Depends(authorize)], docs_url=None, redoc_url=None)
class Source(BaseModel):
    title: str
    text: str = Field(default="", max_length=150000)
    pdf: str | None = Field(default=None, max_length=7200000)

class Corpus(BaseModel):
    question: str
    documents: list[dict]
    purpose: str = "answer"

def chunks(title, text):
    parts = splitter.split_text(text)
    vectors = encoder.embed_documents([title + " " + part for part in parts])
    return [{"body": part, "vector": vector} for part, vector in zip(parts, vectors, strict=True)]

@app.post("/index")
def index(source: Source):
    text = source.text
    if source.pdf:
        try:
            reader = PdfReader(io.BytesIO(base64.b64decode(source.pdf, validate=True)))
            if reader.is_encrypted or len(reader.pages) > 150:
                raise ValueError()
            text += "\n" + "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as exc:
            raise HTTPException(422, "Upload a readable, unencrypted PDF of up to 150 pages.") from exc
    text = text.strip()
    if not text or len(text) > 150000:
        raise HTTPException(422, "Policy must contain 1 to 150,000 characters of readable text.")
    return {"text": text, "chunks": chunks(source.title, text)}

@app.post("/retrieve")
def retrieve(query: Corpus):
    vector = encoder.embed_query(query.question)
    norm = math.sqrt(sum(x*x for x in vector)) or 1
    ranked = []
    for doc in query.documents:
        best = None
        for part in doc.get("chunks") or chunks(doc["title"], doc["body"]):
            v = part["vector"]
            if len(v) != len(vector): continue
            score = sum(a*b for a,b in zip(vector,v)) / (norm * (math.sqrt(sum(x*x for x in v)) or 1))
            if query.purpose == "planning" and (doc.get("job") or doc.get("department")):
                score += 0.5
            if score >= float(os.getenv("RAG_MIN_SCORE", "0.14")) and (best is None or score > best["score"]):
                best = {"id": doc["id"], "title": doc["title"], "body": part["body"], "version": doc["version"], "score": score}
        if best: ranked.append(best)
    return sorted(ranked, key=lambda item: -item["score"])[:4]


@app.get("/health")
def health():
    return {"ok": True}

class ReviewInput(BaseModel):
    pdf: str = Field(max_length=7000000)
    kind: str
    employee_name: str

@app.post("/document-review")
def review_document(source: ReviewInput):
    """Extract observations locally. Employee documents never enter the policy index."""
    try:
        reader = PdfReader(io.BytesIO(base64.b64decode(source.pdf, validate=True)))
        if reader.is_encrypted or len(reader.pages) > 150:
            raise ValueError("Manual inspection required")
        text = "\n".join((p.extract_text() or "")[:12000] for p in reader.pages[:12])
    except Exception as exc:
        raise HTTPException(422, "Unable to extract the PDF. Manual inspection required.") from exc
    normalized = " ".join(text.casefold().split())
    labels = {"Identity document": ["passport", "identity", "driver license", "identity card"],
              "Signed offer": ["offer letter", "offer of employment", "employment offer"]}
    detected = next((kind for kind, terms in labels.items() if any(t in normalized for t in terms)), None)
    observations = []
    if not text.strip():
        observations.append("No selectable text found. Inspect the scanned pages manually.")
    if " ".join(source.employee_name.casefold().split()) not in normalized:
        observations.append("The employee's registered name was not located in the extracted text.")
    if not detected:
        observations.append("Document type could not be identified from the text.")
    elif detected != source.kind:
        observations.append("Detected type differs from the selected submission category.")
    if source.kind == "Signed offer":
        observations.append("Inspect the signature and date in the original PDF.")
    return {"type": detected, "excerpt": text.strip()[:1200], "observations": observations}
