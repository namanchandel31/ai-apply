-- Intelligent Send Queues: durable per-user FIFO send pacing

CREATE TABLE IF NOT EXISTS send_queue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'dispatched', 'completed', 'cancelled', 'skipped')),
  estimated_send_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_send_queue_entries_user_waiting_fifo
  ON send_queue_entries (user_id, status, created_at ASC, id ASC)
  WHERE status = 'waiting';

CREATE INDEX IF NOT EXISTS idx_send_queue_entries_user_created
  ON send_queue_entries (user_id, created_at);

CREATE TABLE IF NOT EXISTS user_send_schedulers (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  scheduler_state TEXT NOT NULL DEFAULT 'idle'
    CHECK (scheduler_state IN ('active', 'paused', 'idle')),
  next_dispatch_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  last_completed_send_at TIMESTAMPTZ,
  last_scheduler_run_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_send_schedulers_active_due
  ON user_send_schedulers (next_dispatch_at)
  WHERE scheduler_state = 'active';

INSERT INTO feature_definitions (key, display_name, description, type, default_value, category, show_in_plan_picker)
VALUES (
  'can_use_intelligent_send_queues',
  'Intelligent Send Queues',
  'Automatically queues and spaces out your job application emails using randomized send intervals to reduce burst sending and help protect your Gmail account reputation. You can still send any queued application instantly with Send Right Now whenever needed.',
  'boolean',
  'false'::jsonb,
  'applications',
  TRUE
)
ON CONFLICT (key) DO NOTHING;
