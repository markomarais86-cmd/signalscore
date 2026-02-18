
## Fix: Executive Report Slides — Industry Filter, Prospects Detail, and Data Pipeline

### Problems Identified

**1. Industry Breakdown Shows All Industries (Not ICP-Filtered)**

The `generate-board-report` edge function (line 124-142) counts every account's `industry_norm` across all 40,000 accounts. This means "Business Services" (5,763), "Manufacturing" (3,241), "Construction" (985), etc. all appear — even though the 91.life ICP only targets: Healthcare, Hospital & Health Systems, Medical Devices, Health IT, Hospitals & Physicians Clinics, Healthcare Services, Insurance.

The slide should filter to show ICP-relevant industries prominently, with non-ICP industries grouped as "Other."

**2. ICP Column Name Mismatch (Root Cause of Empty AI Context)**

In `generate-board-report/index.ts` line 199-201:
```
targetIndustries: p.target_industries || [],    // WRONG: column is "industries"
geographies: p.target_geographies || [],        // WRONG: column is "geographies"
```
This means the AI narrative generator receives **empty arrays** for ICP industries and geographies, so it cannot generate ICP-aware risk assessments or recommendations. This is why the Risks and Next Steps slides are weak/empty.

**3. Top Prospects Missing "Why" and Bed Count**

The ProspectsSlide only shows name, industry, country, fit score, and estimated value. For 91.life (healthcare), it should also show:
- `bed_count` from `custom_attributes`
- A brief "why" column (e.g., "100% ICP fit, 422 beds, Hospital")

The edge function already fetches account details but does not pull `custom_attributes`.

**4. SOM Is Low Because of Hardcoded ACV**

The edge function uses `DEFAULT_ACV = $75,000` for all orgs. For 91.life's healthcare vertical, the actual ACV could be different. This is a secondary issue but worth noting.

### Fix Plan

#### Fix 1: Correct ICP Column Names (Edge Function)

**File:** `supabase/functions/generate-board-report/index.ts`

At line 199-201, fix the column references:
```
BEFORE:
  targetIndustries: p.target_industries || [],
  geographies: p.target_geographies || [],

AFTER:
  targetIndustries: p.industries || [],
  geographies: p.geographies || [],
```

This immediately fixes the AI narrative context, giving Gemini the correct ICP industries to reason about for Risks and Next Steps.

#### Fix 2: Filter Industry Breakdown by ICP Relevance

**File:** `supabase/functions/generate-board-report/index.ts`

After building `industryBreakdown` (line 134-142), cross-reference with the active ICP profiles' `industries` arrays. Sort ICP-matching industries first. Roll up non-ICP industries beyond top 3 into an "Other" bucket. This ensures the Industry Slide only shows relevant industries.

```text
AFTER building industryBreakdown:
  const icpIndustries = new Set(
    icpProfiles.flatMap(p => p.targetIndustries)  // now correctly populated
  );
  
  // Split into ICP-matched vs other
  const icpMatched = industryBreakdown.filter(i => icpIndustries.has(i.name));
  const nonIcp = industryBreakdown.filter(i => !icpIndustries.has(i.name) && i.name !== 'Unknown');
  
  // Keep top 3 non-ICP, roll rest into "Other"
  const otherCount = nonIcp.slice(3).reduce((s, i) => s + i.accounts, 0);
  const finalBreakdown = [
    ...icpMatched,
    ...nonIcp.slice(0, 3),
    ...(otherCount > 0 ? [{ name: 'Other', accounts: otherCount, ... }] : [])
  ];
```

#### Fix 3: Add Bed Count and "Why" to Top Prospects

**File:** `supabase/functions/generate-board-report/index.ts`

Update the account details query (line 226) to include `custom_attributes`:
```
.select("external_id, name, industry_norm, employee_count, country, revenue_range, custom_attributes")
```

Add `bedCount` to each prospect object:
```
bedCount: acct?.custom_attributes?.bed_count || null,
```

**File:** `src/utils/branded-pdf-export.ts`

Add `bedCount` to the `topProspects` type definition.

**File:** `src/components/slides/slides/ProspectsSlide.tsx`

Add a "Beds" column to the table (between Country and Fit Score). Only render this column if any prospect has bed count data, keeping it clean for non-healthcare orgs.

#### Fix 4: Pass ICP Context to AI for Better Risks/Next Steps

Already fixed by Fix 1 (column name correction). The AI prompt at line 346+ already includes ICP profile details including target industries, geographies, pain points, and buying signals. Once the column names are correct, Gemini will receive:
```
Target Industries: Healthcare, Hospital & Health Systems, Medical Devices, ...
```
Instead of empty arrays, enabling it to generate meaningful risk assessments and strategic recommendations.

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/generate-board-report/index.ts` | Fix ICP column names, filter industry breakdown by ICP, add `custom_attributes` to prospect query |
| `src/utils/branded-pdf-export.ts` | Add `bedCount` to topProspects type |
| `src/components/slides/slides/ProspectsSlide.tsx` | Add conditional Beds column |

### Expected Result

- Industry Slide: Shows Healthcare, Hospitals, Insurance at top; irrelevant industries grouped as "Other"
- Prospects Slide: Shows bed count for healthcare accounts, helping users understand WHY each is a top prospect
- Risks Slide: Gemini receives full ICP context, generates healthcare-specific risk analysis
- Next Steps Slide: Gemini generates actionable recommendations aligned to the ICP (e.g., "Target 1,113 Hospitals & Physicians Clinics accounts")
