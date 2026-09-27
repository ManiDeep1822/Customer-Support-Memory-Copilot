# Support Memory Copilot
### HackwithHyderabad — built on Hindsight (Vectorize)

A support-desk copilot that uses persistent agent memory (Hindsight) so a support rep never makes a returning customer repeat themselves — and proactively flags customers whose frustration is escalating, before they demand it.

Real data, not synthetic: seeded from the [Customer Support on Twitter](https://www.kaggle.com/datasets/thoughtvector/customer-support-on-twitter) dataset.

---

## Documents in this repo

| Doc | Purpose |
|---|---|
| `README.md` | This file — orientation and setup |
| `docs/SRS.md` | What the system must do — functional & non-functional requirements, personas, acceptance criteria |
| `docs/TRS.md` | How it's built — architecture, API contract, data schemas, folder ownership |
| `docs/master-prompt.md` | The original scope/vision doc fed to Antigravity |

Read them in that order if you're new to the repo. TRS.md is the one to keep open while coding — it's the contract everyone's code must match.

---

## Repo structure

```
/backend      — API server (Node/Express or FastAPI — pick one, see TRS.md)
/frontend     — React + Vite UI
/data         — raw + filtered dataset, seed script output
/scripts      — filter_dataset.py, seed_hindsight.py
/docs         — this documentation set
.env.example  — required environment variables (see TRS.md §6)
```

## Quick start

```powershell
# 1. Clone and branch
git clone <repo-url>
cd support-memory-copilot
git checkout -b <yourname>/<feature>

# 2. Copy env template and fill in your keys
copy .env.example .env

# 3. Backend (FastAPI — run from repo root)
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000

# 4. Frontend (separate terminal)
cd frontend
npm install
npm run dev

# 5. Data pipeline (run once, before the above matter)
cd scripts
pip install -r requirements.txt --break-system-packages
python filter_dataset.py
python seed_hindsight.py
```

## Team ownership

| Person | Owns |
|---|---|
| A | Hindsight + Groq integration, `/backend/services/hindsight.js`, `/backend/services/llm.js` |
| B | Repo/CI scaffold, `/backend` API routes, deployment |
| C | `/scripts/filter_dataset.py`, `/scripts/seed_hindsight.py`, `/data` |
| D | `/frontend`, demo script, submission checklist, content deliverables |

Full requirement-level detail is in `docs/SRS.md`; full technical contract is in `docs/TRS.md`. Don't start a component without checking TRS.md's API contract and data schema first — that's what keeps four parallel builds compatible.

## Submission checklist (condensed — full list in SRS.md §7)

- [ ] GitHub repo, clean history, this README complete
- [ ] Demo video (2-3 min)
- [ ] Live demo ready
- [ ] Hindsight integration explanation
- [ ] Each member's Article + Social post + Video (official content guide)
