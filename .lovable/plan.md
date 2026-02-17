

# Fix Industry Normalization

## The Problem

Your `industry_norm` column has **529 different labels** across **6,592 accounts** that don't match the 23 standard ZoomInfo primary industries. For healthcare alone, there are variants like:
- "Hospitals & Healthcare" (276 accounts)
- "Healthcare Services" (224 accounts) 
- "Hospitals and Health Care" (102 accounts)
- "Health, Wellness, and Fitness" (42 accounts)
- "Hospital & Health Care" (2 accounts)
- "Healthcare" (4 accounts)
- Plus dozens more

These should all map to a single ZoomInfo standard like "Hospitals & Physicians Clinics" or "Healthcare Services".

The same fragmentation exists across every industry -- "Professional Services" vs "Business Services", "Financial Services" vs "Finance", "Computer Software" vs "Software", etc.

## Root Causes

1. **The `standardize-industry` edge function uses its own made-up taxonomy** (e.g. "Healthcare", "Financial Services", "Professional Services") instead of the official ZoomInfo taxonomy used everywhere else in the app.
2. **The `industry_mapping` table only has 270 entries** -- many raw industry strings from CRM imports were never mapped.
3. **No post-import normalization step** runs to clean up `industry_norm` values against the mapping table.

## Solution (3 Parts)

### Part 1: Database Migration -- Bulk Re-normalize Existing Accounts

Run a single SQL UPDATE that maps all 529 non-standard `industry_norm` values to the 23 ZoomInfo primaries using a comprehensive CASE statement. This covers all variants found in the data, including:

- Healthcare variants --> "Hospitals & Physicians Clinics" or "Healthcare Services"
- "Professional Services", "Business Consulting" --> "Business Services"
- "Financial Services", "Banking", "Investment Services" --> "Finance"  
- "Computer Software", "Technology", "IT Services" --> "Software" or "Business Services"
- "Manufacturing - Durables/Non-Durables" --> "Manufacturing"
- All LinkedIn-style compound labels (semicolons, commas) --> primary match
- And 400+ more mappings

### Part 2: Add Missing Entries to `industry_mapping` Table

Insert ~260 new rows into the `industry_mapping` reference table so that future imports/enrichments automatically normalize correctly. This covers all the non-standard values found in the current data.

### Part 3: Rewrite `standardize-industry` Edge Function

Replace the made-up taxonomy with the actual ZoomInfo taxonomy from `src/constants/zoominfo-industries.ts`. Also add a database lookup step: check `industry_mapping` table first (fast exact match), then fall back to fuzzy matching.

## Technical Details

### Database Migration SQL

A single migration with two statements:

**Statement 1**: UPDATE accounts using a giant CASE mapping:
```sql
UPDATE accounts 
SET industry_norm = CASE industry_norm
  -- Healthcare variants
  WHEN 'Hospitals & Healthcare' THEN 'Hospitals & Physicians Clinics'
  WHEN 'Hospitals and Health Care' THEN 'Hospitals & Physicians Clinics'
  WHEN 'Hospital & Health Care' THEN 'Hospitals & Physicians Clinics'
  WHEN 'Healthcare' THEN 'Healthcare Services'
  WHEN 'Health, Wellness, and Fitness' THEN 'Healthcare Services'
  WHEN 'Medical Practices' THEN 'Hospitals & Physicians Clinics'
  WHEN 'Medical Equipment Manufacturing' THEN 'Manufacturing'
  -- Financial variants
  WHEN 'Financial Services' THEN 'Finance'
  WHEN 'Banking' THEN 'Finance'
  WHEN 'Investment Services' THEN 'Finance'
  -- ... (covers all 529 non-standard values)
  ELSE industry_norm
END
WHERE industry_norm NOT IN (
  'Agriculture','Business Services','Construction','Consumer Services','Education',
  'Energy, Utilities & Waste','Finance','Government','Healthcare Services',
  'Holding Companies & Conglomerates','Hospitals & Physicians Clinics','Hospitality',
  'Insurance','Law Firms & Legal Services','Manufacturing','Media & Internet',
  'Minerals & Mining','Organizations','Real Estate','Retail','Software',
  'Telecommunications','Transportation'
);
```

**Statement 2**: INSERT into `industry_mapping` for all newly-discovered raw values.

### Edge Function Rewrite (`supabase/functions/standardize-industry/index.ts`)

- Replace the custom `ZOOMINFO_INDUSTRIES` array with the official 23-category ZoomInfo taxonomy
- Add a Supabase client to check the `industry_mapping` table first
- Fall back to fuzzy matching against the ZoomInfo taxonomy
- Return standard ZoomInfo primary industry names

### Files Changed

1. New database migration (bulk UPDATE + INSERT into industry_mapping)
2. `supabase/functions/standardize-industry/index.ts` -- full rewrite to use ZoomInfo taxonomy and DB lookup

### Expected Outcome

- All 39,928 accounts will have one of exactly 23 standard industry labels
- Healthcare accounts (~670) will consistently show as "Hospitals & Physicians Clinics" or "Healthcare Services"
- Future imports will auto-normalize via the expanded mapping table
- ICP filtering by industry will work correctly across all accounts

