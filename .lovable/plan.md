

# Add "Fill Missing Attributes" Bulk Enrichment Button

## What It Does

Adds a "Fill Missing" button to each category group of custom attributes in Settings. When clicked, it fetches accounts that are missing data for those vertical fields and runs them through the existing `enrich-unified` edge function, which already supports custom attribute enrichment via the provider waterfall.

## How It Works

The enrichment pipeline (`enrich-unified` -> `provider-waterfall`) already:
- Loads `custom_attribute_definitions` with `enrichment_prompt` for the org
- Sends those prompts to AI providers (Perplexity, Firecrawl, Gemini)
- Saves results back to `accounts.custom_attributes` JSONB column

So the only missing piece is a UI button that:
1. Queries accounts where `custom_attributes` is missing keys for the selected category
2. Calls `enrich-unified` with those accounts
3. Shows progress and completion

## Changes

### File: `src/components/settings/CustomAttributeManager.tsx`

**Add state and enrichment hook:**
- Import `useUnifiedEnrichment` hook (already exists)
- Add `enrichingCategory` state to track which category is being enriched
- Add progress display

**Add "Fill Missing" button to each category card header (line ~530-534):**
- Next to the category title, add a button with a Sparkles icon: "Fill Missing"
- On click:
  1. Get all `field_key`s for that category's definitions
  2. Query accounts where `custom_attributes` is NULL or missing any of those keys (up to 250 accounts)
  3. Call `enrichAccounts()` from `useUnifiedEnrichment` with those accounts
  4. Show progress inline in the card

**SQL query for missing accounts:**
```sql
SELECT external_id, name, domain, industry_norm, employee_count, 
       revenue_range, country, state_province, city
FROM accounts
WHERE org_id = :orgId
  AND domain IS NOT NULL
  AND (
    custom_attributes IS NULL
    OR NOT (custom_attributes ?& ARRAY['field_key_1', 'field_key_2', ...])
  )
LIMIT 250
```

Since we can't run raw SQL from the client, we'll use a simpler approach: fetch accounts and filter client-side, or use the existing `enrich-unified` function which already handles checking what's missing per-account in the waterfall.

**Simpler approach**: Fetch accounts with `custom_attributes` IS NULL or cast to text and check, then send to `enrich-unified`. The waterfall already skips fields that have values.

**Add progress UI:**
- When enriching, replace the "Fill Missing" button with a progress indicator showing processed/total
- On completion, reload definitions and show a toast

### No new files, no new edge functions, no new dependencies

The existing `enrich-unified` edge function already handles everything -- it loads the org's custom attribute definitions, builds prompts, calls AI providers, and saves results. We just need the trigger button.

## Technical Details

| What | Where |
|------|-------|
| Add enrichment state + hook | `CustomAttributeManager.tsx` top of component |
| "Fill Missing" button | Each category `Card` header (line ~530-534) |
| Account fetching | Supabase query filtering `custom_attributes IS NULL` + `domain IS NOT NULL` |
| Progress display | Inline in category card, replacing button during enrichment |
| Completion handler | Reload definitions, show toast with count |

