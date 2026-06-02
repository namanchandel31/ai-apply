# P2 — Email Response Tracking & Application Analytics

## Goal

Introduce outcome-based analytics for applications sent through One Tap.

Focus on:

- Reply Rate
- Positive Reply Rate
- Interview Rate
- Response Time
- Email Style Performance

Do NOT implement email open tracking, tracking pixels, or read receipts.

The system should optimize for actual recruiter engagement, not vanity metrics.

---

# Why This Matters

Current system can answer:

```txt
How many applications were sent?
```

P2 should answer:

```txt
Which applications received replies?

Which email styles perform best?

How many interviews were generated?

How long does it take recruiters to respond?
```

This becomes one of the strongest value propositions of One Tap.

---

# Core Metrics

## Reply Rate

Definition:

```txt
Applications that received at least one recruiter reply
/
Applications sent
```

Example:

```txt
100 applications sent

12 received replies

Reply Rate = 12%
```

---

## Positive Reply Rate

Definition:

```txt
Applications with positive recruiter responses
/
Applications sent
```

Examples:

Positive:

- Let's schedule a call
- Can you interview next week?
- We'd like to move forward
- Please share availability

Negative:

- We moved forward with other candidates
- Position has been filled

Neutral:

- Thank you for applying
- Auto acknowledgements

---

## Interview Rate

Definition:

```txt
Applications resulting in interview-related activity
/
Applications sent
```

Examples:

- Recruiter screen
- Technical round
- Assignment request
- Hiring manager call

---

## Average Response Time

Definition:

```txt
First recruiter reply timestamp
-
Application sent timestamp
```

Example:

```txt
Average Response Time

2.4 days
```

---

# Data Model

## New Table

application_replies

```sql
id
application_id
gmail_message_id
gmail_thread_id

sender_email
received_at

reply_text

classification
confidence

created_at
```

Classification values:

```txt
positive
negative
neutral
interview
unknown
```

---

## Application Analytics Fields

Either computed dynamically or cached:

```sql
reply_received BOOLEAN
first_reply_at TIMESTAMP

reply_classification TEXT

response_time_minutes INTEGER
```

---

# Gmail Sync Worker

## New Worker

```txt
gmail-reply-sync-worker
```

Schedule:

```txt
every 15 minutes
```

Flow:

```txt
Applications Sent
        ↓
Fetch Gmail Threads
        ↓
New Messages?
        ↓
Store Replies
        ↓
Classify Reply
        ↓
Update Analytics
```

---

# Gmail Integration

When sending emails, persist:

```sql
gmail_message_id
gmail_thread_id
```

Required for future thread tracking.

When syncing:

```txt
Gmail API
→ Fetch Thread
→ Compare Known Messages
→ Detect New Replies
```

If new recruiter message exists:

```txt
reply_received = true
```

Store reply.

---

# AI Reply Classification

## New Service

replyClassificationService

Input:

```txt
Recruiter reply content
```

Output:

```json
{
  "classification": "positive",
  "confidence": 0.94
}
```

Supported categories:

```txt
positive
negative
neutral
interview
unknown
```

Use a lightweight model.

This does not require expensive reasoning models.

---

# Analytics Dashboard

## New Card

Application Performance

Example:

```txt
Applications Sent      127

Replies                11
Reply Rate             8.7%

Positive Replies       7
Positive Rate          5.5%

Interviews             4
Interview Rate         3.1%

Average Response Time
2.4 days
```

---

# Email Preference Performance

Because generation snapshots already store:

```txt
toneProfile
structureMode
selectedPreset
```

we can measure effectiveness.

Example:

```txt
Recruiter Friendly

Applications: 82
Replies: 10

Reply Rate:
12.1%
```

```txt
Balanced

Applications: 41
Replies: 2

Reply Rate:
4.8%
```

---

# Future Recommendation Engine

Not part of P2 implementation.

However analytics should be designed to support:

```txt
Based on your results:

Recruiter Friendly
generated 38% more recruiter replies
than Balanced.

Recommended for future applications.
```

No automatic switching.

Recommendation only.

---

# Explicitly Out Of Scope

Do NOT implement:

- Email open tracking
- Tracking pixels
- Read receipts
- Image beacons
- Open-rate analytics

Reasons:

- unreliable
- privacy concerns
- poor signal quality
- blocked by many mail providers

The product should optimize for:

```txt
Replies
Interviews
Recruiter Engagement
```

not email opens.

---

# Implementation Order

Phase 1

- Persist Gmail thread/message IDs
- Create reply sync worker
- Store replies

Phase 2

- AI classification service
- Analytics calculations

Phase 3

- Dashboard metrics
- Response-time tracking

Phase 4

- Email style performance analytics
- Recommendation engine foundation

