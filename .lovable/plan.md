

# Board PDF Report Overhaul

## Problems Found

1. **Executive Summary too thin**: One short paragraph. Data Completeness shows 0% despite the dashboard showing 94%. The narrative generator doesn't pull enough context.
2. **ICP Deep Dive is empty**: Page 3 only lists raw profile metadata (company sizes, confidence). It doesn't include fit distribution breakdown, match statistics, or any data from the ICP Performance Matrix.
3. **TAM/Industry/Size data is wrong**: The industry breakdown shows suspiciously round percentages (50%, 10%, 10%...) and company size shows "10000+ = 100%". This data comes from `external_data_sources.industry_breakdown` / `company_size_breakdown` which is external provider data, not your actual scored accounts. The report should use real account data.
4. **Geography numbers inflated**: Page 5 shows 62,765 US accounts but total accounts are only 14,360. The geo RPC returns all-source data including external provider estimates. The report should use actual account geography.
5. **Top 20 Prospects is generic**: All 20 have identical scores (100/50/95). Better to show Top 10 with more context (revenue, lead count, enrichment status).
6. **Pages 7-8 waste space**: AI Insights spill across two pages awkwardly. Page 8 has one leftover insight plus raw action button text ("view_accounts") leaking into the PDF.
7. **Page 9 repeats Page 2**: The "Data Quality Summary" section duplicates the executive summary metrics.

## Plan

### 1. Fix Data Completeness in Executive Summary
**File**: `src/hooks/use-branded-report.ts`
- The `dataCompleteness` field uses `raw?.data_completeness` from the cached dashboard metrics RPC. Investigate why this returns 0 when the DataHealthWidget shows 94%.
- If the RPC doesn't return it, compute it directly from account field coverage (same logic as DataHealthWidget).

### 2. Enrich the Executive Summary Narrative
**File**: `src/utils/branded-pdf-export.ts` (generateNarrative function)
- Add TAM/SAM context: "Your TAM spans X accounts, with Y in your serviceable market."
- Add ICP profile summary: "Your active ICP profile 'Enterprise Technology' matches Z accounts at N% confidence."
- Add geographic headline: "Operations span N countries, with X% concentration in top 3 markets."
- Add lead-to-account context beyond the simple ratio.

### 3. Fix Industry and Size Breakdown to Use Real Account Data
**File**: `src/hooks/use-branded-report.ts`
- Replace `external_data_sources.industry_breakdown` with an aggregation query against the `accounts` table grouped by `industry_norm`.
- Replace `external_data_sources.company_size_breakdown` with an aggregation of `accounts.employee_count` bucketed into size ranges.
- This ensures percentages reflect actual scored accounts, not external provider estimates.

### 4. Fix Geography to Use Scored Accounts Only
**File**: `src/hooks/use-branded-report.ts`
- Pass `p_source_filter: 'database'` instead of `'all'` to `get_geography_distribution` RPC so it only counts real accounts, not external provider estimates.

### 5. Enhance ICP Deep Dive Page
**File**: `src/utils/branded-pdf-export.ts` (Page 3 section)
**File**: `src/hooks/use-branded-report.ts` (add fit distribution data)
- Query fit distribution per ICP (count of high/medium/low fit accounts matching this profile).
- Add to the ICP profile card: target industries list, fit distribution bar (like the exec summary), and top matching accounts (top 5 names).
- Add ICP-level TAM context showing what percentage of total TAM this profile covers.

### 6. Reduce Top Prospects from 20 to 10, Add Detail
**File**: `src/utils/branded-pdf-export.ts` (Page 6 section)
**File**: `src/hooks/use-branded-report.ts`
- Change title to "Top 10 Priority Accounts"
- Add revenue range column and lead count per account
- Fetch `accounts.annual_revenue` and lead count in the join query
- Remove duplicate-score accounts (all showing 100/50/95 suggests scoring isn't differentiating)

### 7. Consolidate AI Insights onto One Page, Remove Waste
**File**: `src/utils/branded-pdf-export.ts` (Pages 7-8)
- Cap insights to top 6 (2 high, 2 medium, 2 low) so they fit on one page
- Strip the `nextAction` field from rendering (it contains internal action IDs like "view_accounts" that leak into the PDF)
- Merge the Risks section (old page 9) onto the same or next page, removing the duplicate Data Quality Summary block

### 8. Remove Redundant Final Page
**File**: `src/utils/branded-pdf-export.ts` (Page 8/9 — Risks section)
- Remove the "Data Quality Summary" block at the bottom of the risks page since it duplicates page 2
- Keep only the Risks and Action Items content
- This brings total pages from 9 down to approximately 7

## Files Changed

| File | Changes |
|------|---------|
| `src/hooks/use-branded-report.ts` | Fix data completeness calc, query real account data for industry/size, fix geo source filter, add per-ICP fit distribution, add revenue/lead data to top prospects |
| `src/utils/branded-pdf-export.ts` | Richer narrative, enhanced ICP page, Top 10 with more columns, cap insights to 6 with no action leaking, remove duplicate data quality summary |

## Expected Result

A tighter 7-page report where:
- Executive Summary is a rich paragraph with real metrics
- ICP Deep Dive shows fit distribution and matching context
- TAM/Industry/Size uses actual account data with accurate percentages
- Geography reflects real accounts only
- Top 10 Accounts with revenue and lead context
- AI Insights on one clean page
- Risks without redundant summary

