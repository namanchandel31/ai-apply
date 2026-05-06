-- Enable pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (foundation for ownership)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_email_format CHECK (email LIKE '%@%.%')
);

-- Case-insensitive unique email index
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_email_ci ON users (LOWER(email));

-- Core tables with proper UUID foreign keys + CASCADE delete
CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT,
  file_size INTEGER,
  file_hash TEXT NOT NULL,
  file_path TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uniq_user_file_hash UNIQUE (user_id, file_hash)
);

CREATE TABLE IF NOT EXISTS job_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  raw_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parsed data tables with CASCADE delete
CREATE TABLE IF NOT EXISTS parsed_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  raw_text TEXT,
  parsed_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parsed_job_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_description_id UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  parsed_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
