# CRM Auto-Sync Cron Job Setup Instructions

This guide will help you set up automatic syncing for your Salesforce and HubSpot integrations.

## Prerequisites

- Active Supabase project
- At least one CRM integration (Salesforce or HubSpot) configured
- Access to Supabase SQL Editor

## Setup Steps

### 1. Navigate to Supabase SQL Editor

Go to your Supabase Dashboard → SQL Editor:
https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/sql

### 2. Run the Cron Setup SQL

Copy and paste the entire contents of `CRON_SETUP.sql` into the SQL Editor and execute it.

This will:
- Enable the `pg_cron` and `pg_net` extensions
- Create an hourly cron job that checks for integrations to sync
- Set up the job to call the `scheduled-crm-sync` edge function

### 3. Configure Sync Frequency

In your application:

1. Go to **Settings → External Integrations**
2. Click **Configure** on your Salesforce or HubSpot integration
3. Select your desired **Auto-Sync Frequency**:
   - **Manual only**: No automatic syncing (default)
   - **Every hour**: Syncs every hour on the hour
   - **Daily at 2 AM**: Syncs once per day at 2 AM
   - **Weekly (Monday at 2 AM)**: Syncs once per week on Monday at 2 AM
4. Click **Save Configuration**

## How It Works

### Sync Frequency Logic

The cron job runs **every hour**. When it runs:

1. It queries all active CRM integrations (Salesforce/HubSpot)
2. For each integration, it checks the `sync_frequency` setting:
   - **hourly**: Syncs immediately
   - **daily**: Only syncs if current time is 2 AM
   - **weekly**: Only syncs if current day is Monday AND time is 2 AM
   - **manual**: Skipped (never auto-syncs)
3. For integrations that should sync, it calls the appropriate sync function
4. Records the sync results in `integration_sync_logs`

### Edge Functions Involved

- **`scheduled-crm-sync`**: Main cron job handler (runs every hour)
- **`salesforce-sync`**: Syncs Salesforce data (called by scheduled-crm-sync)
- **`hubspot-sync`**: Syncs HubSpot data (called by scheduled-crm-sync)

## Monitoring

### View Cron Job Status

```sql
-- Check if cron job exists
SELECT * FROM cron.job WHERE jobname = 'crm-auto-sync-hourly';

-- View last 10 cron job runs
SELECT * 
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'crm-auto-sync-hourly')
ORDER BY start_time DESC 
LIMIT 10;
```

### View Sync Logs

Check the integration_sync_logs table:

```sql
SELECT * 
FROM integration_sync_logs 
ORDER BY started_at DESC 
LIMIT 20;
```

### View Edge Function Logs

Go to Supabase Dashboard → Edge Functions → scheduled-crm-sync → Logs:
https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions/scheduled-crm-sync/logs

## Manual Testing

To test the sync immediately without waiting for the cron:

1. Go to Supabase Dashboard → SQL Editor
2. Run this command:

```sql
SELECT net.http_post(
  url := 'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/scheduled-crm-sync',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM"}'::jsonb,
  body := '{"timestamp": "manual-test"}'::jsonb
);
```

This will trigger the sync immediately and you can check the logs to see the results.

## Troubleshooting

### Cron job not running

1. Check if `pg_cron` extension is enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. Verify the cron schedule:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'crm-auto-sync-hourly';
   ```

### Syncs not happening

1. Check that your integration has `sync_frequency` set (not `manual`)
2. Verify the integration status is `active`
3. Check edge function logs for errors
4. Verify credentials are still valid

### Disabling Auto-Sync

To temporarily disable auto-sync:

**Option 1**: Set sync frequency to "Manual only" in the UI

**Option 2**: Delete the cron job:
```sql
SELECT cron.unschedule('crm-auto-sync-hourly');
```

To re-enable, run the setup SQL again.

## Performance Notes

- Syncs are incremental by default (only new/updated records)
- Each integration syncs independently
- Failed syncs don't block other integrations
- Sync duration depends on data volume

## Security

- The cron job uses the Supabase anon key (safe for server-side use)
- The `scheduled-crm-sync` function has `verify_jwt = false` to allow cron access
- All sync operations still respect org-level data isolation
- Credentials are stored encrypted in the database
