

# Fix Report: Company Name Casing + Missing ICP Page

## Root Causes

### 1. "Launchpulse" appears everywhere instead of "LaunchPulse"
The casing correction in `use-branded-report.ts` (line 93) fixes `reportData.companyName`, but the PDF generator at line 214 of `branded-pdf-export.ts` prefers `brand?.company_name` over `data.companyName`. Since the `brand` object has the raw DB value "Launchpulse", the fix is never applied.

**Fix**: Apply the same casing correction inside `generateBrandedPDF` at line 214, so it corrects "Launchpulse" regardless of source.

### 2. ICP Profile page missing from the report
The page is gated on `if (data.icpProfileDetail)` (line 438). The hook builds this from `serverData.icpProfiles?.[0]`, but the edge function uses the **service role key** which bypasses RLS -- this should return data. Adding a `console.log` or defensive logging would help, but the most likely issue is that the `icp_profiles` query at line 64 filters by `status = 'active'` and the ICP profile exists (confirmed in DB). The mapping chain from edge function -> hook -> PDF looks correct syntactically.

The probable cause: the `description` field on the ICP profile edge function mapping at line 173 uses `p.description`, and the DB column exists. But if the edge function **hasn't been redeployed** since the last code change, the old version (without `description`, `techStack`, etc. fields) is still running. The icpProfiles array items would only have `name`, `targetIndustries`, `companySizes`, `geographies`, `matchCount`, `tamEstimate`, `confidence` -- missing all the new fields. The hook tries `primaryIcp.personaJobTitles` which would be `undefined`, defaulting to `[]`. The `icpProfileDetail` object would still be created (truthy), so the page should render but with empty sections.

**However**: if the old deployed edge function didn't include `description` in the ICP map, the `primaryIcp` object itself is still truthy, so the page should still appear. Unless the old edge function code returned a completely different structure...

**Fix**: Redeploy the edge function to ensure the latest code with full ICP fields is live. Also add a safety check.

## Changes

### File 1: `src/utils/branded-pdf-export.ts`
- **Line 214**: Apply LaunchPulse casing correction:
  ```typescript
  const rawName = brand?.company_name || data.companyName || 'Organization';
  const companyName = rawName.toLowerCase().replace(/\s/g, '') === 'launchpulse' ? 'LaunchPulse' : rawName;
  ```

### File 2: `src/hooks/use-branded-report.ts`
- Also apply the casing fix to `effectiveBrand.company_name` before passing it to the PDF generator, ensuring consistency:
  ```typescript
  if (effectiveBrand && effectiveBrand.company_name?.toLowerCase() === 'launchpulse') {
    effectiveBrand.company_name = 'LaunchPulse';
  }
  ```

### File 3: `supabase/functions/generate-board-report/index.ts`
- Redeploy (no code change needed -- the latest code already has full ICP fields, it just needs to be deployed)

## Expected Result
- All page headers will show "LaunchPulse" (correctly cased)
- ICP Profile page will appear as Page 2 with industries, personas, tech stack, buying signals, pain points, and confidence gauge
- Brand colors (#6366f1 indigo) will apply throughout
- Report grows from 9 to 10 pages with the ICP detail page

