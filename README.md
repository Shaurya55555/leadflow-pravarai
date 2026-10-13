# LeadFlow

A single-screen lead management tool: track leads, log every discussion, and set follow-up reminders.

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind
- **Backend:** FastAPI + SQLAlchemy + SQLite
- **Tests:** pytest (API)

## Features

| Requirement | Where |
| --- | --- |
| Lead list: name, status badge, last note, time since last discussion | `frontend/src/components/LeadRow.tsx` |
| Filter by status | status chips, handled server-side via `GET /leads?status=` |
| Today's follow-ups pinned on top | `pinTodaysFollowUps` in `frontend/src/lib/time.ts` (uses the viewer's local day) |
| Timeline dialog (reverse chronological) | `LeadTimelineDialog.tsx`, `GET /leads/{id}/discussions` |
| Add discussion + optional follow-up, list updates immediately | `POST /leads/{id}/discussions` returns the updated lead, merged into the list without a refetch |
| Status update from dialog | `PATCH /leads/{id}` |
| Add lead (name required, company/phone optional, status defaults to New) | `AddLeadDialog.tsx`, `POST /leads` |
| Bonus: search by name | search box, `GET /leads?q=` |
| Bonus: overdue follow-ups in red | row + dialog highlighting |
| Bonus: Docker Compose | `docker-compose.yml` |
| Bonus: seed script (7 leads with discussions) | `backend/app/seed.py` |

## Run locally

Prerequisites: Python 3.11+, Node 20+.

### 1. Backend

```bash
cd backend
python -m venv .venv
# macOS/Linux: source .venv/bin/activate    Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # optional, defaults work
python -m app.seed              # optional demo data (use --reset to reseed)
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs. Run tests with `pytest`.

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local      # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

Open http://localhost:3000.

### Docker Compose

```bash
docker compose up --build
```

Frontend on :3000, API on :8000. The backend seeds demo data on first boot; the SQLite file lives in a named volume.

## Environment variables

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | backend | `sqlite:///./leadflow.db` | SQLAlchemy URL |
| `CORS_ORIGINS` | backend | `http://localhost:3000` | Comma-separated allowed origins |
| `NEXT_PUBLIC_API_URL` | frontend | `http://localhost:8000` | API base URL (inlined at build time) |

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/leads?status=&q=` | Includes `last_note` / `last_discussion_at`; most recently touched first |
| POST | `/leads` | 201; `name` required |
| GET | `/leads/{id}` | 404 if missing |
| PATCH | `/leads/{id}` | Partial update (status, name, company, phone, `follow_up_at`; null clears it) |
| DELETE | `/leads/{id}` | 204, cascades to discussions |
| GET | `/leads/{id}/discussions` | Newest first |
| POST | `/leads/{id}/discussions` | 201; `{note, follow_up_at?}`; returns `{discussion, lead}` |

Validation failures return 422, unknown ids 404. Frontend surfaces the server message inline.

## Design decisions

- **Timestamps are stored and served as UTC** (ISO 8601 with `Z`). "Today" and "overdue" are computed in the browser against the viewer's local day, so a follow-up at 9am IST is "today" for an IST user regardless of server timezone.
- **Saving a discussion without a follow-up leaves the existing follow-up untouched**; it can be cleared explicitly from the dialog.
- **Won/Lost leads are never pinned or flagged overdue**, since a stale reminder on a closed deal is noise.
- **Discussions are immutable** (append-only log), which keeps the timeline trustworthy.
- **Latest note per lead is fetched with one grouped query** rather than N+1.
- Auth was skipped (optional in the brief). No pagination: fine for a single rep's lead list, would be the first thing to add.

## AI usage

Built with Claude Code (Anthropic) as a pair-programmer: it drafted the API, components and tests, which I reviewed, ran and verified end to end (backend tests, lint, production build, and a manual browser pass through the main flows).
