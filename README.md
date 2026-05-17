# AI Apply

Automated job application backend with a built-in web UI. Upload a resume and job description, get an AI-generated match score and outreach email, then send it via your Gmail account.

## Features

- **Auth** — JWT signup/login with per-user data isolation
- **Resume parsing** — PDF upload, OpenAI extraction, Supabase storage
- **JD parsing** — Structured fields (title, company, contact, skills)
- **Matching** — Deterministic skill overlap score
- **Email generation** — LLM-drafted subject and body
- **Send** — Gmail SMTP with encrypted app-password storage and send state machine
- **Web UI** — React + shadcn/ui + Tailwind CSS at `http://localhost:5000`

## Quick start

### 1. Prerequisites

- Node.js 18+
- PostgreSQL (or Supabase Postgres)
- [OpenAI API key](https://platform.openai.com/)
- [Supabase](https://supabase.com/) project with a `resumes` storage bucket
- Gmail account with a [16-character app password](https://support.google.com/accounts/answer/185833)

### 2. Install

```bash
npm install
cp .env.example .env
```

### 3. Configure `.env`

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Random secret for JWT signing |
| `OPENAI_API_KEY` | OpenAI API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side storage) |
| `ENCRYPTION_KEY` | 32-byte hex key for credential encryption |

Generate `ENCRYPTION_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Run migrations

```bash
npm run migrate
```

Runs all SQL files in `src/migrations/` in order (`001` … `007`).

### 5. Supabase storage

Create a **public or private** bucket named `resumes`. The API uploads PDFs to `{userId}/{fileHash}.pdf`.

### 6. Build the UI

```bash
cd client && npm install && cd ..
npm run build:ui
```

The Vite build outputs to `public/`. Re-run after UI changes.

### 7. Start the server

```bash
npm run dev
```

Open **http://localhost:5000** for the UI, or **http://localhost:5000/docs** for Swagger (non-production only).

**UI development** (hot reload, API proxied to port 5000):

```bash
# terminal 1
npm run dev

# terminal 2
npm run dev:client
```

Open **http://localhost:5173**

## API overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/signup` | No | Register |
| `POST` | `/auth/login` | No | Login → JWT |
| `POST` | `/api/upload-resume` | Yes | PDF multipart field `resume` |
| `POST` | `/api/upload-jd` | Yes | JSON `{ text, title? }` |
| `POST` | `/api/apply` | Yes | JSON `{ resumeId, jobDescriptionId }` |
| `POST` | `/api/send-application/:applicationId` | Yes | JSON `{ recipientEmail? }` |
| `POST` | `/api/save-email-credentials` | Yes | JSON `{ email, appPassword }` |
| `GET` | `/health` | No | Liveness check |

All authenticated routes use `Authorization: Bearer <token>`.

## Database schema

```
users
├── id (UUID PK)
├── email (unique, case-insensitive)
└── password_hash

resumes
├── id, user_id → users
├── file_name, file_size, file_hash, file_path
└── uploaded_at

parsed_resumes
├── resume_id → resumes
├── raw_text, parsed_json (JSONB)
└── created_at

job_descriptions
├── id, user_id → users
├── title, raw_text
├── company_name, contact_person, contact_email, location, job_type  ← denormalized (007)
└── created_at

parsed_job_descriptions
├── job_description_id → job_descriptions
├── parsed_json (JSONB)
└── created_at

applications
├── id, user_id, resume_id, job_description_id (unique per user)
├── match_score (0–100)
├── email_subject, email_body
├── status ('draft' | 'sent' | 'failed')
├── email_status ('pending' | 'processing' | 'sent' | 'failed' | 'abandoned')
├── retry_count, last_error, smtp_message_id, llm_raw_output
└── processing_started_at, sent_at, failed_at, created_at, updated_at

user_email_credentials
├── user_id → users (PK)
├── email, encrypted_app_password
└── created_at, updated_at

failed_parses
├── file_hash (unique), source_type ('resume' | 'jd')
└── raw_text, error_message
```

Migration **007** copies parsed contact fields onto `job_descriptions` so send/list queries can use `jd.contact_email` without JSONB joins.

## Project structure

```
index.js              Express entry + static UI
client/               React UI (Vite + shadcn + Tailwind)
  src/components/ui/  shadcn components
public/               Built UI assets (from `npm run build:ui`)
src/
  controllers/        Route handlers
  services/           Business logic (LLM, mail, apply)
  models/             Database access
  migrations/         SQL migrations
  middlewares/        Auth, upload, rate limits
  routes/
scripts/migrate.js    Migration runner
tests/
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API with nodemon |
| `npm run dev:client` | Vite dev server (port 5173) |
| `npm run build:ui` | Build React UI to `public/` |
| `npm start` | Production start |
| `npm run migrate` | Run SQL migrations |
| `npm test` | Jest test suite |

## Security notes

- JWTs are stateless (7-day expiry); see `docs/security/replay-attack-limitation.md`
- SMTP app passwords are encrypted at rest with `ENCRYPTION_KEY`
- All resource queries are scoped by `user_id`
- Rate limits apply to upload, apply, and send routes

## License

ISC
