# GEMINI.md — Instructions for Antigravity in this repo

Read this file first, every session, before generating any code. Then read `README.md`, `docs/SRS.md`, and `docs/TRS.md` together — they are one linked spec, not three independent documents. Do not generate code from partial context (e.g. TRS alone) — the API contract in TRS only makes sense next to the requirements in SRS.

## What this repo is

A support-desk copilot (hackathon build, Hindsight memory system) that lets a support rep see a returning customer's real history and an escalation-risk signal, with a Memory ON/OFF toggle so the effect of memory is demonstrable side by side. Full detail: `docs/master-prompt.md` for vision, `docs/SRS.md` for requirements, `docs/TRS.md` for the technical contract.

## Backend stack — STATUS: NOT YET LOCKED

`docs/TRS.md` §2 requires one backend stack chosen (Node/Express **or** FastAPI), written into that file, before any backend code is generated. **If this line still says "team picks one" when you're reading this, stop and ask the human which one before writing any `/backend` code.** Do not default to one silently — a wrong guess here means two people's generated code target different runtimes and nothing merges.

## Hard rules (apply to every session, every person)

1. **Stay inside your ownership.** Check `docs/TRS.md` §5 (Component Ownership table) before touching any file. If a prompt would require editing a file outside the current person's row, stop and flag it instead of doing it — don't "helpfully" scaffold someone else's folder.
2. **The API contract in TRS §4 is fixed.** Field names, endpoint paths, and request/response shapes must match exactly — no renaming `risk_level` to `riskLevel`, no adding fields not listed without updating TRS.md first and telling the team.
3. **The data schemas in TRS §3 are fixed.** Any code producing or consuming `Customer`, `risk profile`, or Hindsight metadata objects must match those shapes exactly.
4. **Every Hindsight `retain` call must include `{ customer_id, brand }` metadata** (TRS §3.3). Every `recall` call must filter by `customer_id`. A recall without that filter is a bug — it breaks per-customer isolation, which is the whole point of the memory story.
5. **Never render a real Twitter handle anywhere in the UI, logs, or generated demo assets.** Use `display_label` (e.g. "Customer #4471") per SRS FR-11. This is a hard requirement, not a nice-to-have.
6. **Follow SRS non-functional requirements as constraints, not suggestions** — particularly NFR-2 (Groq retry/fallback: `openai/gpt-oss-120b` → `qwen/qwen3-32b` on function-calling errors) and NFR-3 (dense professional UI, not a generic AI-chatbot template).
7. **Don't build anything listed under SRS §7 / TRS §8 (Out of Scope / Non-Goals).** No auth, no multi-brand support, no custom ML model, no mobile polish, no test suite beyond manual verification, no CI/CD beyond keeping the repo buildable. Time is the scarce resource — scope discipline matters more than completeness.
8. **If `.env` doesn't exist yet, create it from `.env.example` and tell the human which keys are still empty.** Never invent placeholder API keys that look real, and never commit `.env`.

## Session order (if the repo is still just docs, no code)

1. First session: scaffold only. Create the empty folder structure exactly matching the README tree (`/backend`, `/frontend`, `/data`, `/scripts`, `.env.example`), commit it, and stop there — no logic yet. This must happen before anyone else branches off.
2. After scaffold is committed: each person opens their own session, on their own branch, prompting Antigravity with this file + README + SRS + TRS + an explicit statement of which ownership row they're implementing (see `docs/TRS.md` §5).
3. Data pipeline (`/scripts`) should run before backend integration work depends on seeded data — check `/data/filtered_customers.json` exists before writing code that assumes it.

## When something in these docs seems wrong or incomplete

Say so explicitly rather than silently improvising a fix. These documents were written under time pressure for a <24-hour hackathon build — gaps are more likely than malicious ambiguity, but guessing quietly compounds errors across four parallel workstreams. Flag it, propose the smallest fix, and let the human confirm before continuing.
