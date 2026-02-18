

## Continue Batch Enrichment for Missing bed_count Values

### Current State

- **39,928 total accounts** in the database
- **Only 20 accounts** currently have a `bed_count` value
- **~39,908 accounts** are missing `bed_count` (though many may not be healthcare -- 672 have a healthcare `industry_norm`)
- The "Fill Missing" button on Settings > Verticals already works, but processes only **250 accounts per run** (fetches 500, filters client-side, caps at 250)

### What Already Works

- The **"Missing" dropdown** in the Bulk Attribute Editor filters accounts where `bed_count` is null -- you can use it right now to see which accounts need values
- The **"Fill Missing" button** on the Healthcare card triggers AI enrichment via `enrich-unified` for accounts missing any Healthcare attribute (bed_count, facility_type, EHR system, etc.)

### The Problem

With ~672 healthcare accounts missing `bed_count`, one click of "Fill Missing" only covers 250. You'd need to click it 3 times and wait each time. Additionally, the query fetches all accounts (not just healthcare ones), wasting slots on non-healthcare accounts that won't have meaningful bed counts.

### Proposed Changes

#### 1. Smarter filtering in `handleFillMissing` (CustomAttributeManager.tsx)

- Add an `industry_norm` filter so the Healthcare "Fill Missing" only pulls healthcare-related accounts (not all 39,928)
- Increase the per-batch limit from 250 to 500 for faster processing
- This ensures all ~672 healthcare accounts get processed in a single click

#### 2. Add "Enrich Filtered" button to BulkAttributeEditor

- When the "Missing" filter is active (e.g., "Missing Number of Beds"), add an "Enrich Filtered" button next to the filter dropdown
- This button triggers enrichment specifically for the filtered accounts visible in the bulk editor
- Shows progress inline, same as the category-level "Fill Missing"

### Technical Details

**File 1: `src/components/settings/CustomAttributeManager.tsx`**
- In `handleFillMissing`, add `.ilike('industry_norm', '%health%')` filter when the category is "Healthcare" (or use a category-to-industry mapping)
- Increase `.limit(500)` and `.slice(0, 500)` to process more accounts per batch

**File 2: `src/components/settings/BulkAttributeEditor.tsx`**
- Accept new optional props: `onEnrichFiltered` callback and `isEnriching` / `progress` state
- When `missingField` is set and `onEnrichFiltered` exists, render an "Enrich Filtered" button in the toolbar
- Clicking it calls `onEnrichFiltered(missingField)` which the parent handles

**File 3: `src/components/settings/CustomAttributeManager.tsx` (wiring)**
- Pass `onEnrichFiltered`, `isEnriching`, and `progress` props down to `BulkAttributeEditor`
- The callback triggers enrichment scoped to accounts missing that specific field

### Result

- One click of "Fill Missing" or "Enrich Filtered" will process all ~672 healthcare accounts missing bed_count
- Non-healthcare accounts won't waste enrichment slots
- The Bulk Editor's "Missing" filter + "Enrich Filtered" button gives a focused workflow for filling specific fields
