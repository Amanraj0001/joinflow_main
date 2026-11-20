FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY ml-services/requirements.txt /tmp/rag-requirements.txt
RUN python3 -m venv /opt/rag && /opt/rag/bin/pip install --no-cache-dir -r /tmp/rag-requirements.txt
ENV RAG_PYTHON=/opt/rag/bin/python
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --include=dev
COPY . .
RUN npm run build && npm prune --omit=dev
ENV NODE_ENV=production
CMD ["sh","-c","npm run db:migrate && npm run db:seed && exec node scripts/serve.js"]

