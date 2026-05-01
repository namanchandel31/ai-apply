-- ============================================================================
-- Migration 001: Core tables for resume & JD persistence
-- Run once via: node scripts/migrate.js
-- ============================================================================

-- resumes: file metadata + dedup hash
CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_hash TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Unique index on file_hash for O(1) dedup lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_resumes_file_hash
  ON resumes(file_hash);

-- parsed_resumes: LLM-structured output linked to a resume
CREATE TABLE IF NOT EXISTS parsed_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  parsed_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- FK index: avoid seq scan when joining parsed_resumes → resumes
CREATE INDEX IF NOT EXISTS idx_parsed_resumes_resume_id
  ON parsed_resumes(resume_id);

-- GIN index: future JSONB queries on parsed resume data
CREATE INDEX IF NOT EXISTS idx_parsed_resumes_parsed_json
  ON parsed_resumes USING GIN (parsed_json);

-- job_descriptions: raw JD text
CREATE TABLE IF NOT EXISTS job_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  raw_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- parsed_job_descriptions: LLM-structured output linked to a JD
CREATE TABLE IF NOT EXISTS parsed_job_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_description_id UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  parsed_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- FK index: avoid seq scan when joining parsed_jd → job_descriptions
CREATE INDEX IF NOT EXISTS idx_parsed_jd_job_description_id
  ON parsed_job_descriptions(job_description_id);

-- GIN index: future JSONB queries on parsed JD data
CREATE INDEX IF NOT EXISTS idx_parsed_jd_parsed_json
  ON parsed_job_descriptions USING GIN (parsed_json);
