# Webhook Retry System Documentation

## Overview

The webhook retry system automatically retries failed Salesforce and HubSpot webhook processing with exponential backoff to ensure no data is lost due to temporary failures.

## How It Works

### 1. Initial Webhook Receipt

When a webhook is received by `salesforce-webhook`:
- It's logged to the `webhook_logs` table
- Processing is attempted immediately
- If successful: `processed = true`, `processed_at` is set
- If failed: `next_retry_at` is set to 1 minute from now

### 2. Automatic Retry Process

The `retry-failed-webhooks` edge function runs every 2 minutes via cron:
- Finds webhooks where `next_retry_at <= now()` and `permanently_failed = false`
- Attempts to reprocess them
- Uses exponential backoff: 2min, 4min, 8min

### 3. Exponential Backoff

Each retry attempt uses exponentially increasing delays:
- **Attempt 1**: 2 minutes (base * 2^0 = 1 * 2 = 2 min)
- **Attempt 2**: 4 minutes (base * 2^1 = 1 * 4 = 4 min)
- **Attempt 3**: 8 minutes (base * 2^2 = 1 * 8 = 8 min)

### 4. Permanent Failure

After `max_retries` attempts (default: 3):
- Webhook is marked `permanently_failed = true`
- No more automatic retry attempts
- Requires manual intervention

## Database Schema

### webhook_logs Table (New Columns)

```sql
retry_count          INTEGER DEFAULT 0          -- Number of retry attempts
max_retries          INTEGER DEFAULT 3          -- Maximum retry attempts
next_retry_at        TIMESTAMP WITH TIME ZONE   -- When to retry next
last_retry_at        TIMESTAMP WITH TIME ZONE   -- Last retry timestamp
permanently_failed   BOOLEAN DEFAULT false      -- Exceeded max retries
failure_reason       TEXT                       -- Reason for failure
```

## Edge Functions

### 1. salesforce-webhook

**Purpose**: Receives webhooks from Salesforce
**JWT Required**: No (public endpoint for Salesforce)
**Retry Logic**: 
- On success: Mark processed
- On failure: Schedule first retry in 1 minute

### 2. retry-failed-webhooks

**Purpose**: Processes webhooks that need retry
**JWT Required**: No (called by cron)
**Cron Schedule**: Every 2 minutes (`*/2 * * * *`)
**Batch Size**: 50 webhooks per run

## Setup Instructions

### 1. Run Database Migration

The migration has already been applied which added:
- New columns to `webhook_logs` table
- Index for efficient retry queries

### 2. Set Up Cron Job

Run `WEBHOOK_RETRY_SETUP.sql` in Supabase SQL Editor:

```sql
SELECT cron.schedule(
  'webhook-retry-job',
  '*/2 * * * *', -- Every 2 minutes
  $$ SELECT net.http_post(...) $$
);
```

### 3. Verify Setup

```sql
-- Check cron job exists
SELECT * FROM cron.job WHERE jobname = 'webhook-retry-job';

-- View pending retries
SELECT * FROM webhook_logs 
WHERE processed = false AND permanently_failed = false
ORDER BY next_retry_at;
```

## Monitoring

### View Statistics

```sql
SELECT 
  COUNT(*) FILTER (WHERE processed = true) as successful,
  COUNT(*) FILTER (WHERE processed = false AND permanently_failed = false) as pending_retry,
  COUNT(*) FILTER (WHERE permanently_failed = true) as permanently_failed,
  AVG(retry_count) FILTER (WHERE processed = true AND retry_count > 0) as avg_retries_until_success
FROM webhook_logs;
```

### View Failed Webhooks

```sql
SELECT 
  id,
  webhook_type,
  object_type,
  action,
  retry_count,
  failure_reason,
  created_at,
  last_retry_at
FROM webhook_logs
WHERE permanently_failed = true
ORDER BY created_at DESC
LIMIT 20;
```

### View Webhooks Pending Retry

```sql
SELECT 
  id,
  webhook_type,
  object_type,
  retry_count,
  max_retries,
  next_retry_at,
  failure_reason
FROM webhook_logs
WHERE processed = false 
  AND permanently_failed = false
  AND next_retry_at IS NOT NULL
ORDER BY next_retry_at;
```

## UI Features

The WebhookLogViewer component shows:
- ✅ **Processed**: Successfully processed webhooks
- 🔄 **Retry Scheduled**: Webhooks waiting for retry (shows attempt count)
- ❌ **Permanently Failed**: Webhooks that exceeded max retries
- ⏳ **Pending**: Webhooks not yet processed or retried

## Manual Intervention

### Manually Retry a Failed Webhook

```sql
-- Reset a permanently failed webhook
UPDATE webhook_logs 
SET 
  next_retry_at = now(),
  permanently_failed = false,
  retry_count = 0,
  failure_reason = NULL
WHERE id = 'webhook-id-here';
```

### Change Max Retries for Specific Webhook

```sql
UPDATE webhook_logs 
SET max_retries = 5  -- Increase from 3 to 5
WHERE id = 'webhook-id-here';
```

### View Cron Job Execution History

```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'webhook-retry-job')
ORDER BY start_time DESC 
LIMIT 10;
```

## Common Failure Reasons

1. **Database Constraints**: Required fields missing in payload
2. **Network Issues**: Temporary connectivity problems
3. **Invalid Data**: Malformed payload data
4. **Missing References**: Foreign key constraint violations

## Best Practices

1. **Monitor permanently failed webhooks** regularly
2. **Investigate failure patterns** to improve data quality
3. **Adjust max_retries** for specific webhook types if needed
4. **Review cron job logs** to ensure it's running smoothly
5. **Set up alerts** for high failure rates

## Performance Considerations

- Cron job processes max 50 webhooks per run (every 2 minutes)
- If backlog exceeds 50, it will be processed over multiple runs
- Each webhook retry is independent (one failure doesn't block others)
- Database index ensures efficient retry queries

## Troubleshooting

### Webhooks Not Retrying

1. Check cron job is running:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'webhook-retry-job';
   ```

2. Check for errors in cron execution:
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE status = 'failed'
   ORDER BY start_time DESC 
   LIMIT 5;
   ```

3. Verify edge function is deployed:
   - Go to Supabase Dashboard → Edge Functions
   - Check `retry-failed-webhooks` status

### High Failure Rate

1. Review common error messages:
   ```sql
   SELECT failure_reason, COUNT(*) 
   FROM webhook_logs 
   WHERE permanently_failed = true
   GROUP BY failure_reason
   ORDER BY COUNT(*) DESC;
   ```

2. Check for data quality issues in Salesforce configuration
3. Verify database constraints are appropriate

## Future Enhancements

- [ ] Configurable retry delays per webhook type
- [ ] Webhook retry alerts via email/Slack
- [ ] Dashboard for retry analytics
- [ ] Automatic dead letter queue for permanently failed webhooks
- [ ] Webhook replay functionality from UI
