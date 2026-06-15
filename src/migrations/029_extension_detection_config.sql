-- Server-managed LinkedIn detection scoring config (singleton row).
CREATE TABLE IF NOT EXISTS extension_detection_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hiring_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  apply_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocked_email_prefixes JSONB NOT NULL DEFAULT '[]'::jsonb,
  score_email INT NOT NULL DEFAULT 50,
  score_hiring_keyword INT NOT NULL DEFAULT 30,
  score_apply_keyword INT NOT NULL DEFAULT 20,
  threshold INT NOT NULL DEFAULT 70,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO extension_detection_config (
  id,
  hiring_keywords,
  apply_keywords,
  blocked_email_prefixes
)
VALUES (
  1,
  '["hiring","we''re hiring","open role","open position","job opening","now hiring","join our team","looking for"]'::jsonb,
  '["apply","application","resume","cv","send your resume","dm me","email me","reach out"]'::jsonb,
  '["noreply","no-reply","donotreply","mailer-daemon"]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
