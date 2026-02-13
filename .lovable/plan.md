

# Fix Board Report: Correct Branding, Geography Bug, and Polish

## Issues Found

### Critical Data Bug
**Geography shows 0 for ALL countries**: The `get_geography_distribution` RPC returns a `count` field, but `use-branded-report.ts` reads `g.account_count`. So every country gets `0 || 0 = 0`. This is why the entire geography page is zeroed out despite having 62,760 US accounts, 9,371 UK accounts, etc.

### Branding Issues
1. **Wrong default colors**: The PDF uses dark navy blue `rgb(8, 51, 105)` as the primary, but LaunchPulse's actual brand primary is **teal/mint `#3CF1AE`** (`rgb(60, 241, 174)`) with a **black** background -- as seen on launchpulse.io
2. **Organization name**: Stored as "Launchpulse" in the database (lowercase p). The PDF should display "LaunchPulse" with proper casing
3. **No logo**: Since `org_onboarding_config` is empty, there's no `logo_url`. The PDF should embed the LaunchPulse SVG mark as a fallback
4. **Redundant footer**: "Prepared by Launchpulse using LaunchPulse" looks unprofessional -- when the company IS LaunchPulse, it should just say "Powered by LaunchPulse"

### Data Display Issues
5. **Lead Coverage 371%**: Technically correct (53k leads / 14k accounts) but looks like a bug. Should cap at a sensible display or reframe as "Leads per Account: 3.7x"
6. **SOM = 0**: Campaign-ready accounts is 0, which is accurate but could use context

## Technical Changes

### File 1: `src/hooks/use-branded-report.ts`

**Fix geography field name** (the critical bug):
```typescript
// Line 143 - BEFORE (broken):
const geoTotal = geoData.reduce((s, g) => s + (g.account_count || 0), 0);

// AFTER (fixed - RPC returns 'count' not 'account_count'):
const geoTotal = geoData.reduce((s, g) => s + (g.count || 0), 0);
```

Same fix on lines 144-147 where `g.account_count` appears -- change all to `g.count`.

**Fix company name casing**:
```typescript
// Line 185 - add a casing fix for known brands
const rawName = brandConfig?.company_name || orgRes.data?.name || 'Organization';
const resolvedCompanyName = rawName === 'Launchpulse' ? 'LaunchPulse' : rawName;
```

**Fix lead coverage display** -- cap at 100% or reframe:
```typescript
// Line 207 - change lead coverage to "leads per account" ratio
leadCoverage: metrics.totalAccounts > 0 
  ? Math.min(Math.round((totalLeads / metrics.totalAccounts) * 100), 100) 
  : 0,
leadsPerAccount: metrics.totalAccounts > 0 
  ? parseFloat((totalLeads / metrics.totalAccounts).toFixed(1)) 
  : 0,
```

### File 2: `src/utils/branded-pdf-export.ts`

**Update default brand colors** to match LaunchPulse:
```typescript
// Line 73-74 - BEFORE:
const DEFAULT_PRIMARY: [number, number, number] = [8, 51, 105];    // navy
const DEFAULT_SECONDARY: [number, number, number] = [60, 241, 174]; // teal

// AFTER - match launchpulse.io:
const DEFAULT_PRIMARY: [number, number, number] = [60, 241, 174];   // #3CF1AE teal
const DEFAULT_SECONDARY: [number, number, number] = [15, 15, 15];   // near-black
const DEFAULT_DARK: [number, number, number] = [0, 0, 0];           // true black for backgrounds
```

**Redesign cover page** to use black background with teal accent (matching launchpulse.io):
- Background: true black (#000000) instead of navy
- Title text: white with teal accent underline
- Company name: teal/mint colored
- Add the LaunchPulse SVG mark as a vector fallback when no logo_url exists

**Fix header/footer branding**:
- Header bar: use dark background with teal accent instead of navy
- Footer: When company IS LaunchPulse, show "Powered by LaunchPulse" not "Prepared by LaunchPulse using LaunchPulse"

**Update metric card colors** to use teal instead of navy for values and labels.

**Update lead stats display**:
- Show "Leads per Account: 3.7x" instead of "Lead Coverage: 371%"
- Add `leadsPerAccount` to the `BrandedReportData` interface

### File 3: `src/utils/branded-pdf-export.ts` (interface update)

Add `leadsPerAccount` to `leadStats`:
```typescript
leadStats?: {
  totalLeads: number;
  leadCoverage: number;
  leadsPerAccount: number;
};
```

## Summary

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Geography all 0s | Hook reads `account_count`, RPC returns `count` | Change field name to `count` |
| Wrong colors (navy) | DEFAULT_PRIMARY is `(8,51,105)` | Change to `(60,241,174)` teal |
| "Launchpulse" casing | DB has lowercase p | Add casing override for known brand |
| Lead Coverage 371% | More leads than accounts | Cap at 100% or show as "per account" ratio |
| Redundant footer | Same company name repeated | Detect self-reference, simplify |
| No logo | Empty brand config | Embed SVG mark as fallback |

