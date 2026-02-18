

## Fix: ICP Confidence Score, Geography, and Smart Insights

### Root Causes

**1. ICP Confidence showing ~30% (should be ~94%)**

The `useICPScoringStats` hook in `ICPProfileSummaryCard.tsx` queries the `scores` table without a row limit override. Supabase caps results at 1,000 rows by default, but there are **11,618 scores** for this ICP. This causes two problems:
- `scoredAccounts` = 1,000 (truncated) instead of 11,618
- `avgFit` is computed from only the first 1,000 rows (arbitrary subset)

The fix is to **not fetch all rows**. Instead, use a single aggregation query (or an RPC) to get `count(*)`, `avg(fit)`, and `max(computed_at)` in one call.

**2. Geography card empty**

The `useGeographyData` hook calls `get_geography_distribution` RPC with `sourceFilter`. The RPC itself works correctly (verified: returns 27k US accounts, etc.). The likely cause is a **timing/loading issue**: the geography query is gated on `enabled: !!dashboardData`, and if the dashboard metrics RPC times out or returns an error (which the code handles gracefully by not throwing), `dashboardData` may be set but the geography query may not re-trigger. Need to verify the `enabled` condition and ensure it properly triggers.

**3. Smart Insights not populating**

The `useICPInsights` hook has **localStorage caching** with a 15-minute TTL. If a previous call returned empty or errored, that empty result may be cached. Additionally, `generateInsights()` is only called inside a `useEffect` that depends on `dashboardData?.metrics` and `totalScores > 0` -- if the metrics RPC errors/times out, `totalScores` stays 0, and insights never generate.

### Changes

#### File 1: `src/components/executive/ICPProfileSummaryCard.tsx`

Replace the `useICPScoringStats` hook's raw `scores` table query with an aggregation approach:

```typescript
// BEFORE: Fetches up to 1000 rows and computes stats client-side
supabase
  .from('scores')
  .select('fit, computed_at')
  .eq('icp_id', icpId)

// AFTER: Use count + aggregate to avoid the 1000-row limit
// Option A: Use .select('fit.avg(), fit.count(), computed_at.max()')  
// Option B: Use a lightweight RPC
// Option C: Add .limit(0) with count: 'exact' for count, 
//           and a separate .select('fit').limit(1000) for avg sampling

// Recommended: Two small queries in parallel
const [countResult, statsResult] = await Promise.all([
  supabase.from('scores').select('*', { count: 'exact', head: true }).eq('icp_id', icpId),
  supabase.from('scores').select('fit, computed_at').eq('icp_id', icpId)
    .order('computed_at', { ascending: false }).limit(500),
]);
```

The exact count comes from `countResult.count`, avg fit from the 500 most recent scores (representative sample), and `lastScoredAt` from the first row (most recent).

#### File 2: `src/pages/ExecutiveDashboard.tsx`

Ensure insights generation fires even when metrics partially fail:

```typescript
// BEFORE: 
if (totalScores > 0 && effectiveOrgId) {
  generateInsights();
}

// AFTER: Also generate if we have accounts (scores may not be loaded yet)
if ((totalScores > 0 || totalAccounts > 0) && effectiveOrgId) {
  generateInsights();
}
```

#### File 3: `src/hooks/use-icp-insights.tsx`

Add a safety check to not cache empty/error results:

```typescript
// Only cache if we actually got insights
if (data.insights && data.insights.length > 0) {
  localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  localStorage.setItem(timestampKey, timestamp.toString());
}
```

### Summary

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| ICP at 30% | Supabase 1000-row default limit truncates 11,618 scores | Use `head: true` with `count: 'exact'` for accurate count; sample recent scores for avg |
| Geo empty | Likely stale `enabled` condition or source filter mismatch | Verify `enabled` gate; add fallback logging |
| Smart Insights | Cached empty results + `totalScores > 0` gate blocks generation when metrics timeout | Don't cache empty results; relax the trigger condition |

