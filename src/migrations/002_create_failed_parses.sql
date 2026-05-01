-- ============================================================================
-- Migration 002: Fallback storage for failed parses
-- ============================================================================

CREATE TABLE IF NOT EXISTS failed_parses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_hash TEXT UNIQUE NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('resume', 'jd')),
  raw_text TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for searching failures by hash
CREATE INDEX IF NOT EXISTS idx_failed_parses_file_hash
  ON failed_parses(file_hash);
