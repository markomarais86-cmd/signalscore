

## Fix Slide Data Accuracy

### The Problem

The slides display data from the `generate-board-report` edge function, but for orgs where accounts haven't been fully enriched, several slides show poor or missing information:

1. **Top Prospects** show raw UUIDs/internal IDs instead of company names (because `accounts.name` is null, the code falls back to `account_external_id`)
2. **Industry Breakdown** is completely empty (the edge function query filters out accounts where `industry_norm IS NULL`)
3. **Geography Distribution** is completely empty (same filtering for `country IS NULL`)

### Root Cause

The edge function queries at lines 69-76 of `generate-board-report/index.ts` explicitly exclude accounts without enriched data:

- Industry query: `.not("industry_norm", "is", null)` -- excludes un-enriched accounts
- Geography query: `.not("country", "is", null)` -- same

For Top Prospects, the fallback `acct?.name || s.account_external_id` shows the raw external ID when the account record has no name.

### Proposed Fixes

#### 1. Top Prospects: Show domain-based names instead of raw IDs

In the edge function, improve the fallback name logic. Instead of showing raw UUIDs, extract a readable name from `external_id` when it follows the `lp-domain.com` pattern, or show "Unnamed Account" for truly random IDs.

**File:** `supabase/functions/generate-board-report/index.ts`
- Change line 232 from `name: acct?.name || s.account_external_id`
- To a smarter fallback that extracts domain names from `lp-*` prefixed IDs (e.g., `lp-childrenscolorado.org` becomes `childrenscolorado.org`) and labels UUID-style IDs as "Account #N"

#### 2. Industry Breakdown: Include "Unknown" category for un-enriched accounts

Instead of filtering out accounts with no industry, count them as "Unknown / Not Enriched" so the chart still shows useful distribution data.

**File:** `supabase/functions/generate-board-report/index.ts`
- Change the `accountsWithIndustry` query (line 69-70) to remove the `.not("industry_norm", "is", null)` filter
- The existing code already handles `a.industry_norm || "Unknown"` at line 117, but currently the filtered query prevents Unknown from appearing
- Add the Unknown category back so the chart shows the proportion of enriched vs. un-enriched accounts

#### 3. Geography Distribution: Include "Unknown" category

Same approach as industry -- include accounts without country data as "Unknown".

**File:** `supabase/functions/generate-board-report/index.ts`
- Change the `accountsForGeo` query (line 74-75) to remove the `.not("country", "is", null)` filter
- The existing code at line 164 already handles `a.country || "Unknown"`

#### 4. Filter "Unknown" from chart display (optional improvement)

In the slide components, optionally filter out the "Unknown" category from the visual chart but show a note like "X accounts not yet enriched" so users understand the gap without cluttering the chart.

**Files:**
- `src/components/slides/slides/IndustrySlide.tsx` -- filter "Unknown" from bar chart, show enrichment note
- `src/components/slides/slides/GeographySlide.tsx` -- filter "Unknown" from table, show enrichment note

### Implementation Steps

1. Update `generate-board-report` edge function:
   - Remove NULL filters on industry and geography queries
   - Improve prospect name fallback logic
2. Redeploy the edge function
3. Update IndustrySlide and GeographySlide to handle "Unknown" entries gracefully
4. Test with the 91.Life org to verify improved output

### Technical Details

The edge function changes are minimal -- removing two `.not()` filters and improving one name fallback. The slide component changes add a small enrichment status note. No new dependencies or tables needed.

