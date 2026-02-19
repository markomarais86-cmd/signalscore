

# Auto-Provisioning New Clients and API Credit Alerts

## Problem 1: Adding a New Child Org is Incomplete

When you onboard a new client via the AI Customer Onboarding dialog, the system creates the organization and ICP profile, but 5 critical things are NOT auto-provisioned:

- Agent registry entries (the `ai_agent_registry` table) -- without these, the scheduled-agent-runner skips the org entirely
- The `enrich-bed-counts` cron is hardcoded to org `726a0dc0` -- a new org would never get bed count enrichment
- No `external_data_sources` record is created for the new org
- No default alerts are created

**What already works for multi-org:**
- `auto-score-accounts-daily` (cron 10): Loops over ALL orgs -- new orgs get scored automatically
- `auto-match-leads-daily` (cron 3): Calls a function that processes all orgs
- `weekly-quality-snapshot` (cron 5): Calls a function that processes all orgs
- `scheduled-agent-runner` (cron 6): Loops over agent registry entries (works IF entries exist)
- `job-auto-recovery` (cron 9): Global, not org-specific

## Problem 2: No API Credit Monitoring

The alerting system (`check-alerts` + `send-alert`) exists and supports Slack/webhook notifications, but:
- The `alerts` table is empty -- zero alerts configured for any org
- The alert types only cover deal metrics (velocity_drop, win_rate_decline, slippage, etc.)
- There is no `api_credits_low` alert type
- `external_data_sources` tracks `credits_remaining` but nothing watches it
- The Perplexity outage went unnoticed because `service_health` circuit breaker only trips after repeated failures, and doesn't proactively notify admins

## Solution

### Part 1: Auto-Provision Edge Function

Create a new `provision-org` edge function that runs after org creation. It will:

1. Register the 4 core agents in `ai_agent_registry` for the new org
2. Create a default `external_data_sources` record (Apollo provider)
3. Create default API credit alerts (low credits, service down)
4. Update `enrich-bed-counts` cron to loop over all orgs (like auto-score already does)

### Part 2: Extend Alerts for API Credits

Add two new alert types to `check-alerts`:

- `api_credits_low`: Fires when `credits_remaining` in `external_data_sources` drops below threshold (e.g., 10% of limit)
- `service_degraded`: Fires when `service_health` shows circuit open or failure_count above threshold

### Part 3: Hook Into Onboarding Flow

Update `parse-icp-document` to call `provision-org` after creating the org + ICP, so everything is set up automatically.

### Part 4: Fix Hardcoded Cron

Update the `enrich-bed-counts` cron to loop over all orgs (same pattern as auto-score-accounts-daily) instead of being hardcoded to a single org ID.

---

## Technical Details

### New Edge Function: `provision-org`

```
Input: { org_id: string }
Actions:
  1. INSERT into ai_agent_registry: lead_qualification, data_enrichment, follow_up, meeting_scheduler
  2. UPSERT into external_data_sources: apollo provider with api_key_configured=false
  3. INSERT into alerts: api_credits_low alert with default threshold (100 credits)
  4. INSERT into alerts: service_degraded alert with default threshold (3 failures)
```

### Updated `check-alerts` -- New Alert Types

Add to the `evaluateAlert` switch:
- `api_credits_low`: Query `external_data_sources` for `credits_remaining`, compare against threshold
- `service_degraded`: Query `service_health` for `failure_count`, compare against threshold

### Updated `parse-icp-document`

After successfully creating org + ICP (around line 202), invoke `provision-org`:
```
await fetch(`${supabaseUrl}/functions/v1/provision-org`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ org_id: effectiveOrgId })
});
```

### Cron Fix: `enrich-bed-counts-loop`

Replace the hardcoded org_id with a loop over all orgs:
```sql
SELECT cron.unschedule('enrich-bed-counts-loop');
SELECT cron.schedule(
  'enrich-bed-counts-loop',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := '...supabase.co/functions/v1/enrich-bed-counts',
    headers := '...'::jsonb,
    body := jsonb_build_object('org_id', id, 'batch_size', 200, 'triggered_by', 'scheduled')
  ) FROM public.organizations;
  $$
);
```

### Default Alerts Created Per Org

| Alert | Type | Threshold | Operator | Channels |
|-------|------|-----------|----------|----------|
| Low API Credits | api_credits_low | 100 | lt | webhook, slack |
| Service Degraded | service_degraded | 3 | gte | webhook, slack |

### File Changes Summary

| File | Change |
|------|--------|
| `supabase/functions/provision-org/index.ts` | New -- auto-provisions agents, data sources, alerts |
| `supabase/functions/parse-icp-document/index.ts` | Call provision-org after org creation |
| `supabase/functions/check-alerts/index.ts` | Add api_credits_low and service_degraded alert types |
| Migration SQL | Fix enrich-bed-counts cron to loop over all orgs |

