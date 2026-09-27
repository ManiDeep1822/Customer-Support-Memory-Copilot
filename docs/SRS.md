# Software Requirements Specification (SRS)
### Support Memory Copilot

## 1. Purpose

Define what the system must do, for whom, and how success is judged, so all four builders are targeting the same finished product instead of four slightly different ones.

## 2. Scope

A rep-facing (not customer-facing) web application. A support rep opens a ticket; the system uses Hindsight to recall a specific customer's history from real past conversations and helps the rep respond with continuity, while surfacing an escalation risk signal derived from repeat-contact patterns. One brand's data, no auth, single demo session, desktop only. Full exclusions in §6.

## 3. Personas

- **Support Rep (primary user in the demo)**: opens tickets, reads recalled context, responds, marks resolved.
- **Customer (represented only via seeded real historical data, never live-interacted with)**: has a history of real past contacts, pseudonymized in the UI.
- **Judge (secondary user, evaluates the demo)**: needs to see memory working, not take it on faith — every requirement below that says "visibly" is there for this persona.

## 4. Functional Requirements

| ID | Requirement |
|---|---|
| FR-1 | System shall list all seeded tickets/customers with a visible risk-level badge (normal / watch / escalate) per ticket. |
| FR-2 | System shall open a ticket detail view showing the full conversation thread for that ticket. |
| FR-3 | System shall provide a Memory ON/OFF toggle per ticket view. |
| FR-4 | When Memory is OFF, the agent shall generate a response using only the current message content — no Hindsight recall call is made. |
| FR-5 | When Memory is ON, the agent shall call Hindsight `recall` scoped to that customer's ID before generating a response, and the response shall reference specific recalled facts (past issue, past resolution, or product/environment detail). |
| FR-6 | System shall render a live "Agent Memory" panel showing the raw recall output for the current ticket, visible at all times when Memory is ON. |
| FR-7 | System shall provide a "Mark Resolved" action per ticket, which triggers a Hindsight `reflect` call. |
| FR-8 | On reflect, the system shall update a per-customer risk profile (contact count for this issue, sentiment trend, confidence, risk_level) and the Agent Memory panel shall visibly reflect the updated value after the action completes. |
| FR-9 | When a customer's risk_level is `escalate`, the ticket view shall display a proactive escalation banner above the conversation, visible only in Memory ON mode, before the rep reads the message body. |
| FR-10 | System shall ingest historical real conversation data (Kaggle Twitter support dataset) via a filter + seed pipeline, run once before the demo, covering at least 5 customers each with 2+ separate real historical threads. |
| FR-11 | System shall pseudonymize customer identity in every UI-visible location (no real handles rendered), while preserving real conversation text content. |
| FR-12 | System shall retain new demo-time messages into Hindsight in real time, so a live message contributes to that customer's memory during the demo itself. |

## 5. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | Perceived response latency for a recall+generate cycle should stay under ~4-5 seconds during the live demo — use Groq specifically for this (fast inference tier), and stream responses if the framework supports it easily; don't spend build time on this if the default is already acceptable. |
| NFR-2 | LLM calls must handle function-calling errors gracefully — retry once, then fall back from `openai/gpt-oss-120b` to `qwen/qwen3-32b` rather than surfacing a raw error to the demo. |
| NFR-3 | UI must read as a professional internal tool (dense, enterprise support-desk aesthetic) — not a generic AI-chatbot template with a centered hero and gradient background. |
| NFR-4 | No real customer identity may be exposed in the UI, demo video, or any public artifact — pseudonymize per FR-11 without exception. |
| NFR-5 | System must run reliably on a single shared demo machine/session — no requirement for concurrent multi-user support, horizontal scaling, or production-grade auth. |
| NFR-6 | Codebase must stay legible to all 4 team members working in the same repo simultaneously — one shared style/lint config, one shared API contract (see TRS.md), no undocumented cross-cutting changes to files outside your ownership area without a heads-up. |

## 6. Assumptions & Dependencies

- Hindsight Cloud instance is provisioned and reachable (MEMHACK99 credit applied) before backend work starts.
- Groq API key is available before LLM integration work starts.
- Kaggle dataset download succeeds and contains enough repeat-customer threads for the chosen brand handle; if the first brand choice doesn't yield enough repeat customers, fall back to a second brand handle rather than switching datasets.
- Antigravity is used per-person against the shared repo; TRS.md's contracts are the source of truth if Antigravity-generated code from two people conflicts.

## 7. Explicitly Out of Scope

- Customer-facing chatbot UI (rep-facing only)
- Multi-brand support (one brand, hardcoded)
- Authentication/login system
- Custom-trained sentiment/ML model (LLM call only)
- Mobile responsiveness
- Horizontal scaling / production deployment concerns

## 8. Acceptance Criteria (what "done" means for the demo)

1. A judge can watch one ticket handled with Memory OFF, then the same customer's next real message handled with Memory ON, and see a visibly different, context-aware response.
2. A judge can watch a "Mark Resolved" action and see the Agent Memory panel's risk/confidence value change as a direct result.
3. A judge can see an escalation banner appear for a customer whose real historical data shows 2+ repeat contacts, without being told it will happen.
4. No real Twitter handle is visible anywhere in the running app or the demo video.
