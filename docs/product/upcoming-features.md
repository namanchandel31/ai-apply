# Upcoming Features & Engineering Backlog

> **Single source of truth** for planned product work and engineering improvements.  
> **Last updated:** June 2, 2026  
> **Companion docs:** [Product PRD](./PRD.md) (shipped experience) · [Technical PRD](./Technical-PRD.md) (current architecture)

Use `- [ ]` / `- [x]` to track progress. Add acceptance notes under each feature when starting implementation.

---

## Release phases (overview)

| Phase | Theme | Checklist section |
| --- | --- | --- |
| **Next** | P0 product + reliability | [P0 — Product](#p0--product) · [P0 — Engineering reliability](#p0--engineering-reliability) |
| **Then** | P1 growth & profiles | [P1 — Product](#p1--product) · [P1 — Engineering operability](#p1--engineering-operability) |
| **After** | P2 outcomes & analytics | [P2 — Product](#p2--product) · [P2 — Engineering platform](#p2--engineering-platform) |
| **Later** | P3 platform & monetization | [P3 — Product](#p3--product) · [P3 — AI platform](#p3--ai-platform) · [Architecture evolution](#architecture-evolution) |

---

## P0 — Product

### Applicant profile

**Outcome:** Reusable CTC, notice period, locations, and links for all AI flows (email, JD compliance, extension, future intelligence).

**Problem:** Compensation and availability are re-entered or missing from emails; JDs often require them.

- [ ] Add `users` (or dedicated) fields: current CTC (amount + currency), expected CTC (amount + currency)
- [ ] Add notice period enum: Immediate · 15 · 30 · 45 · 60 · 90 days · Negotiable
- [ ] Add `preferred_locations` JSON array (e.g. `["Remote"]`, `["Remote","Bangalore"]`)
- [ ] Add validated URL fields: LinkedIn, portfolio, GitHub
- [ ] Compute and expose `profile_completion_percent` (0–100)
- [ ] Define completeness rubric (8 fields): resume uploaded · current CTC · expected CTC · notice period · preferred locations · LinkedIn · portfolio · GitHub
- [ ] Resume parse integration: extract links/location with confidence — auto-fill if >0.9, confirm if 0.6–0.9, ignore if <0.6; never hallucinate
- [ ] Ensure parse failure does not block resume upload
- [ ] Inject profile into every generation request
- [ ] When JD asks for CTC/notice/location/links: include if present, **omit silently** if absent (no "N/A", no apologies)
- [ ] Persist `application_generation_context` snapshot per application (profile edits must not rewrite history)
- [ ] Setup UI: dedicated Profile card — Incomplete / Partial / Complete (e.g. `6/8 fields completed`)
- [ ] API: GET/PATCH applicant profile endpoints with validation
- [ ] Tests: generation omits missing fields; snapshot immutability

---

### Guided onboarding

**Outcome:** API key → resume → profile → Gmail with in-product guidance; resumable flow.

**Problem:** Users don’t know credential order; resume parse fails without AI key.

- [ ] First Google login routes into onboarding (not dashboard until complete or skipped policy defined)
- [ ] Step 1: Add and validate AI API key
- [ ] Step 2: Upload resume (gated until valid AI key)
- [ ] Step 3: Complete applicant profile
- [ ] Step 4: Gmail app password setup
- [ ] Step 5: Ready state + first apply CTA
- [ ] Persist progress so user can leave mid-flow and resume
- [ ] Setup status API reflects onboarding step completion
- [ ] Analytics: funnel drop-off per step

---

### Validated AI models

**Outcome:** Provider → one key → curated model dropdown (start: **Gemini 2.5 Lite**); no free-text model names.

**Problem:** Free-text model names cause misconfiguration and failures.

- [ ] UI: select provider → paste one API key per provider
- [ ] UI: model dropdown from manually curated list only (no auto-discovery)
- [ ] Backend: store selected model per credential; validate against allowlist
- [ ] Runtime fallback to trusted default when configured model unavailable
- [ ] Internal process: new models added only after QA sign-off
- [ ] Production allowlist excludes unreliable free-tier models (align with engineering checklist)
- [ ] Tests: reject unknown model IDs on save

---

### JD instruction compliance

**Outcome:** Follow JD subject/format/field asks; omit missing profile data silently.

**Problem:** JDs specify subject format (`Name - Role`) and required fields; generation ignores or invents missing values.

- [ ] Extract structured instructions from parsed JD (subject template, required fields)
- [ ] Merge instructions with applicant profile before generation
- [ ] Generation prompt includes compliance checklist
- [ ] Subject: follow JD format when parseable
- [ ] Body: include JD-requested fields only when profile has values
- [ ] Missing field: omit completely — no placeholder or apology
- [ ] Conflict with safety: fall back to standard template
- [ ] UI preview: Applied / Partial / Fallback compliance indicator
- [ ] Acceptance target: ≥95% subject-format compliance when instructions parseable
- [ ] Tests: fixture JDs with format + field requirements

---

### Email tone & structure preferences

**Outcome:** Casual ↔ executive tone and conversational ↔ scannable structure; persisted defaults; drive generation metadata.

- [x] Store `email_tone_level` and `email_structure_level` on user (defaults 50 / 60)
- [x] Derive `toneProfile`, `structureMode`, `selectedPreset` server-side from levels
- [x] Setup + dashboard UI: sliders with preset resolution
- [x] PATCH/GET `/api/user/email-preferences`
- [x] Snapshot `email_preferences_snapshot` on application at generate time
- [x] Email prompt v3 + relaxed structure validation + length strategy
- [ ] Per-application override in application detail (before send) without full re-parse
- [ ] Document shipped behavior in PRD §8.1 when product doc refresh happens

---

## P0 — Engineering reliability

- [ ] Worker-isolated resume parsing (align with ADR-005; upload returns quickly, parse in worker)
- [ ] Provider timeout separate from HTTP timeout (no shared AbortController across retries)
- [ ] Production AI model allowlist enforced server-side (no free OpenRouter models in prod)
- [ ] Harden `failed_parses` and `llm_usage_logs` writes under load (see TD-2)

---

## P1 — Product

### LinkedIn extension

**Outcome:** Apply from job post in ≤2 clicks; same pipeline as dashboard.

- [ ] Chrome extension: **Apply with One Tap** on LinkedIn job posts
- [ ] Extract JD text/metadata from post page
- [ ] Authenticate extension with same Supabase session / token flow
- [ ] POST to existing auto-apply API (parity with dashboard)
- [ ] No auto-click LinkedIn Easy Apply
- [ ] Graceful fallback deep link to web app when extraction fails
- [ ] Pro-gating per plan matrix (when billing exists)

---

### Multi-resume profiles

**Outcome:** Auto-pick resume by JD; user override; attach correct PDF on send.

- [ ] Data model: multiple labeled resumes per user
- [ ] JD → resume matching score + default selection
- [ ] UI: override profile/resume on apply and in application detail
- [ ] Send path attaches selected resume PDF
- [ ] Applications list shows profile/resume label
- [ ] Migration + backward compatibility for single-resume users

---

## P1 — Engineering operability

- [ ] Split Render services: API (`npm run start:api`) vs workers (`npm run worker`)
- [ ] Redis dedicated instance per queue tier at scale
- [ ] Materialized view or read replica for heavy list/status polls
- [ ] Partition `application_events` by month (ADR-007 prep)

---

## P2 — Product

### Recruiter response tracking

**Outcome:** Enable future North Star — recruiter response rate.

- [ ] Persist `gmail_message_id` and `gmail_thread_id` on send
- [ ] Migration: `application_replies` table (`application_id`, `gmail_message_id`, `gmail_thread_id`, `sender_email`, `received_at`, `reply_text`, `classification`, `confidence`)
- [ ] Application fields or derived view: `reply_received`, `first_reply_at`, `reply_classification`, `response_time_minutes`
- [ ] Worker: `gmail-reply-sync-worker` on schedule (e.g. every 15 minutes)
- [ ] Gmail API: fetch threads for sent applications; detect new recruiter messages
- [ ] Service: `replyClassificationService` (positive / negative / neutral / interview / unknown)
- [ ] Wire `email_feedback_signals` / `recordEmailFeedback()` beyond schema stub
- [ ] Do **not** implement open tracking, pixels, read receipts, or beacons

---

### Application analytics (dashboard)

**Outcome:** Volume, send rate, match distribution, and outcome metrics.

- [ ] Card: Application Performance (sent, replies, reply rate, positive rate, interview rate, avg response time)
- [ ] Email style performance breakdown using `email_preferences_snapshot` (toneProfile, structureMode, selectedPreset)
- [ ] API endpoints for aggregated metrics (per user, date range)
- [ ] Caching strategy for expensive aggregates

**Metrics definitions**

- [ ] **Reply rate:** apps with ≥1 recruiter reply ÷ apps sent
- [ ] **Positive reply rate:** positive classifications ÷ apps sent
- [ ] **Interview rate:** interview-related replies ÷ apps sent
- [ ] **Average response time:** first reply timestamp − sent timestamp

**Implementation order**

- [ ] Phase 1: Gmail IDs + reply sync worker + store replies
- [ ] Phase 2: AI classification + analytics calculations
- [ ] Phase 3: Dashboard metrics + response-time display
- [ ] Phase 4: Email style performance + recommendation foundation (recommendation engine **not** in P2 — display only)

---

### Email edit / regenerate in UI

**Outcome:** Fix drafts without full JD re-parse.

- [ ] Application detail: edit subject/body inline
- [ ] Regenerate email action (re-run generation with same context)
- [ ] Validation on save; preserve audit trail / versioning policy
- [ ] Rate limits and cost controls on regenerate

---

## P2 — Engineering platform

- [ ] Implement `recordEmailFeedback` + webhook for bounces/replies
- [ ] Recruiter response pipeline end-to-end (capture → normalize → attribute → metrics)
- [ ] Response-rate analytics API (auditable numerator/denominator)
- [ ] Response status in applications API/UI without breaking four-layer truth model
- [ ] Outbox pattern for exactly-once side effects (where needed)
- [ ] JWT revocation service + session store (see TD-6)
- [ ] Supabase RLS policies matching `users.supabase_user_id`

**Technical acceptance (response tracking)**

- [ ] TUC-07: Reply captured and attributed to `application_id`; included in response-rate metrics
- [ ] Duplicate reply messages idempotent on `gmail_message_id`

---

## P3 — Product

### Team seats & priority tier

- [ ] Team/org model and seat billing
- [ ] Priority queue tier for paid users
- [ ] Admin seat management UI

---

### Premium / managed AI

- [ ] Platform-managed AI (no BYOK required)
- [ ] Premium model routing
- [ ] Fastest queue tier

---

## P3 — AI platform

- [ ] Embeddings for semantic match (`capabilities.js` flag)
- [ ] Streaming partial generation to UI
- [ ] Vision path for scanned resumes
- [ ] ATS scoring microservice or dedicated queue

---

## Architecture evolution

> Consolidated from [future-architecture.md](../roadmap/future-architecture.md). **Requires new ADR before implementation.**

| Bottleneck | Evolution | Checklist |
| --- | --- | --- |
| `application_events` size | Partition / archive | [ ] Archival job + query path for historical events |
| uiStatus complexity | Rule split + test matrix | [ ] Extract rules; expand serializer tests |
| Single Redis | Tiered Redis | [ ] Separate Redis for realtime vs queues at scale |
| Colocated workers | Separate pools | [ ] `ai` vs `send` worker processes |
| Poll + SSE load | Adaptive subscribe | [ ] SSE-primary; poll only when subscribed (TD-4) |
| Status bundle DB load | Read replica / MV | [ ] Materialized status or replica for list endpoint |

**Directional (no ADR yet)**

- [ ] WebSocket realtime (optional; ADR-006 chose SSE)
- [ ] Priority queues (paid tier) — see P3
- [ ] CDC to warehouse
- [ ] Semantic JD cache
- [ ] Multi-region (single-writer regions)
- [ ] Postgres RLS on Supabase (API enforces today)
- [ ] JWT revocation (session store)
- [ ] Event partitioning per ADR-007
- [ ] ATS ranking pipeline
- [ ] Provider capabilities: tool calling, embeddings, streaming, vision (`capabilities.js` stubs)

**Explicitly out of scope (engineering)**

- [ ] Multi-region active-active
- [ ] CRDT state sync
- [ ] gRPC internal APIs
- [ ] Non-Postgres primary store

---

## Documented but not started (technical inventory)

| Area | Notes |
| --- | --- |
| Recruiter response tracking | Schema hooks (`email_feedback_signals`); full pipeline in [P2](#p2--product) |
| JWT revocation / session store | `future-architecture.md`, security replay doc |
| Priority queues / paid tier | `queues/scaling.md` |
| WebSocket realtime | ADR-006 chose SSE |
| Event partitioning / archival | ADR-007 |
| ATS ranking pipeline | `future-architecture.md` |
| Semantic JD cache | Roadmap |
| Postgres RLS | `supabase-auth-cutover.md` |
| E2E Playwright | Recommended release gate — not in repo |

---

## Product use cases (planned — acceptance)

| ID | Scenario | Success criteria |
| --- | --- | --- |
| UC-08 | Tone preference | Professional tone + structured body from sliders |
| UC-09 | JD-specific subject/fields | Subject matches JD; only provided profile fields included |
| UC-10 | Trusted model setup | Provider → key → Gemini 2.5 Lite from dropdown |
| UC-11 | Onboarding order | API key before resume parse; guided Gmail |
| UC-12 | Applicant profile in email | JD asks CTC → included from profile or omitted |
| UC-13 | LinkedIn apply | Extension queues app; same statuses as dashboard |
| UC-14 | Multi-resume routing | Correct profile selected and PDF attached |

---

## Future recommendation engine (post-P2)

Not part of initial analytics ship. Design data model to support later:

- [ ] Compare reply rates by `selectedPreset` / tone / structure over rolling window
- [ ] UI copy: “Based on your results, Recruiter Friendly generated X% more replies…” (recommendation only, no auto-switch)

---

## Explicitly out of product scope (unchanged)

- Email open tracking, pixels, read receipts
- Cover letters for non-email portals
- Auto LinkedIn Easy Apply
- Built-in job board / employer CRM
- Legal review per jurisdiction
