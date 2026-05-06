-- ============================================================================
-- Migration 005: Authentication and User Ownership
-- ============================================================================

-- Enable pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add user_id to resumes table
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);

-- Add user_id to job_descriptions table
ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_job_descriptions_user_id ON job_descriptions(user_id);

-- Add user_id to applications table
ALTER TABLE applications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);

-- Add user_id to user_email_credentials table
-- Note: user_email_credentials already has user_id as primary key, just add FK constraint if needed
-- The table already has user_id as PK, so we just need to ensure it references users(id)
ALTER TABLE user_email_credentials 
  ADD CONSTRAINT fk_user_email_credentials_user_id 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
