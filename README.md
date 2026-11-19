# HD²LAB BabyCare

> **Integrated parenting web platform**
> *Baby profiles • Growth tracker • Daily care (feeding & sleep) • Health and vaccination calendar • Parenting knowledge • HyangDani Baby AI*

**Live:** https://hd2lab.duckdns.org/babycare/

---

## 1. Overview

**HD²LAB BabyCare** is a responsive web app (PWA) that keeps a child's profile, growth, daily care and health schedule in one place and adds a grounded parenting assistant. It runs with an account (Google or e-mail OTP) or, for a quick guest session, entirely in the browser.

### Core modules

1. **Baby profile & family sharing** — multiple children per account, corrected age for preterm infants, and per-child membership with `owner` > `caregiver` > `viewer` roles. Owners invite by e-mail or by a one-time invite code; joining through a code returns a pending request that the owner approves.
2. **Growth tracker** — KDCA (2017) child growth standard LMS percentile calculation with interactive growth-curve charts, per-metric curves, and a growth summary.
3. **Daily care tracker** — feeding records (formula, direct breastfeeding, expressed milk, weaning food) with daily totals, and a live sleep timer that correctly splits a sleep session that crosses midnight.
4. **Health calendar** — Korean NIP vaccination schedule and the 1st–8th infant health check-ups generated from the child's birth date, with event CRUD and a calendar summary. `GET /health-rules/live` serves the current rule set, so the schedule can be updated on the server without a code deploy.
5. **Parenting knowledge** — a searchable library of 8 official public-source articles across 8 categories (newborn care, feeding, sleep, weaning, health, development, safety, parenting tips), filterable by category, month of age and keyword.
6. **HyangDani Baby AI** — an 8-step RAG pipeline over the verified knowledge base: safety screening (emergency, high fever and dosage questions get an immediate guarded answer), knowledge retrieval, consent-gated child context, prompt assembly, generation through the HD2Lab AI Gateway, post-validation and source citations. Conversations are stored per user.
7. **Statistics ZIP analysis** — upload a multi-month `stat_*.zip` export and get feeding, sleep, diaper, play and tummy-time trends; pasted CSV works too. Duplicate dates are merged on import. Guests get a stateless analysis (10 MB limit, nothing stored) and signed-in users can attach the result to a child.

---

## 2. Technology stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Recharts, Lucide icons, TanStack Query, PWA manifest
- **Backend**: Python 3.13, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, SQLite (single node) or PostgreSQL
- **AI**: gateway abstraction over the HD2Lab AI Gateway (Unix socket), with Gemini, local Llama and a deterministic mock provider; rule-based RAG fallback when the gateway is unavailable
- **Auth**: Google OAuth (`Crew` accounts) or a 6-digit e-mail OTP; `X-User-Email` from the Nginx/SSO proxy or a JWT (`Authorization: Bearer` / `babycare_access_token` cookie); optional 7-day "keep me signed in"
- **Deploy**: Nginx reverse proxy at `/babycare/` and `/api/babycare/v1/`, systemd unit `hd2lab-babycare`

---

## 3. Quick start (local development)

### Backend

```bash
cd services/babycare/backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
PYTHONPATH=. uvicorn app.main:app --host 127.0.0.1 --port 8004 --reload
```

API docs on a running instance: `http://localhost:8004/api/babycare/v1/docs`. The repository copy of the contract is [docs/API.md](docs/API.md).

### Frontend

```bash
cd services/babycare/frontend
npm install
npm run dev      # http://localhost:5173/ (Vite base path /babycare/)
```

### Tests

```bash
# Backend pytest suites (11 modules)
PYTHONPATH=services/babycare/backend services/babycare/backend/.venv/bin/pytest tests/backend/ -v

# Frontend production build
cd services/babycare/frontend && npm run build
```

---

## 4. API

The full REST contract for `/api/babycare/v1` — authentication, roles, request/response bodies, error codes and environment variables — is in **[docs/API.md](docs/API.md)**, copied from the source so the repository is enough to call the service without a running instance.

- Base path: `/api/babycare/v1`
- Authentication: Nginx/SSO proxy header (`X-User-Email`) first, otherwise JWT (`Authorization: Bearer` or the `babycare_access_token` cookie); `POST /auth/otp/request` and `/auth/otp/verify` implement the e-mail OTP flow and `/auth/google/*` the OAuth flow
- Roles are per child: `owner` > `caregiver` > `viewer`
- Screening, deployment and live-update procedures: [docs/DEPLOYMENT_AND_RUNBOOK.md](docs/DEPLOYMENT_AND_RUNBOOK.md)

Endpoint groups: `/auth`, `/children` (profiles, members, invites, join requests), `/children/{id}/feeding`, `/children/{id}/sleep`, `/children/{id}/growth`, `/children/{id}/calendar` and `/health-rules`, `/articles`, `/analytics`, `/ai`, plus system health.

---

## 5. Deployment

`deploy/` holds the operational assets: `.env.example`, the `hd2lab-babycare` systemd unit, the Nginx site for `/babycare/`, registration scripts for the Server-HQ service hub and the AI Gateway route, and one-command `update_live.sh` / `backup.sh` / `restore.sh`. Runtime data lives in `data/` and the upload directory configured by `UPLOAD_DIR`; `health_rules_live.json` can be replaced on the server to publish a new vaccination or check-up schedule immediately.

---

## 6. Documentation

- [API contract (docs/API.md)](docs/API.md)
- [Deployment and runbook (docs/DEPLOYMENT_AND_RUNBOOK.md)](docs/DEPLOYMENT_AND_RUNBOOK.md)
- [Architecture review (docs/architecture-review.md)](docs/architecture-review.md)
- [Implementation plan (docs/implementation-plan.md)](docs/implementation-plan.md)
