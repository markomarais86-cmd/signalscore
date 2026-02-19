

# Fix job-auto-recovery Cron: Expired Anon Key

## Problem

The `job-auto-recovery-cron` scheduled in migration `20251217184639` uses an **old/expired anon key**:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1MzE1NzUsImV4cCI6MjA1NjEwNzU3NX0.u_q8t9gWuKFCnP2CtMSu8zJo3aVQ5B_4cTHCJNn_l2Q
```

The current valid anon key (from `.env`) is:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM
```

Every 5 minutes, the cron fires but the edge function rejects the request with a 401, so stalled/failed jobs are never automatically recovered.

## Fix

Run a SQL statement (via the Supabase SQL editor, not a migration -- since it contains project-specific keys) to:

1. **Unschedule** the old cron job
2. **Re-schedule** with the correct anon key

```sql
-- Remove the old cron job with expired key
SELECT cron.unschedule('job-auto-recovery-cron');

-- Re-create with current anon key
SELECT cron.schedule(
  'job-auto-recovery-cron',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/job-auto-recovery',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

This will be executed via the database migration tool (which handles user approval), ensuring the self-healing cron works with the current project credentials.

