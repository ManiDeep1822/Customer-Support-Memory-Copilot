# Master Prompt: Customer Support Memory Copilot
### HackwithHyderabad — Hindsight Memory Hackathon

---

## 1. What we are building

A support-desk copilot for a human support rep. When a returning customer opens a new ticket, the agent uses **Hindsight** (retain / recall / reflect) to pull up everything it has learned about that customer from real past conversations, so the rep never makes the customer repeat themselves — and the agent proactively flags customers whose frustration is escalating, before they have to demand an escalation themselves.

The demo has a hard **memory OFF / memory ON toggle** so judges see the exact same ticket handled two ways, side by side.

Do not build anything beyond what is listed here. Scope discipline is the only thing that matters in the next 24 hours.

---

## 2. Data (real, not synthetic)

- Source: Kaggle dataset `thoughtvector/customer-support-on-twitter`
- Pick ONE brand handle with high volume and clear repeat customers: prefer `AmazonHelp` or `Uber_Support`.
- Build `scripts/filter_dataset.py`:
  1. Load the CSV.
  2. Keep only rows where `inbound == True` and the reply is directed at the chosen brand handle.
  3. Group by `author_id`.
  4. Keep only customer `author_id`s with **2 or more separate conversation threads** (different `tweet_id` roots), ideally spaced days/weeks apart based on `created_at`.
  5. Reconstruct each thread as an ordered conversation (customer message → brand reply → customer reply, etc.) using `in_response_to_tweet_id`.
  6. Output a clean JSON file: one object per customer, with a list of their historical threads (each thread = list of {role, text, timestamp}), and one final thread held out separately as the "new incoming ticket" for the live demo.
- **Pseudonymize on output**: replace `author_id`/handle with a generated label like `Customer #4471` in every place the UI will render it. Keep the real text content (that's the point), just don't expose real handles in the demo.
- Pick 5-8 customers from the filtered set to actually seed. Pick 1 of those as the "hero" customer for the live demo — their story should be simple to narrate (e.g. same delivery/account issue recurring, or an issue that got resolved and reappeared).

---

## 3. Hindsight integration (this is 25% of the score — make it visible, not incidental)

Use the Hindsight API/SDK directly (not just the 2-line LLM wrapper) so you have explicit control for the demo.

- **retain**: On data seeding, retain each historical thread per customer as an Experience, tagged with `customer_id` metadata for isolation. On each new live message during the demo, retain it the same way, in real time, visibly.
- **recall**: Before the agent responds to a new ticket, call recall scoped to that `customer_id`. Use this to pull: past issues, past resolutions, environment/product details mentioned, and prior sentiment.
- **reflect**: After each ticket is marked resolved (a button in the UI: "Mark Resolved"), call reflect to update:
  - An **Opinion**: a confidence-scored belief about this customer's current frustration/churn-risk level (this is the novel feature — see Section 4).
  - An **Observation**: any generalizable insight (e.g. "this customer's issue keeps recurring after each app update").
- The frontend must show a live "Agent Memory" side panel rendering exactly what was recalled for this ticket (raw Hindsight recall output, formatted) — judges need to SEE memory working, not take your word for it.

---

## 4. Novel feature: Customer Effort Trajectory

This is the mandatory novelty requirement. Grounded in two things:
- Industry data showing customers who must re-contact support multiple times for one issue are dramatically more likely to churn.
- Recent NLP research on lifecycle-aware modeling of multi-turn support conversations (treating a customer's issue as an evolving trajectory, not a static log).

Implementation:
- Each time `reflect` runs, update a running **Opinion** object: `{customer_id, contact_count_this_issue, sentiment_trend, confidence, risk_level}`.
- `risk_level` crosses from `normal` → `watch` → `escalate` based on (a) repeat-contact count for the same underlying issue and (b) sentiment trend across turns (use a lightweight sentiment call to the LLM, not a separate ML model — no time for that).
- When `risk_level` hits `escalate`, the UI shows a **proactive banner above the ticket**, before the rep even reads the message: *"This customer has contacted support 3 times about this issue and sentiment is declining — consider escalating or offering a goodwill gesture."*
- This is what separates you from "the bot remembers the last ticket" — the bot has an opinion that got more confident over multiple sessions, and acts on it unprompted.

---

## 5. Tech stack

- Frontend: React + Vite, plain CSS or Tailwind (keep it dense/professional, not templated-looking — no generic gradient hero sections)
- Backend: Node/Express or Python FastAPI (whichever the team is faster in — pick one, don't mix)
- LLM: Groq, model `openai/gpt-oss-120b` as primary, `qwen/qwen3-32b` as fallback. Wrap every LLM call with retry + fallback-model logic for function-calling errors (Groq's docs flag this as a known rough edge).
- Memory: Hindsight Cloud (hosted instance from Person A's setup)
- No database needed beyond what Hindsight stores — keep the seeded dataset as static JSON, load into Hindsight once via a seed script, don't rebuild it from scratch on every run.

---

## 6. UI requirements (demo-critical)

1. **Ticket list view**: list of customers/tickets, risk-level badge visible per ticket.
2. **Ticket detail view**: conversation thread + "Agent Memory" panel (raw recall) + a "Memory: ON / OFF" toggle at the top.
   - OFF: agent responds using only the current message, no recall call made — genuinely dumber, on purpose.
   - ON: agent responds using recall context, references specifics from past threads by name.
3. **Escalation banner**: appears only when risk_level = escalate, only in ON mode.
4. **"Mark Resolved" button**: triggers `reflect`, and the memory panel visibly updates afterward (e.g. show the updated Opinion/confidence score changing) — this is your "agent got smarter" money shot for the demo.

---

## 7. Explicitly out of scope for these 24 hours

- No real customer-facing chatbot (this is a rep-facing copilot, one direction only)
- No multi-brand support — one brand, hardcoded
- No auth/login system — single shared demo session is fine
- No custom ML sentiment model — LLM call only
- No mobile responsiveness polish — desktop demo only

---

## 8. Submission checklist (don't lose points on logistics)

- [ ] GitHub repo, clean commit history, README explaining the Hindsight integration explicitly
- [ ] Demo video (2-3 min): narrate the OFF → ON → resolve → escalate flow for the hero customer
- [ ] Live demo ready for judges
- [ ] Written explanation of exactly how retain/recall/reflect map to your feature (Section 3 above, condensed)
- [ ] Each team member's Article + Social Media post + Video per the official content guide
