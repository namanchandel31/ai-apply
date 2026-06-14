-- Ensure "Email sent" tracker status exists for users and backfill sent applications.
UPDATE users
SET tracker_status_options = jsonb_build_array(
  jsonb_build_object('id', 'ts_email_sent', 'name', 'Email sent', 'color', 'green')
) || COALESCE(
  tracker_status_options,
  '[]'::jsonb
)
WHERE NOT EXISTS (
  SELECT 1
  FROM jsonb_array_elements(COALESCE(tracker_status_options, '[]'::jsonb)) AS opt
  WHERE opt->>'id' = 'ts_email_sent'
);

UPDATE applications
SET tracker_status_id = 'ts_email_sent'
WHERE application_status = 'sent'::application_status_enum
  AND (tracker_status_id IS NULL OR tracker_status_id = '');
