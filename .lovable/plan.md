

# Fix All Remaining Errors

## Issues Found

### 1. 406 Error: `ai_memory` query uses `.single()` with no rows
**File**: `src/hooks/use-ai-chat.tsx` (line 124)
**Problem**: `loadFromMemory()` uses `.single()` to fetch `recent_filters` from `ai_memory`. When no row exists (first use), PostgREST returns 406 "JSON object requested, multiple (or no) rows returned".
**Fix**: Replace `.single()` with `.maybeSingle()` which returns `null` instead of an error when no rows are found.

### 2. 406 Error: `enrichment_jobs` paused job query uses `.single()` with no rows
**Files**: 
- `src/components/insights/ProactiveInsightsWidget.tsx` (lines 95, 124)
- `src/components/executive/UnifiedInsightsPanel.tsx` (line 191)
**Problem**: Queries for paused enrichment jobs use `.single()` but there may be no paused jobs, causing a 406 error.
**Fix**: Replace `.single()` with `.maybeSingle()` on these queries. Also fix the active job queries at lines 93-95 in ProactiveInsightsWidget.

### 3. 400 Error: `get_enriched_leads_metrics` - ambiguous column reference
**Problem**: The PL/pgSQL function uses `email_verified` as both a table column name and an output column alias, causing "column reference is ambiguous" error.
**Fix**: Database migration to rename the output column alias from `email_verified` to `email_verified_count` to avoid conflict with the `"Leads".email_verified` column.

### 4. 400 Error: `get_filtered_accounts` - `%I` format specifier issue
**Problem**: The function uses `format(..., %I, ...)` with values like `'a.updated_at'`. The `%I` specifier treats the entire string as a quoted identifier (`"a.updated_at"` instead of `a.updated_at`), causing "column a.updated_at does not exist".
**Fix**: Database migration to change the CASE expressions to return just the column name without table alias (e.g. `'updated_at'` instead of `'a.updated_at'`), since the FROM clause only has one source of those columns after the table alias. For `s.overall`, use a different approach since it's from a JOINed table -- add the table alias in the format string template instead.

### 5. 500 Error: `get_leads_metrics` intermittent timeout
**Problem**: The function scans all Leads rows without indexes optimized for the query patterns. It worked sometimes but timed out once.
**Fix**: This appears intermittent (it succeeded on manual test). We'll add an index on `"Leads"(org_id)` if one doesn't already exist, and optimize the function with a more efficient query approach.

---

## Technical Implementation

### Database Migration
A single migration to:
1. Fix `get_enriched_leads_metrics` -- rename output alias from `email_verified` to `email_verified_count`
2. Fix `get_filtered_accounts` -- change `%I` column references to remove table alias prefixes and handle the sort column mapping correctly
3. Drop the old (unused) `get_filtered_accounts` overload that takes `text` cursor to prevent ambiguity

### Frontend Code Changes
1. **`src/hooks/use-ai-chat.tsx`**: Change `.single()` to `.maybeSingle()` in `loadFromMemory`
2. **`src/components/insights/ProactiveInsightsWidget.tsx`**: Change `.single()` to `.maybeSingle()` for active and paused enrichment job queries (2 locations)
3. **`src/components/executive/UnifiedInsightsPanel.tsx`**: Change `.single()` to `.maybeSingle()` for paused enrichment job query
4. **`src/hooks/use-enriched-leads.tsx`**: Update to handle the renamed output column (`email_verified_count` instead of `email_verified`)

