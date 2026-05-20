-- Business-only application lifecycle enum (no execution states).
DO $$ BEGIN
  CREATE TYPE application_status_enum AS ENUM (
    'draft',
    'generated',
    'needs_review',
    'sent',
    'failed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
