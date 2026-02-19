
# Investigation Results: Why Hospital Systems Score 10-18

## Root Cause Found

The low scores are **not a scoring algorithm bug** -- they're a **data display bug**. The dashboard is showing scores from the **wrong ICP**.

### Two Score Sets Exist Per Account

Each account has two score rows in the `scores` table:

| Org | ICP Used | CommonSpirit | AdventHealth | Alberta Health |
|-----|----------|-------------|-------------|----------------|
| Parent (`726a0dc0`) | Enterprise Technology & Data Infrastructure | **10** | **70** | **18** |
| Child (`cd592f73`) | 91.Life Heart+ Hospital ICP | **85** | **93** | **50** |

The dashboard currently shows the **parent org scores** (10-18) because of an org ID mismatch in the data-fetching layer.

### Why The Parent Org Scores Are Low

When scored against the "Enterprise Technology" ICP, hospitals fail because:
- **Industry**: "Hospitals & Physicians Clinics" does not match tech-focused industries (0/20 pts)
- **Segment**: No vertical filters/segments defined in Enterprise Tech ICP (0/30 pts)
- **Revenue**: "$10B+" not in Enterprise Tech revenue ranges (0/20 pts)
- **Size**: 175,000 employees exceeds Enterprise Tech company_sizes max of 10,000 (0/15 pts)
- Only **Geography** matches (10/10 pts for US)

### Why The Child Org Scores Are Correct

When scored against the Healthcare ICP (which is the intended one):
- CommonSpirit: 85 (industry 20 + segment 30 + revenue 20 + geo 10 + boost 5)
- AdventHealth: 93 (industry 20 + segment 30 + revenue 20 + geo 10 + size 8 + boost 5)
- Alberta Health: 50 (revenue 20 + segment 30 + size 0 + geo 0 [Canada, ICP says US only])

## The Fix

### File: `src/hooks/use-infinite-accounts.tsx`

The hook accepts an `orgId` parameter (line 65) and uses it for **both** account queries and score queries. But accounts live in the parent org while scores live in the child org.

**Change needed**: Add a separate `scoreOrgId` parameter (or derive it internally) so that:
- Accounts are fetched with `dataOrgId` (parent org -- where accounts live)
- Scores are fetched with `effectiveOrgId` (child org -- where ICP scores live)

Specifically, line 305:
```
// BEFORE (wrong):
.eq('org_id', orgId)    // orgId = dataOrgId = parent org

// AFTER (correct):
.eq('org_id', scoreOrgId)  // scoreOrgId = effectiveOrgId = child org
```

### File: `src/pages/Accounts.tsx`

Pass both org IDs to the hook:
- `orgId` (for accounts) = `dataOrgId` (parent, already correct)
- `scoreOrgId` (for scores) = `effectiveOrgId` (child org)

### Impact

- 39,928 accounts already have correct scores in the child org
- No re-scoring needed
- Dashboard will immediately show correct scores once the org ID fix is applied
- CommonSpirit goes from 10 to 85, AdventHealth from 70 to 93, etc.

### Alberta Health Services (score: 50)

Even with the correct ICP, Alberta Health scores 50 because:
- **Geography**: 0 pts -- Canada is not in the ICP (US only). Consider adding Canada to the ICP geographies if Canadian hospitals are targets.
- **Industry**: 0 pts -- "Hospitals and Health Care" doesn't match any ICP industry string (the ICP has "Hospitals & Physicians Clinics", "Hospital & Health Systems", etc. but not "Hospitals and Health Care"). This is a normalization gap.
- **Size**: 0 pts -- employee_count 10,001 exceeds ICP max of 500. The ICP company_sizes [30-500] are too small for large health systems.
- **Segment**: 30 pts -- bed_count 39,803 matches "Academic Medical Centers" (300-1000+)
- **Revenue**: 20 pts -- "$10B+" matches ICP revenue ranges

### Optional: ICP Tuning Recommendations

To improve scores for large hospital systems beyond the display fix:
1. Add "Hospitals and Health Care" to ICP industries (fixes industry matching for 20+ accounts)
2. Add Canada, United Kingdom to ICP geographies if those markets matter
3. Increase ICP company_sizes to include larger employee counts (e.g., add 1000, 5000, 10000) for enterprise health systems
