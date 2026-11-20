# JoinFlow – Team Collaboration Guide

> 6-person team split across Frontend, Backend, ML Services, and DevOps.  
> Every person owns a clear slice of the codebase. Merge via Pull Requests into `main`.

---

## Team Roles Overview

| Person | Role | Area |
|--------|------|------|
| **Person 1** | Frontend – Auth & Employee Portal | `frontend/src/auth/`, `frontend/src/employee/` |
| **Person 2** | Frontend – HR & Manager Portal | `frontend/src/staff/`, `frontend/src/shared/` |
| **Person 3** | Backend – Auth, Core & Config | `backend/src/auth/`, `backend/src/app.js`, `backend/src/config.js`, `backend/src/index.js` |
| **Person 4** | Backend – Onboarding Workflow & AI Plans | `backend/src/onboarding/`, `backend/src/workspace/` |
| **Person 5** | Backend – Employee Services & Knowledge | `backend/src/employee/`, `backend/src/knowledge/` |
| **Aman** | ML Services, Database & DevOps | `ml-services/`, `prisma/`, `scripts/`, `tests/`, root config |

---

## Git Setup (Everyone does this once)

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_ORG/joinflow.git
cd joinflow

# 2. Set your identity
git config user.name  "Your Name"
git config user.email "you@example.com"

# 3. Create your feature branch (replace N with your person number)
git checkout -b feature/person-N-description

# Example:
git checkout -b feature/person-1-employee-portal
```

---

---

## Person 1 – Frontend: Auth & Employee Portal

**Role:** Owns the login/registration UI and all employee-facing pages.

### Files Owned

```
frontend/src/auth/
  ├── Login.jsx          ← Sign-in, sign-up, forgot password, reset password UI
  └── Access.jsx         ← Role-selector screen (Employee / Manager / HR tabs)

frontend/src/employee/
  ├── Portal.jsx         ← Employee dashboard shell & tab routing
  ├── Employee.jsx       ← Task list view, task detail, complete/start task
  ├── Documents.jsx      ← Document upload (identity, signed offer)
  ├── EquipmentAccess.jsx ← Equipment & access status view
  ├── Assistant.jsx      ← AI chat assistant UI
  └── taskQueue.js       ← Local task ordering/priority logic
```

### Git Commands

```bash
# Create your branch
git checkout -b feature/person-1-employee-portal

# Stage only your files
git add frontend/src/auth/
git add frontend/src/employee/

# Commit with a clear message
git commit -m "feat(employee-portal): improve task UI and login flow"

# Push and open a PR
git push origin feature/person-1-employee-portal
```

### Notes
- Do NOT edit `frontend/src/shared/` — coordinate with Person 2 for shared components.
- The `api.js` client in `shared/` is owned by Person 2; request changes via PR review.
- Employee routes hit `/api/me/checklist` and `/api/tasks/*` — coordinate with Person 4.

---

## Person 2 – Frontend: HR & Manager Portal

**Role:** Owns the HR dashboard, manager views, and all shared UI utilities.

### Files Owned

```
frontend/src/staff/
  ├── Portal.jsx            ← HR/Manager dashboard shell & page routing
  ├── PeopleOverview.jsx    ← Stats cards, readiness bar, work queue
  ├── EmployeeDirectory.jsx ← Employee list, search, profile, task table
  ├── Plans.jsx             ← Checklist review & plan approval UI
  ├── TaskMonitor.jsx       ← Centralized task monitoring with filters
  ├── Escalations.jsx       ← At-risk employees, delayed tasks, issues
  ├── Policies.jsx          ← Policy management (Manager) & suggestions (HR)
  ├── DocumentReviews.jsx   ← HR document review (approve/reject submissions)
  ├── StaffAccess.jsx       ← Staff registrations & role management
  └── Team.jsx              ← New hire form, manager decisions, location change

frontend/src/shared/
  ├── api.js                ← Fetch wrapper for all API calls
  ├── Forms.jsx             ← Field, Form, Panel, shortDate, isLate helpers
  ├── ui.jsx                ← Brand, Notice, History, Pill components
  ├── Handoffs.jsx          ← Unanswered employee questions UI
  ├── Messages.jsx          ← Direct message thread component
  └── Tickets.jsx           ← Support ticket list & detail (shared by HR & Employee)

frontend/src/
  ├── main.jsx              ← App root, auth state, nav routing
  └── style.css             ← Global CSS styles
```

### Git Commands

```bash
git checkout -b feature/person-2-hr-portal

git add frontend/src/staff/
git add frontend/src/shared/
git add frontend/src/main.jsx
git add frontend/src/style.css

git commit -m "feat(hr-portal): add stats cards and department filter to dashboard"

git push origin feature/person-2-hr-portal
```

### Notes
- `main.jsx` is shared root — coordinate any nav changes with Person 1.
- `style.css` is global — discuss CSS changes in PR to avoid conflicts.
- HR dashboard fetches `/api/team` — coordinate with Person 4 (workspace/overview.js).

---

## Person 3 – Backend: Auth, Core & Config

**Role:** Owns authentication, session management, JWT handling, and app bootstrap.

### Files Owned

```
backend/src/
  ├── app.js          ← Express app factory, middleware, CORS origin check, error handler
  ├── config.js       ← All env variable loading (JWT, DB, GROQ, RAG, SMTP)
  └── index.js        ← Server entry point (connects DB, starts listener)

backend/src/auth/
  ├── accounts.js     ← Register, forgot/reset password, HR invite, staff approvals
  └── session.js      ← JWT cookie issue, /api/me route, session validation middleware
```

### Git Commands

```bash
git checkout -b feature/person-3-auth-core

git add backend/src/app.js
git add backend/src/config.js
git add backend/src/index.js
git add backend/src/auth/

git commit -m "fix(auth): allow both localhost and 127.0.0.1 origins for CSRF check"

git push origin feature/person-3-auth-core
```

### Notes
- The CORS origin check is in `app.js` line 57 — carefully test with both `localhost` and `127.0.0.1`.
- `session.js` attaches `req.user` with role + profile — all other backend files depend on this.
- Changes to `config.js` must be reflected in `.env.example` (owned by Aman).

---

## Person 4 – Backend: Onboarding Workflow & AI Plans

**Role:** Owns the core onboarding engine — task lifecycle, AI checklist generation, plan approval, and workspace overview.

### Files Owned

```
backend/src/onboarding/
  ├── catalog.js      ← Static task templates and seed policies list
  ├── workflow.js     ← checklist(), assign(), preview(), record(), lockProfile(), eligible()
  ├── plans.js        ← suggestions() AI plan generation, addStep(), planRoutes()
  └── routes.js       ← /api/employees (create), /api/tasks/*/start|complete,
                         /api/approvals/*/decision, /api/employees/*/change-preview|apply-change

backend/src/workspace/
  └── overview.js     ← /api/me/checklist (Employee), /api/team (HR+Manager), /api/hr/stats
```

### Git Commands

```bash
git checkout -b feature/person-4-onboarding-workflow

git add backend/src/onboarding/
git add backend/src/workspace/

git commit -m "feat(onboarding): add HR stats endpoint with real DB-computed metrics"

git push origin feature/person-4-onboarding-workflow
```

### Notes
- `workflow.js` is the most critical file in the project — the `checklist()` function is used by 3+ routes.
- The `plan === 'Draft'` → `'Approved'` lifecycle and `review` field states are enforced here — do not change without team discussion.
- `plans.js` calls the RAG service (`retrieve()`) and Groq LLM — coordinate with Person 5 on retrieval changes.
- `catalog.js` changes affect the seed script — coordinate with Aman.

---

## Person 5 – Backend: Employee Services & Knowledge (RAG)

**Role:** Owns employee-side features (documents, issues, messages, notifications) and the RAG/knowledge retrieval bridge.

### Files Owned

```
backend/src/employee/
  ├── services.js     ← Document upload/review, issue CRUD, messages, notifications,
  │                     hrExtras(), employeeExtras(), notify()
  └── triage.js       ← AI-powered issue triage and document review guidance

backend/src/knowledge/
  ├── retrieval.js    ← rag() HTTP client, retrieve() semantic search over policies
  ├── assistant.js    ← /api/assistant route — AI Q&A for employee chat
  ├── chat.js         ← Chat turn persistence and history
  └── policies.js     ← /api/policies CRUD, publish(), policyRoutes(), suggestions
```

### Git Commands

```bash
git checkout -b feature/person-5-employee-services

git add backend/src/employee/
git add backend/src/knowledge/

git commit -m "feat(knowledge): improve RAG retrieval scoring for planning context"

git push origin feature/person-5-employee-services
```

### Notes
- `retrieval.js` calls the ML service at `RAG_URL` (default `http://127.0.0.1:8010`) — coordinate with Aman on `main.py` endpoints.
- `policies.js` controls who can edit policies (Manager only) — do not widen permissions without review.
- `triage.js` uses the RAG client indirectly — test with and without `GROQ_API_KEY` set.

---

## Aman – ML Services, Database & DevOps

**Role:** Owns the Python RAG service, database schema & migrations, scripts, tests, and all project-level config files.

### Files Owned

```
ml-services/
  ├── main.py           ← FastAPI app: /index, /retrieve, /document-review endpoints
  └── requirements.txt  ← Python dependencies (fastapi, uvicorn, pypdf, langchain)

prisma/
  ├── schema.prisma     ← Full database schema (all models)
  ├── seed.js           ← Demo data seeder
  └── migrations/       ← All SQL migration files

scripts/
  ├── serve.js          ← Starts all 3 services (Vite + Express + Uvicorn)
  ├── local-db.js       ← Embedded PostgreSQL for development
  └── test-runner.js    ← Test orchestration

tests/
  ├── workflows.test.js ← API integration tests
  ├── portals.test.js   ← Portal integration tests
  ├── questions.json    ← RAG test questions
  ├── browser/
  │   └── journey.spec.js ← Playwright end-to-end tests
  └── rag/
      └── test_index.py   ← Python RAG unit tests

# Root config files
.env.example            ← Template for environment variables
.gitignore
.nvmrc                  ← Node version pin
Dockerfile              ← Production container build
.dockerignore
render.yaml             ← Render.com deployment config
package.json            ← Root npm scripts and dependencies
package-lock.json
vite.config.js          ← Vite build config (points to frontend/)
tailwind.config.js      ← Tailwind CSS config
postcss.config.js
index.html              ← HTML entry point (loads frontend/src/main.jsx)
playwright.config.js    ← E2E test config
RUN-LOCALLY.md          ← Local dev guide
TEAM-GUIDE.md           ← This file
```

### Git Commands

```bash
git checkout -b feature/aman-ml-devops

# Stage ML service
git add ml-services/

# Stage database
git add prisma/

# Stage scripts & tests
git add scripts/
git add tests/

# Stage root config (be careful — discuss with team before changing package.json)
git add .env.example
git add vite.config.js
git add tailwind.config.js
git add postcss.config.js
git add index.html
git add Dockerfile
git add .dockerignore
git add render.yaml
git add playwright.config.js
git add RUN-LOCALLY.md
git add TEAM-GUIDE.md

git commit -m "chore(devops): update folder paths after restructure to frontend/backend/ml-services"

git push origin feature/aman-ml-devops
```

### Notes
- **Never commit `.env`** — it contains secrets. It is in `.gitignore`. Only update `.env.example`.
- Migrations in `prisma/migrations/` are **append-only** — never edit or delete an existing migration.
- To add a new DB field: edit `schema.prisma`, run `npx prisma migrate dev --name describe_your_change`, commit the new migration file.
- `package.json` changes affect everyone — discuss before adding/removing dependencies.

---

## Shared Files – Coordinate Before Editing

These files are touched by multiple people. Agree before making changes:

| File | Primary Owner | Who else touches it |
|------|--------------|---------------------|
| `frontend/src/main.jsx` | Person 2 | Person 1 (nav items) |
| `frontend/src/style.css` | Person 2 | Anyone adding new components |
| `backend/src/app.js` | Person 3 | Person 4, 5 (new routes registered here) |
| `prisma/schema.prisma` | Aman | Anyone adding a new model |
| `package.json` | Aman | Anyone adding a dependency |

---

## Git Branching Strategy

```
main                        ← Protected, production-ready
  └── develop               ← Integration branch (merge PRs here first)
        ├── feature/person-1-employee-portal
        ├── feature/person-2-hr-portal
        ├── feature/person-3-auth-core
        ├── feature/person-4-onboarding-workflow
        ├── feature/person-5-employee-services
        └── feature/aman-ml-devops
```

### Recommended PR Flow

```bash
# 1. Keep your branch up to date with develop
git fetch origin
git rebase origin/develop

# 2. Fix any conflicts, then push
git push origin feature/person-N-description --force-with-lease

# 3. Open PR: feature/person-N → develop
# 4. At least 1 teammate reviews and approves
# 5. Squash & merge into develop
# 6. Tech lead merges develop → main for releases
```

---

## Daily Workflow (Everyone)

```bash
# Morning — sync latest changes
git fetch origin
git rebase origin/develop

# Make changes in your files only
# ...

# Stage only your files (avoid "git add .")
git add frontend/src/employee/Portal.jsx   # example

# Commit often with clear messages
git commit -m "feat(employee): show overdue badge on task card"

# Push at end of day
git push origin feature/person-1-employee-portal
```

---

## Commit Message Format

Follow **Conventional Commits** so the changelog is clean:

```
<type>(<scope>): <short description>

Types:
  feat      → new feature
  fix       → bug fix
  chore     → build/tooling/config change
  refactor  → code restructure without behavior change
  docs      → documentation only
  test      → adding or fixing tests
  style     → CSS/formatting only

Examples:
  feat(hr-portal): add department filter to employee directory
  fix(auth): allow 127.0.0.1 origin for local dev
  chore(db): add migration for policy suggestion status field
  docs(readme): update run instructions for new folder structure
```

---

## Environment Setup Per Person

**Everyone** copies `.env.example` to `.env` on their machine. Never commit `.env`.

```bash
cp .env.example .env
# Then open .env and set:
#   JWT_SECRET=<generate with: node -e "require('crypto').randomBytes(48).toString('hex')|Write-Output">
#   DEMO_PASSWORD=WelcomeDemo123!
# Optionally set GROQ_API_KEY for AI features
```

---

## Quick Reference — Who to Ask

| Question | Ask |
|----------|-----|
| Login not working / 403 error | Person 3 |
| Employee can't see their tasks | Person 4 |
| AI assistant not responding | Person 5 |
| RAG / embedding issues | Aman |
| HR dashboard UI broken | Person 2 |
| Employee portal page missing | Person 1 |
| Database migration needed | Aman |
| Deployment / Docker issue | Aman |
| New npm package needed | Aman (approve) |
| New API route needed | Person 4 or 5 depending on feature |