# JoinFlow

JoinFlow is an employee onboarding workspace for new hires, managers, and HR. Each hire gets a checklist with owners, deadlines, dependencies, and approvals. An employee can see what to do next, who can unblock a task, and which company policy applies. HR and managers use the same records to review documents, approve decisions, and track readiness.

**[View the JoinFlow project presentation on Google Slides](https://docs.google.com/presentation/d/1MzQwoaOgfQMv9HrMNrn8AqepRB4RTok0/edit?usp=sharing&ouid=105437218501541081167&rtpof=true&sd=true)**

## Run locally

Use Git, **Node.js 24** (the version pinned in `.nvmrc`), npm, and **Python 3.12**. The local database helper starts PostgreSQL for you. The default demo works without a Groq account or an email provider.

### 1. Clone and install

```sh
git clone https://github.com/Amanraj0001/joinflow_main.git
cd joinflow_main
npm ci
```

From the repository root, install the Python service and copy the environment template. Choose the block for your shell.

**Windows PowerShell**

```powershell
python -m venv .local/rag-env
& .\.local\rag-env\Scripts\python.exe -m pip install -r ml-services/requirements.txt
Copy-Item .env.example .env
```

**macOS or Linux**

```sh
python3 -m venv .local/rag-env
.local/rag-env/bin/python -m pip install -r ml-services/requirements.txt
cp .env.example .env
```

Generate a session signing secret with the command below and paste its output after `JWT_SECRET=` in your local `.env`. Keep the template's database URL and browser origin for this walkthrough.

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

### 2. Start PostgreSQL in terminal 1

```sh
npm run db:local
```

Wait until PostgreSQL reports ready on `127.0.0.1:55439`. Leave this terminal running. To use your own PostgreSQL instance, set `DATABASE_URL` in `.env` to its connection string and proceed to terminal 2.

### 3. Build and start JoinFlow in terminal 2

Open a second terminal **in the same repository root**.

```sh
npm run build
npm run db:migrate
npm run db:seed
npm run dev
```

Open **[JoinFlow on localhost:5173](http://localhost:5173)**. The build generates Prisma Client and bundles the frontend. The migration and seed commands create the database tables and demo records. The dev command starts the React frontend, Express API, and Python retrieval service together.

For later sessions, run `npm run db:local` in one terminal and `npm run dev` in the other. Stop both with Ctrl+C. Local database files persist under `.local/`.

## Try the onboarding flow

With the supplied template, the initial demo password is `WelcomeDemo123!`. If you changed `DEMO_PASSWORD` before the first seed, use that value instead.

| Sign in as | Demo email | What to try |
| --- | --- | --- |
| Employee | `alex@joinflow.example` | Open My Tasks and inspect the workstation task waiting on laptop approval. |
| Manager | `sam@joinflow.example` | Review Alex's pending laptop decision and approve it. |
| Employee | `alex@joinflow.example` | Reopen the checklist and see how the approval changes the workstation task. |
| HR | `ellis@joinflow.example` | Inspect a hire's progress, review submitted documents, or create a hire and review their onboarding plan. |

Two more seeded employees, `maya@joinflow.example` and `noah@joinflow.example`, let you compare checklists across departments and offices. The demo uses fictional people and policies.

## What the portals do

- **Employee portal.** Employees work through assigned tasks, upload evidence, check equipment and access status, and contact HR. The assistant answers questions using the employee's checklist and relevant policies. A question that lacks supporting evidence can be forwarded to HR.
- **Manager portal.** Managers review decisions for their reports, manage role-specific steps, and publish policies scoped to the relevant employees. A decision can unblock a dependent task immediately.
- **HR portal.** HR creates hires, reviews suggested onboarding steps before approving a plan, monitors overdue or blocked work, reviews documents, and handles support requests. HR can preview how an office change affects a hire's checklist.

## How the services fit together

| Component | Location | Responsibility |
| --- | --- | --- |
| React, Vite, and Tailwind CSS | `frontend/src/` | Authentication screens, employee and staff portals, and shared UI. Vite serves the dev UI on port 5173 and proxies API requests to Express. |
| Express API | `backend/src/` | Cookie-based sessions, role checks, onboarding rules, document handling, messaging, policy access, and assistant responses. Default port 3001. |
| FastAPI retrieval service | `ml-services/` | Extracts policy text, indexes chunks, retrieves relevant passages, and supports document review. The local launcher binds it to loopback port 8010. |
| PostgreSQL and Prisma | `prisma/` | Stores profiles, tasks, approvals, documents, and policies. Includes the schema, migrations, and demo seed. |
| Development and verification | `scripts/`, `tests/` | Launches the stack and local database and runs API, retrieval, and browser checks. |

When an employee asks a policy question, Express determines which policies they can access. The retrieval service finds relevant passages, and the assistant can combine those passages with live checklist facts. The default retrieval mode runs locally. Optional external embeddings and Groq inference use the settings below.

## Configuration

| Setting in `.env` | When to change it |
| --- | --- |
| `DATABASE_URL`, `TEST_DATABASE_URL` | Point the app and test runner at their respective PostgreSQL databases when using your own server. Use a dedicated database for tests. |
| `JWT_SECRET`, `DEMO_PASSWORD` | Set the session signing secret and initial seeded account password. Reseeding preserves existing account passwords. |
| `APP_ORIGIN`, `PORT` | Set the exact browser origin and API listener port. For local development, use `http://localhost:5173` as the browser origin. |
| `GROQ_API_KEY`, `GROQ_MODEL` | Enable hosted model assistance for answers and onboarding suggestions. |
| `RAG_URL`, `RAG_SECRET` | Connect Express to a separately hosted retrieval service. Configure the same shared secret on both services. |
| `EMBEDDINGS_URL`, `EMBEDDINGS_MODEL`, `EMBEDDINGS_KEY` | Use an external embeddings endpoint. Reindex policies after changing the embedding model. |
| `SMTP_URL`, `MAIL_FROM` | Deliver invitations and password resets by email. Local development captures messages in `.local/mail/` when SMTP is absent. |

## Run the tests

The API and browser test runner currently imports the Python service from the old module path `services.rag.main:app`. On a clean checkout these suites stop during startup. To enable them, update the Uvicorn arguments in [the test runner](scripts/test-runner.js) to use `main:app` and `--app-dir ml-services`, as the [dev launcher](scripts/serve.js) does. With that correction and PostgreSQL running, use these commands from the repository root.

```sh
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

Run the retrieval tests with the Python environment created during setup:

```powershell
# Windows PowerShell
& .\.local\rag-env\Scripts\python.exe -m unittest discover -s tests/rag
```

```sh
# macOS or Linux
.local/rag-env/bin/python -m unittest discover -s tests/rag
```

## Deployment and troubleshooting

The repository includes a Dockerfile and a Render Blueprint. To deploy, connect the repo as a Blueprint, supply a PostgreSQL `DATABASE_URL` and a private `DEMO_PASSWORD`, and configure any optional providers. The Blueprint generates the signing and retrieval secrets. Container startup applies migrations and seeds the database before serving the built frontend and API. Render checks `/api/health`. See the [deployment configuration](render.yaml) and [container startup command](Dockerfile).

| Symptom | What to check |
| --- | --- |
| PowerShell blocks `npm.ps1` | Use `npm.cmd` and `npx.cmd` in place of `npm` and `npx`. |
| Migration cannot reach PostgreSQL | Keep terminal 1 running and confirm the host, port, and database in `DATABASE_URL`. |
| Prisma Client is missing | Run `npm run build` from the repository root. |
| The retrieval service exits at startup | Install the requirements using the virtual environment's Python executable from step 1. |
| Login requests return an origin error | Open the same browser origin configured in `APP_ORIGIN`, then restart the dev server after any environment change. |

For more setup details or the team's file ownership and PR workflow, see the [local run guide](RUN-LOCALLY.md) and [team collaboration guide](TEAM-GUIDE.md).
