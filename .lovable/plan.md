

# Run AI Technology Insights Enrichment for 91.Life ICP Scoring

## Problem

91.Life needs tech stack data on accounts to score against EHR systems (Epic, Cerner, Athenahealth). Currently only **319 out of 39,928** accounts have `tech_stack` populated. The existing enrichment components have a **child org bug** -- they query accounts using `userProfile.org_id` (91.Life) but the accounts live under the parent org (Launchpulse).

Three components are affected:
- `AITechnologyInsights.tsx` -- uses `userProfile.org_id` to fetch accounts
- `SmartEnrichmentPanel.tsx` -- uses `userProfile.org_id` for all queries
- `enrich-technology-insights` edge function -- receives `orgId` from frontend and queries with it

## Solution

### 1. Fix AITechnologyInsights to use dataOrgId (frontend)

**File: `src/components/AITechnologyInsights.tsx`**

- Import `useEffectiveOrg` hook
- Use `effectiveOrgId` (which resolves to parent org for child orgs) when:
  - Fetching accounts from the `accounts` table (line 43-47)
  - Passing `orgId` to the edge function (line 78)

### 2. Fix SmartEnrichmentPanel to use dataOrgId (frontend)

**File: `src/components/settings/SmartEnrichmentPanel.tsx`**

- Import `useEffectiveOrg` hook
- Replace all `userProfile.org_id` references in database queries with `effectiveOrgId`:
  - `loadDataQuality()` -- 6 queries (lines 53-87)
  - `loadPriorityAccounts()` -- account fetch (line 122)
  - `startBatchEnrichment()` -- `org_id` passed to edge functions (line 175)
  - `startFreeAIEnrichment()` -- job creation and enrichment invocation (lines 227-255)

### 3. Update enrich-technology-insights to persist tech_stack (backend)

**File: `supabase/functions/enrich-technology-insights/index.ts`**

Currently this function generates text insights but does NOT write `tech_stack` back to the `accounts` table. Update it to:

- Modify the AI prompt to also return a structured JSON array of technology names alongside the text analysis
- Parse the tech stack array from the response
- Write the extracted `tech_stack` array back to the `accounts` table (using `account.id` and the provided `orgId`)
- This way, each "Generate Insights" call also fills the tech stack gap

### 4. No database changes needed

The `accounts.tech_stack` column already exists as a `text[]` array. No migration required.

## Technical Details

### AITechnologyInsights.tsx changes

```text
+ import { useEffectiveOrg } from "@/hooks/use-effective-org";

  // Inside component:
+ const { effectiveOrgId } = useEffectiveOrg();

  // Account fetch (line 44):
- .eq('org_id', userProfile.org_id)
+ .eq('org_id', effectiveOrgId)

  // Edge function call (line 78):
- orgId: userProfile.org_id
+ orgId: effectiveOrgId
```

### SmartEnrichmentPanel.tsx changes

Same pattern -- replace all 8 occurrences of `userProfile.org_id` in data queries with `effectiveOrgId`. Keep `userProfile.org_id` only for the `useEffect` dependency and null checks.

### enrich-technology-insights/index.ts changes

Update the AI prompt to request both prose analysis AND a structured `tech_stack` JSON array. After getting the response, parse the array and upsert it:

```text
// After getting AI insights text, extract tech stack:
const techStackMatch = insights.match(/\[.*?\]/s);
let techStack = [];
if (techStackMatch) {
  try { techStack = JSON.parse(techStackMatch[0]); } catch {}
}

// Write back to accounts table:
if (techStack.length > 0) {
  await supabase
    .from('accounts')
    .update({ tech_stack: techStack })
    .eq('external_id', account.external_id)
    .eq('org_id', orgId);
}
```

## Impact

- 91.Life users will be able to trigger tech stack enrichment from the AI Insights panel
- Each enrichment run will both display insights AND persist `tech_stack` data
- ICP scoring against EHR systems (Epic, Cerner) will have actual tech stack data to match against
- SmartEnrichmentPanel will show correct data quality metrics for child orgs

