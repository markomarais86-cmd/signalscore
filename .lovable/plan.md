

## Fix: Apollo Sync Missing Industry, Sub-Industry, and Vertical Filters

### The Problem

The `sync-external-provider` edge function builds the Apollo search query from the ICP profile but **skips industry filters entirely** (line 153: `// Skip industry filters - Apollo expects numeric tag IDs, not names`). It also ignores:

- `sub_industries` (e.g., "Electrophysiology", "Cardiology", "Medical & Surgical Hospitals")
- `vertical_filters` (e.g., bed count segments, specific personas)
- `company_keywords`
- `excluded_industries`

Without industry filters, Apollo returns **every company in the US** matching the employee count and revenue range -- which is why you're seeing ~1 million results instead of a focused healthcare/hospital set.

### Root Cause

The code comment says "Apollo expects numeric tag IDs, not names" -- but this is wrong. Apollo's Organization Search API (`/api/v1/mixed_companies/search`) supports `q_organization_keyword_tags[]` which accepts **plain text keywords** like "healthcare", "hospitals", "medical devices". This is exactly what we have in the ICP profile.

### What We Have in the 91.Life ICP

```text
industries: ["Healthcare", "Hospital & Health Systems", "Medical Devices", ...]
sub_industries: ["Electrophysiology", "Cardiology", "Medical & Surgical Hospitals", ...]
company_keywords: null (currently unused)
vertical_filters: { segments: [{ name: "Academic Medical Centers", bed_range: "300-1000+" }, ...] }
```

### What Apollo Gets Today

```text
organization_locations: ["United States"]
organization_num_employees_ranges: ["11,50", "51,200", "201,500"]
revenue_range[min]: 10000000
revenue_range[max]: 5000000000
(NO industry filter at all)
```

This matches every mid-size US company across ALL industries -- hence ~1 million results.

### The Fix

**File: `supabase/functions/sync-external-provider/index.ts`**

1. **Add industry keyword filtering** -- Replace the "skip industry" comment with actual filtering using `q_organization_keyword_tags`:
   - Combine `industries` + `sub_industries` into keyword tags
   - Apollo's keyword tag filter accepts plain text strings and matches them against its internal industry taxonomy
   
2. **Use the correct API endpoint** -- The function currently calls `/v1/organizations/search` but the documented endpoint is `/api/v1/mixed_companies/search`. Both may work, but the documented one is more reliable.

3. **Add excluded industries** -- If the ICP has `excluded_industries`, pass those too (Apollo doesn't have a direct exclude-industry param, but we can note it in the company_keywords negation or post-filter).

4. **Add company_keywords support** -- If `company_keywords` is set on the ICP, include those as additional `q_organization_keyword_tags`.

### Changes in Detail

```typescript
// BEFORE (line 153):
// Skip industry filters - Apollo expects numeric tag IDs, not names

// AFTER:
// Add industry + sub-industry as keyword tags (Apollo accepts plain text)
const keywordTags: string[] = [];

if (icpData.industries && icpData.industries.length > 0) {
  keywordTags.push(...icpData.industries);
}
if (icpData.sub_industries && icpData.sub_industries.length > 0) {
  keywordTags.push(...icpData.sub_industries);
}
if (icpData.company_keywords && icpData.company_keywords.length > 0) {
  keywordTags.push(...icpData.company_keywords);
}

if (keywordTags.length > 0) {
  // Apollo uses q_organization_keyword_tags for text-based industry/keyword matching
  baseRequestBody.q_organization_keyword_tags = keywordTags;
}
```

### Expected Result

With the 91.Life ICP, Apollo will receive:
- `q_organization_keyword_tags`: ["Healthcare", "Hospital & Health Systems", "Medical Devices", "Health IT", ..., "Electrophysiology", "Cardiology", "Medical & Surgical Hospitals", ...]
- `organization_locations`: ["United States"]
- `organization_num_employees_ranges`: ["11,50", "51,200", "201,500"]
- `revenue_range`: min/max based on $10M-$5B+

This should narrow the result from ~1M down to a realistic healthcare TAM (likely 5K-50K organizations depending on Apollo's coverage).

### Summary

| What | Before | After |
|------|--------|-------|
| Industries | Skipped entirely | Sent as `q_organization_keyword_tags` |
| Sub-industries | Ignored | Included in keyword tags |
| Company keywords | Ignored | Included in keyword tags |
| Result count | ~1,000,000 (all US companies) | Focused healthcare subset |

Only one file changes: `supabase/functions/sync-external-provider/index.ts`
