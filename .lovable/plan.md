

# Backend Infrastructure for 70K Accounts & 500K Leads

## Current State Analysis

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Accounts | 14,361 | 70,000 | 5x scale |
| Leads | 53,298 | 500,000 | 10x scale |
| Scores | 14,361 | 70,000 | Already 1:1 with accounts |
| Enrichment Cache | 0 | ~70,000 | Empty - not being utilized |
| Materialized Views | 6 | 6 | Good - already deployed |

## What's Working Well

1. **Materialized Views**: 6 pre-computed views exist for dashboard metrics
2. **Bulk Scoring**: Background job processing with `EdgeRuntime.waitUntil`
3. **Lead Matching**: Batched processing (2,000 at a time, up to 100K leads)
4. **Job Auto-Recovery**: Handles stuck jobs with 3 retry attempts
5. **Idempotency**: Prevents duplicate bulk operations

## Critical Gaps for Enterprise Scale

### Gap 1: Enrichment Cache is Empty (0 entries)

The `enrichment_cache` table exists but has never been populated. This means:
- Every enrichment call hits external APIs (expensive & slow)
- No "already have it" benefit when users enrich accounts

**Solution**: Pre-warm enrichment cache during data import

### Gap 2: No Background Pre-Computation Jobs

Currently, scoring and enrichment only happen when users explicitly trigger them. For "already have it" experience:
- Scores should be pre-computed after CRM sync
- Enrichment should run automatically for high-value accounts

**Solution**: Add trigger-based pre-computation

### Gap 3: Lead Matching Has 100K Safety Limit

The `match-leads-to-accounts` function has a hardcoded safety limit:
```typescript
while (hasMore && batchCount < 50) { // Max 50 batches = 100K leads
```

**Solution**: Increase limit or make it configurable

### Gap 4: No Scheduled Cache Refresh

Materialized views exist but only refresh on-demand. For consistent performance:
- Dashboard caches should refresh every 15 minutes
- Score distributions should refresh after bulk operations

---

## Implementation Plan

### Phase 1: Pre-Warm Enrichment Cache (Immediate Value)

Add enrichment cache warming after CRM sync and bulk upload:

**File**: `supabase/functions/salesforce-sync/index.ts`
```typescript
// After sync completes, queue enrichment for new accounts
EdgeRuntime.waitUntil(
  prewarmEnrichmentCache(supabase, org_id, newAccountDomains)
);
```

**New Function**: `supabase/functions/prewarm-enrichment-cache/index.ts`
- Accepts array of domains to pre-enrich
- Uses enrichment cache module to store results
- Runs in background with rate limiting (10 req/sec)
- Prioritizes high-value accounts (from CRM) over imported data

### Phase 2: Automatic Post-Import Scoring

**File**: `supabase/functions/match-leads-to-accounts/index.ts`
```typescript
// After matching completes, auto-score new accounts
EdgeRuntime.waitUntil(
  supabase.functions.invoke('bulk-score-accounts', {
    body: { org_id, account_ids: newlyCreatedAccountIds }
  })
);
```

### Phase 3: Increase Lead Matching Limit

**File**: `supabase/functions/match-leads-to-accounts/index.ts`
```typescript
// Change from:
while (hasMore && batchCount < 50) { // 100K limit

// To:
const MAX_BATCHES = 250; // 500K leads (2000 per batch)
while (hasMore && batchCount < MAX_BATCHES) {
```

### Phase 4: Scheduled Cache Refresh

**New Function**: `supabase/functions/scheduled-cache-refresh/index.ts`
- Runs every 15 minutes via Supabase cron
- Refreshes: `dashboard_metrics_cache`, `leads_metrics_cache`
- Only refreshes if data changed (check row counts)

**Database Trigger** (alternative):
```sql
-- Auto-refresh caches after significant changes
CREATE OR REPLACE FUNCTION refresh_caches_on_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only refresh if more than 100 rows changed
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    PERFORM refresh_dashboard_caches();
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_cache_refresh
AFTER INSERT OR UPDATE ON accounts
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_caches_on_change();
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/prewarm-enrichment-cache/index.ts` | Create | Background cache warming |
| `supabase/functions/scheduled-cache-refresh/index.ts` | Create | Periodic materialized view refresh |
| `supabase/functions/match-leads-to-accounts/index.ts` | Modify | Increase 100K → 500K limit |
| `supabase/functions/salesforce-sync/index.ts` | Modify | Trigger pre-warming after sync |
| `supabase/functions/bulk-upload/index.ts` | Modify | Trigger pre-warming after upload |
| `supabase/migrations/xxx.sql` | Create | Add cache refresh triggers |

---

## Technical Details

### Pre-Warm Cache Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ CRM Sync        │────▶│ prewarm-cache    │────▶│ enrichment_cache│
│ Bulk Upload     │     │ (background)     │     │ (30-day TTL)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │ Rate Limiter     │
                        │ 10 req/sec       │
                        └──────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │ Perplexity/      │
                        │ Firecrawl/PDL    │
                        └──────────────────┘
```

### Priority Queue for Enrichment

```typescript
// Prioritize by potential value
const priorityOrder = [
  'crm_opportunity', // Has CRM opportunity → highest priority
  'crm_contact',     // Has CRM contact
  'crm_account',     // CRM account
  'high_score',      // Score ≥ 70
  'medium_score',    // Score 40-69
  'imported',        // Bulk imported
];
```

### Estimated Processing Times (70K Accounts)

| Operation | Time @ 10/sec | Time @ 50/sec (parallel) |
|-----------|---------------|--------------------------|
| Basic Enrichment | ~2 hours | ~25 minutes |
| Full Waterfall | ~20 hours | ~4 hours |
| Scoring Only | ~12 minutes | ~3 minutes |
| Lead Matching (500K) | ~25 minutes | ~5 minutes |

---

## Expected Outcomes

After implementation:

1. **Users pull accounts** → Scores already computed, instant display
2. **Users enrich** → Cache hits for 80%+ of domains, 10x faster
3. **Dashboard loads** → Materialized views serve instant metrics
4. **500K leads imported** → Matched and scored within 30 minutes
5. **CRM syncs** → Auto-enrichment starts in background

---

## Monitoring & Validation

### Health Check Queries

```sql
-- Cache hit rate
SELECT 
  COUNT(*) FILTER (WHERE hit_count > 0) * 100.0 / COUNT(*) as hit_rate_pct,
  COUNT(*) as total_cached
FROM enrichment_cache 
WHERE expires_at > NOW();

-- Materialized view freshness
SELECT 
  matviewname,
  pg_stat_all_tables.n_live_tup as rows,
  pg_stat_all_tables.last_vacuum as last_refresh
FROM pg_matviews
JOIN pg_stat_all_tables ON matviewname = relname
WHERE schemaname = 'public';

-- Processing queue depth
SELECT 
  status, 
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (NOW() - created_at))) as avg_age_seconds
FROM enrichment_jobs
GROUP BY status;
```

### Alerts to Add

- Cache hit rate drops below 50%
- Materialized views older than 30 minutes
- Processing queue > 10,000 pending records

