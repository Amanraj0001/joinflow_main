# Running JoinFlow Locally

JoinFlow is an AI-powered employee onboarding orchestrator. The project has three parts:

| Folder | What it is |
|--------|-----------|
| `frontend/` | React + Vite UI (all pages and components) |
| `backend/` | Node.js + Express API (all business logic, auth, routes) |
| `ml-services/` | Python FastAPI RAG service (AI retrieval and embeddings) |

All three start automatically with a single `npm run dev` command.

---

## Prerequisites

| Tool | Minimum version | Check |
|------|----------------|-------|
| Node.js | 22.x or newer | `node --version` |
| npm | 10.x or newer | `npm --version` |
| Python | 3.11 or newer | `python --version` |

---

## First-Time Setup

> **Do this once** after cloning the repo. Skip to [Start the App](#start-the-app) on subsequent runs.

### Step 1 — Install Node dependencies

```powershell
cd path\to\joinflow-main
npm ci
```

### Step 2 — Create the Python virtual environment for the RAG service

```powershell
python -m venv .local/rag-env
.local\rag-env\Scripts\python.exe -m pip install -r ml-services/requirements.txt
```

> On macOS/Linux replace `Scripts\python.exe` with `bin/python`.

### Step 3 — Create your local environment file

```powershell
Copy-Item .env.example .env
```

Then open `.env` and fill in `JWT_SECRET` with any long random string (minimum 32 characters):

```env
JWT_SECRET=replace-with-a-long-random-string-at-least-32-chars
```

> Generate one quickly: `node -e "const {randomBytes}=require('crypto');console.log(randomBytes(48).toString('hex'))"`

The rest of the defaults in `.env.example` work as-is for local development.

### Step 4 — Generate the Prisma client

```powershell
npm run build
```

This runs `prisma generate` and builds the frontend into `dist/`. Only needed once after a fresh clone or after changing `prisma/schema.prisma`.

---

## Start the App

You need **two terminals** — one for the database, one for everything else.

### Terminal 1 — Start PostgreSQL

```powershell
cd path\to\joinflow-main
npm run db:local
```

Wait for the message: **`Local PostgreSQL ready on 127.0.0.1:55439`**  
Leave this terminal open.

### Terminal 2 — Migrate, Seed, and Start Dev Server

```powershell
cd path\to\joinflow-main
npm run db:migrate
npm run db:seed
npm run dev
```

| What starts | URL |
|-------------|-----|
| Frontend (Vite) | http://localhost:5173 |
| Backend (Express API) | http://localhost:3001 |
| ML Services (RAG / FastAPI) | http://localhost:8010 |

> `db:migrate` and `db:seed` are safe to run again — they preserve existing data.

---

## Sign In

Open **http://localhost:5173** in your browser. All demo accounts use the password `WelcomeDemo123!`.

| Role | Email | What you can do |
|------|-------|-----------------|
| Employee | `alex@joinflow.example` | View tasks, upload documents, use AI Assistant |
| Manager | `sam@joinflow.example` | Approve decisions, manage team, publish policies |
| HR | `ellis@joinflow.example` | Add employees, review onboarding plans, monitor tasks |

Other demo employees: `maya@joinflow.example` (Operations · Austin) and `noah@joinflow.example` (Engineering · Austin).

---

## Project Structure

```
joinflow-main/
├── frontend/               ← React + Vite (all UI)
│   └── src/
│       ├── auth/           ← Login, access pages
│       ├── employee/       ← Employee portal pages
│       ├── shared/         ← Shared components (Forms, Tickets, API client)
│       └── staff/          ← HR & Manager portal pages
│
├── backend/                ← Node.js + Express (all API logic)
│   └── src/
│       ├── auth/           ← Session, accounts, JWT
│       ├── employee/       ← Document reviews, issues, messages
│       ├── knowledge/      ← AI assistant, policy routes, RAG retrieval
│       ├── onboarding/     ← Workflow engine, task catalog, AI plans
│       └── workspace/      ← Team overview routes
│
├── ml-services/            ← Python FastAPI (RAG / AI)
│   ├── main.py             ← /index, /retrieve, /document-review endpoints
│   └── requirements.txt
│
├── prisma/                 ← Database schema & migrations
│   ├── schema.prisma
│   ├── seed.js             ← Demo data
│   └── migrations/
│
├── scripts/                ← Dev helpers
│   ├── serve.js            ← Starts all three services together
│   ├── local-db.js         ← Embedded PostgreSQL for dev
│   └── test-runner.js
│
├── tests/                  ← Automated tests
│   ├── workflows.test.js
│   ├── portals.test.js
│   ├── browser/            ← Playwright end-to-end tests
│   └── rag/                ← Python RAG unit tests
│
├── .env.example            ← Copy to .env and fill in JWT_SECRET
├── vite.config.js          ← Vite config (points to frontend/)
├── tailwind.config.js      ← Tailwind config (scans frontend/src/)
└── package.json
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (default works for local dev) |
| `JWT_SECRET` | **Yes** | Random string ≥ 32 chars. App won't start without it. |
| `DEMO_PASSWORD` | Yes | Password used for all seeded accounts |
| `GROQ_API_KEY` | No | Enables LLM-powered AI checklist generation and richer answers |
| `GROQ_MODEL` | No | Groq model name (default: `openai/gpt-oss-20b`) |
| `APP_ORIGIN` | No | Browser origin for CSRF check (default: `http://localhost:5173`) |
| `PORT` | No | Backend port (default: `3001`) |
| `SMTP_URL` | No | Email delivery (e.g. `smtps://user:pass@smtp.example.com`) |
| `MAIL_FROM` | No | From address for outgoing emails |
| `RAG_SECRET` | No | Shared secret between backend and ml-services |
| `EMBEDDINGS_URL` | No | External embeddings API (falls back to local token vectors) |

---

## Optional: Enable AI Checklist Generation

Set your Groq API key in `.env`:

```env
GROQ_API_KEY=gsk_your_key_here
```

Restart `npm run dev`. The HR "New hire" flow will now use the LLM to generate personalized onboarding task suggestions grounded in your company policies.

---

## Optional: Enable Email Delivery

By default, emails are saved as JSON files in `.local/mail/` (not sent). To enable real delivery:

```env
SMTP_URL=smtps://user:password@smtp.yourprovider.com
MAIL_FROM=JoinFlow <onboarding@yourcompany.com>
```

---

## Stop the App

1. Press **Ctrl+C** in Terminal 2 (stops the app)
2. Press **Ctrl+C** in Terminal 1 (stops PostgreSQL)

Your local database is preserved for the next run.

---

## Run Automated Tests

With PostgreSQL running (Terminal 1 open), open a third terminal:

```powershell
# API and integration tests
npm run build
npm test

# End-to-end browser tests (requires Chrome)
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e

# RAG / Python unit tests
.local\rag-env\Scripts\python.exe -m unittest discover -s tests/rag
```

Tests use a separate `joinflow_test` schema and do not affect your demo data.

---

## Common Issues

| Problem | Fix |
|---------|-----|
| `JWT_SECRET` error on startup | Add a 32+ character secret to `.env` |
| `@prisma/client did not initialize` | Run `npm run build` to regenerate the Prisma client |
| `EADDRINUSE` on port 3001 or 5173 | Another process is using that port — stop it or change `PORT` / `APP_ORIGIN` in `.env` |
| RAG service not starting | Ensure Python venv is created: `python -m venv .local/rag-env` then install requirements |
| `Local PostgreSQL ready` never appears | Delete `.local/postgres` and retry `npm run db:local` |
| Emails not arriving | Check `.local/mail/*.json` for the link in dev mode (no SMTP needed) |
