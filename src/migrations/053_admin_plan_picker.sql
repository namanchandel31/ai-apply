-- Admin plan picker: link marketing bullets to catalog, multi-price ordering.

ALTER TABLE feature_definitions
  ADD COLUMN IF NOT EXISTS show_in_plan_picker BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE plan_features
  ADD COLUMN IF NOT EXISTS feature_id UUID REFERENCES feature_definitions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_features_plan_feature_id
  ON plan_features (plan_id, feature_id)
  WHERE feature_id IS NOT NULL;

ALTER TABLE plan_price_points
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

UPDATE feature_definitions
SET show_in_plan_picker = TRUE
WHERE type = 'boolean'
  AND key IN (
    'can_use_byok',
    'can_use_managed_ai',
    'can_bulk_apply',
    'can_generate_cover_letter',
    'priority_processing'
  );

INSERT INTO app_settings (key, value) VALUES
  ('single_popular_plan', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Backfill feature_id on plan_features from matching catalog display names.
UPDATE plan_features pf
SET feature_id = fd.id
FROM feature_definitions fd
WHERE pf.feature_id IS NULL
  AND pf.label = fd.display_name
  AND fd.show_in_plan_picker = TRUE;
