

## Fix: Resolve Parent Org for Account Queries in Board Report

### Root Cause

The `generate-board-report` edge function queries all data tables using the raw `org_id` passed in the request. For child organizations like 91.Life, accounts are stored under the **parent** org (LaunchPulse), while scores and ICPs are stored under the **child** org. This mismatch causes every account query to return zero rows.

| Data | Stored Under | Should Query With |
|------|-------------|-------------------|
| Accounts, Leads | Parent org (LaunchPulse) | `dataOrgId` (resolved parent) |
| Scores, ICP Profiles | Child org (91.Life) | `orgId` (as-is) |
| Metrics RPC | Handles resolution internally | `orgId` (as-is) |

### The Fix

Add parent org resolution at the top of `fetchAllReportData()`, then use the correct org ID for each query type.

### File: `supabase/functions/generate-board-report/index.ts`

**Step 1: Resolve the data org (parent) before querying**

At the start of `fetchAllReportData`, look up `parent_org_id` from the `organizations` table and use it for account/lead queries:

```text
const { data: orgLookup } = await supabase
  .from('organizations')
  .select('parent_org_id')
  .eq('id', orgId)
  .single();
const dataOrgId = orgLookup?.parent_org_id || orgId;
```

**Step 2: Use `dataOrgId` for account and lead queries**

Change these queries from `.eq("org_id", orgId)` to `.eq("org_id", dataOrgId)`:

- Line 69: `accountsWithIndustry` (industry breakdown)
- Line 71: `accountsForSize` (size breakdown)
- Line 72: `accountsForCompleteness` (data completeness)
- Line 74: `accountsForGeo` (geography distribution)
- Line 76: `accountsForLowData` (low-data count)
- Line 68: `leadsRes` (lead count)
- Line 219: `accountDetails` lookup for top prospects
- Line 221: `leadCounts` for top prospects

**Step 3: Keep `orgId` for org-specific queries**

These must continue using the child org's ID:

- Line 63: `metricsRes` (RPC handles resolution internally)
- Line 64: `icpRes` (ICP profiles belong to child org)
- Line 65: `topScoresRes` (scores stored under child org)
- Line 67: `orgRes` (org name lookup)
- Line 78: `scoresRes` (score map for cross-referencing)
- Line 81: `signalsRes` (signals per child org)
- Line 82: `brandConfigRes` (brand config per child org)

### Expected Result After Fix

| Slide | Before (91.Life) | After |
|-------|------------------|-------|
| Industry Breakdown | "No data available" | Shows industry distribution from parent's 39,928 accounts |
| Geography | "No data available" | Shows country distribution |
| Data Completeness | 0% | Reflects actual enrichment status |
| Top Prospects | UUIDs and "N/A" everywhere | Actual company names, industries, countries |
| Executive Summary | References 0% completeness | Accurate AI-generated analysis |

### Deployment

Redeploy the `generate-board-report` edge function after the change. No database migrations needed.
