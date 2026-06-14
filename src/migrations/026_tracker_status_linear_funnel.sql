-- Linear tracker status funnel: migrate legacy interview id and backfill system statuses.

UPDATE applications
SET tracker_status_id = 'ts_first_interview'
WHERE tracker_status_id = 'ts_interview';
