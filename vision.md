# One Tap — Product Vision

> **The fastest way to apply, track, and improve your job search.**

**Website:** [onetapjob.com](https://onetapjob.com)  
**Last updated:** June 2026

---

## One sentence

One Tap turns a job description into a personalized application email sent from your Gmail—and keeps every application organized in one place—so active job seekers can apply at volume without burning out on repetitive work.

---

## The problem we're solving

Applying to jobs at scale is not hard because of a single “Apply” button. It is hard because of everything around it.

Every application repeats the same manual loop:

1. Read and interpret the job description  
2. Decide whether you are a reasonable fit  
3. Tailor outreach so it does not sound generic  
4. Find a contact email (when the posting does not include one)  
5. Switch between AI tools, Gmail, and spreadsheets  
6. Remember what you already applied to and what happened next  

As search volume grows, overhead grows faster than outcomes. More tabs, more copy-paste, more context switching—and more time managing the process instead of focusing on roles that actually fit.

**What breaks today:**

| Pain | Why it matters |
| --- | --- |
| **Repetition** | High-volume seekers repeat the same cognitive work dozens of times per week |
| **Generic outreach** | Templates get ignored; manual tailoring does not scale |
| **Fragmented tooling** | AI for writing, Gmail for sending, Notion/sheets for tracking—nothing is one workflow |
| **Opacity** | Users cannot trust tools that block the browser, fail silently, or lose application history |
| **Setup friction** | Resume, AI keys, email credentials, and profile data are scattered across steps with unclear order |

One Tap exists to collapse that loop into a single, trustworthy workflow.

---

## What we do

One Tap is an **application operations platform** for job seekers—not a job board, not a CRM for recruiters, not a resume-only optimizer.

### Core workflow (shipped)

1. **Configure once** — Connect AI (your key or managed), upload résumé, complete applicant profile, connect Gmail  
2. **Apply** — Paste a job description on the dashboard, or use the Chrome extension on LinkedIn  
3. **Automate intelligently** — Parse the JD, score résumé fit, draft a tailored subject and body, send from the user’s Gmail when a contact is available  
4. **Track honestly** — Every application has a clear status: processing, needs review, sent, failed—with retry and continue paths that never lose history  

Work is **async by design**: users submit a JD, the system queues processing, and the applications list updates in near real time.

### What ships today

| Capability | What it means for users |
| --- | --- |
| **Dashboard apply** | Paste any JD → tailored email → optional auto-send |
| **Chrome extension** | Detect hiring posts on LinkedIn → apply in one click from the feed |
| **Match scoring** | Résumé↔JD fit score with matched and missing skills |
| **Application tracking** | Search, filter, sort, paginate; live status via realtime updates |
| **Email personalization** | LLM-generated subject/body; tone and structure preferences |
| **BYOK or managed AI** | Bring your own API key, or use One Tap’s managed AI with no setup |
| **Recoverability** | Retry failures, continue when contact is missing, cancel without corrupting history |
| **Subscriptions** | Freemium core workflow; paid tiers for speed, extension, and convenience |

### What we are not (yet)

- A job board aggregator  
- A two-sided hiring marketplace  
- Auto-click LinkedIn Easy Apply  
- An in-app inbox (reply tracking is on the roadmap; send + status tracking ship today)  

---

## Who we serve

| Persona | Behavior | What they need from One Tap |
| --- | --- | --- |
| **Volume Alex** | 10–50 applications/week | Speed, reliable send, minimal friction per apply |
| **Careful Casey** | Selective, quality-focused applies | Review drafts, fix missing contacts, control before send |
| **Builder Blake** | Technical, cost-conscious | BYOK, credential chain, audit trail, transparent status |

**Primary market:** English-speaking job seekers applying via email outreach (India-first pricing; global workflow).

---

## How we're different

### Positioning

> **One Tap** — apply faster, stay organized, apply smarter.

Not: “AI email generator.” Not: “sales CRM for candidates.” Not: “résumé keyword stuffing.”

### Three pillars

| Pillar | Promise |
| --- | --- |
| **Apply faster** | One-tap flows, less copy-paste, async automation |
| **Stay organized** | Every application, status, and action in one place |
| **Apply smarter** | Learn what actually gets interviews (intelligence layer on the roadmap) |

### Principles we will not compromise

1. **User-owned channels** — Applications send from the user’s Gmail, not a black-box sender  
2. **Never paywall the core apply path** — Free tier must complete the full workflow; paid tiers sell speed, convenience, and intelligence  
3. **Honest status** — No fake “sent” states; clear processing, review, failure, and retry semantics  
4. **Your data stays yours** — BYOK option; no reading the user’s inbox beyond what is required to send  
5. **Judgment stays with the user** — Auto-apply is optional; review-before-send is always available  

### Moat (how advantage compounds)

| Horizon | Expansion |
| --- | --- |
| **Today** | One-tap apply + reliable tracking |
| **6 months** | LinkedIn extension maturity + cross-channel tracking |
| **12 months** | Intelligence loops—tone, JD compliance, profile routing, multi-résumé selection |
| **24 months** | Outcome-linked dataset from application telemetry (what gets replies and interviews) |

One Tap is building the **operating system for modern job seekers**: apply in seconds, manage every application in one place, and use real-world application intelligence to improve interview odds over time.

---

## Business model

**Freemium, outcome-focused.**

| Plan | For whom | Value |
| --- | --- | --- |
| **Free (BYOK)** | Users comfortable with their own AI key | Full apply workflow, generous limits |
| **Managed** | Users who want zero AI setup | One Tap runs AI; fastest path to first send |
| **Pro (roadmap)** | Volume seekers | Extension, multi-résumé, analytics, priority queue |

**Guiding rule:** Never force payment to successfully apply. Paid plans mean faster, smarter, and less setup friction—not access to basic send capability.

Payments are secured by Razorpay.

---

## Vision

### Near term — validate the core loop

Prove that active job seekers will:

- Complete setup (AI → résumé → profile → Gmail) without abandoning  
- Apply to **real** jobs through One Tap—not demos  
- Trust async status and return to track applications  
- Pay for convenience (managed AI, extension, speed) once the free loop works  

**North Star (today):** Applications successfully sent.

### Medium term — become the default application hub

- Guided onboarding with resumable steps  
- LinkedIn extension as a primary acquisition and apply surface  
- Multi-résumé profiles with automatic JD-based selection  
- JD instruction compliance (subject format, required fields from posting)  
- Recruiter response tracking → shift North Star to **recruiter response rate**  

### Long term — career operating system

- Intelligence that improves with volume: which tone, structure, and profile signals correlate with replies  
- Analytics that answer “what is working in my search?”—not vanity metrics  
- Cross-channel apply and track (email today; more channels as users need them)  
- Outcome-linked dataset that makes every application make the next one smarter  

**End state:** Configure once, apply many times, see honest status for every attempt, and continuously improve your odds—without rebuilding your workflow every Monday.

---

## What we want to validate

Use this document as the frame for customer discovery, investor conversations, and early-user feedback.

| Question | Signal we're looking for |
| --- | --- |
| Is the pain real? | Users already apply 10+ times/week and feel the overhead |
| Does the workflow fit? | Users complete setup and send at least one real application |
| Do they trust it? | Users rely on status, retry failures, and return to the applications list |
| Will they pay? | Users choose managed AI or Pro features after the free loop works |
| What breaks? | Setup order, missing contacts, AI failures, extension detection—prioritize from real sessions |

We are **not** optimizing for signups alone. We are optimizing for **applications sent to real jobs** and repeat usage within a search cycle.

---

## Success metrics

| Metric | Why |
| --- | --- |
| **Applications sent** | Core value delivered (current North Star) |
| **Setup completion rate** | Onboarding works end-to-end |
| **Time to first sent application** | Time-to-value after sign-up |
| **Weekly active appliers** | Habit, not one-off trial |
| **Send success rate** | Pipeline reliability |
| **Needs-review → sent conversion** | Recovery path works when contact is missing |
| **Recruiter response rate** | Future North Star when reply tracking ships |

---

## Product experience (summary)

```
Sign in (Google)
    → Setup: AI → Résumé → Profile → Gmail
    → Apply: paste JD or extension on LinkedIn
    → Queue: parse · match · draft email
    → Send via Gmail (or needs review if no contact)
    → Track: applications list with live status
    → Retry / continue on failure or missing email
```

**User-facing statuses:** Processing · Sending · Ready · Needs review · Sent · Failed · Cancelled

A failed *attempt* may retry as a new execution without losing the application record.

---

## Why now

- LLMs make personalized outreach scalable for the first time—but only if wrapped in a reliable send-and-track workflow  
- Job seekers are applying at higher volume in competitive markets; tooling has not kept up  
- Gmail + BYOK keeps COGS low and trust high while we validate demand  
- Chrome extensions unlock LinkedIn-native apply without fighting platform UI  

---

## Summary

| | |
| --- | --- |
| **Problem** | High-volume job search is repetitive, fragmented, and hard to track |
| **Solution** | One Tap: paste JD or click on LinkedIn → tailored email from your Gmail → every application organized |
| **Today** | Async apply pipeline, match scoring, tracking, extension, BYOK/managed AI, subscriptions |
| **Vision** | The operating system for modern job seekers—apply in seconds, manage everything in one place, improve with real outcomes |
| **Validation goal** | Real applications sent, repeat usage, willingness to pay for speed and convenience |

---

*For implementation detail, see [docs/product/PRD.md](docs/product/PRD.md). For engineering architecture, see [docs/README.md](docs/README.md).*
