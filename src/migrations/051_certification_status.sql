-- Explicit certification lifecycle for deprecation warnings and OneTap route guards.

ALTER TABLE curated_ai_models
  ADD COLUMN IF NOT EXISTS certification_status TEXT NOT NULL DEFAULT 'certified'
    CHECK (certification_status IN ('certified', 'deprecated', 'revoked'));

UPDATE curated_ai_models
SET certification_status = CASE WHEN is_active THEN 'certified' ELSE 'revoked' END
WHERE certification_status IS NULL OR certification_status = 'certified' AND is_active = FALSE;
