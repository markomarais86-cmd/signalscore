
# Fix Board PDF Report: Data Bugs, Branding, and Content Quality

## Problems Identified from the PDF

### 1. Everything says "Organization" instead of the actual company name
**Root cause**: The `org_onboarding_config` table has 0 rows. The `get_branded_config_by_org_id` RPC returns nothing, so `brandConfig` is null and everything falls back to "Organization".

**Fix**: In `use-branded-report.ts`, fall back to fetching the org name from the `organizations` table directly when brand config is null.

### 2. Top Prospects page is empty ("No scored prospects available")
**Root cause**: The query selects `overall_score`, `fit_score`, `intent_score` but the actual `scores` table columns are `overall`, `fit`, `intent`. The query silently returns nothing.

**Fix**: Change the column names in the query from `overall_score`/`fit_score`/`intent_score` to `overall`/`fit`/`intent`.

### 3. Industry and Company Size breakdowns show 0 accounts
**Root cause**: The JSONB values are structured as `{accounts: 6695, percentage: 10}` but `safeNumber()` only checks for `.count`, not `.accounts`. So `safeNumber({accounts: 6695})` returns 0.

**Fix**: Update `safeNumber()` in `use-branded-report.ts` to also check for `.accounts` property.

### 4. Geography shows 0 counts and un-normalized country codes (Gb, Es, Pl)
**Root cause**: The geography RPC returns data, but some country values are ISO-2 codes ("Gb", "Es") instead of full names. The accounts themselves have proper counts (9201 US, 2676 UK, etc.) but the report shows 0.

**Fix**: 
- Add a country code normalization map in the PDF export
- Deduplicate entries that appear as both codes and names (e.g., "United Kingdom" and "Gb" should merge)

### 5. No Leads/Contacts data in the report
The dashboard shows lead coverage, multi-threading stats, etc., but the PDF has zero mention of leads or contacts.

**Fix**: Add lead statistics to the data fetch and include them in the Executive Summary section.

### 6. Footer branding says "LaunchPulse" generically
The footer says "Prepared by Organization using LaunchPulse" which doesn't look professional when the org name is missing.

**Fix**: Use the resolved company name throughout, and make the LaunchPulse attribution subtle.

### 7. SAM shows 0 when it should be 13,956 (high + medium fit)
**Root cause**: `sam = metrics.highFitAccounts + metrics.mediumFitAccounts` is correct, but the funnel shows `data.sam` = 0 in the PDF. This is likely because the metrics are correct but the TAM/SAM/SOM visual uses the wrong values. Looking at the PDF: TAM shows 66,949 (correct from external_data_sources) but the table shows TAM=13,956 (which is actually the sam value). The logic is computing correctly but displaying incorrectly.

**Fix**: Verify the TAM/SAM/SOM assignment and ensure SAM = high + medium = 8972 + 4984 = 13,956.

## Technical Changes

### File 1: `src/hooks/use-branded-report.ts`

**Score column fix (critical)**:
```typescript
// BEFORE (broken):
.select('account_external_id, overall_score, fit_score, intent_score, org_id')
.order('overall_score', { ascending: false })

// AFTER (fixed):
.select('account_external_id, overall, fit, intent, org_id')
.order('overall', { ascending: false })
```

Also fix the mapping:
```typescript
// BEFORE:
fitScore: s.fit_score || 0,
intentScore: s.intent_score || 0,
overallScore: s.overall_score || 0,

// AFTER:
fitScore: s.fit || 0,
intentScore: s.intent || 0,
overallScore: s.overall || 0,
```

**safeNumber fix (critical)**:
```typescript
// BEFORE:
if (typeof val === 'object' && val.count != null) return Number(val.count) || 0;

// AFTER:
if (typeof val === 'object') {
  if (val.accounts != null) return Number(val.accounts) || 0;
  if (val.count != null) return Number(val.count) || 0;
}
```

**Org name fallback**:
Add a query to `organizations` table to get the org name when brand config is null:
```typescript
const orgNameRes = await supabase
  .from('organizations')
  .select('name')
  .eq('id', effectiveOrgId)
  .maybeSingle();
const orgName = brandConfig?.company_name || orgNameRes?.data?.name || 'Organization';
```

**Lead stats fetch**:
Add a count query for leads to include lead coverage in the report:
```typescript
const leadsRes = await supabase
  .from('Leads')
  .select('id', { count: 'exact', head: true })
  .eq('org_id', effectiveOrgId);
```

### File 2: `src/utils/branded-pdf-export.ts`

**Country code normalization**:
Add an ISO-2 to full name map and merge duplicates:
```typescript
const COUNTRY_NAMES: Record<string, string> = {
  'us': 'United States', 'gb': 'United Kingdom', 'de': 'Germany',
  'fr': 'France', 'es': 'Spain', 'it': 'Italy', 'pl': 'Poland',
  'ro': 'Romania', 'bg': 'Bulgaria', // ... etc
};
```

Normalize country names in geography data before rendering and merge duplicates (e.g., "Gb" + "United Kingdom" = single "United Kingdom" entry).

**Add lead stats to report data interface**:
```typescript
// Add to BrandedReportData
leadStats?: {
  totalLeads: number;
  leadCoverage: number;
};
```

Display lead count in Executive Summary metrics grid alongside existing metrics.

**Improve narrative to include leads**:
Update `generateNarrative()` to mention lead coverage when available.

### File 3: No other files need changes

## Summary of Fixes

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| "Organization" everywhere | Empty org_onboarding_config | Fallback to organizations.name |
| Empty Top Prospects | Wrong column names (overall_score vs overall) | Fix column names in query |
| Zero industry/size values | safeNumber checks .count not .accounts | Add .accounts check |
| Zero geography counts | Un-normalized country codes | Add ISO-2 normalization map |
| No lead data | Not fetched | Add Leads count query |
| SAM = 0 | Possibly related to metrics | Verify computation path |
