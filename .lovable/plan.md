

# Fix Report: Colors, Size Breakdown, and Layout Issues

## 3 Root Causes Found

### 1. Wrong Colors (Indigo instead of Teal)
The database (`org_onboarding_config`) stores `brand_primary_color: #6366f1` (indigo/purple) and `brand_secondary_color: #818cf8`. These override the default LaunchPulse teal (#3CF1AE). Since LaunchPulse's brand identity is teal/mint on black, the PDF generator should use the LaunchPulse defaults when the company is LaunchPulse, ignoring the DB values.

**Fix in `src/utils/branded-pdf-export.ts`**: When `isLaunchPulse` is true, force the default teal palette regardless of what the DB brand config says.

### 2. "Market by Company Size" Shows Only "1-10" (Page 5 is Nearly Empty)
Supabase has a **default row limit of 1,000**. The edge function query at line 71 (`supabase.from("accounts").select("employee_count").eq("org_id", orgId)`) fetches only the first 1,000 of ~40,000 accounts. Those 1,000 rows happen to have mostly null or small `employee_count`, so after filtering "Unknown", only "1-10" remains.

**Fix in `supabase/functions/generate-board-report/index.ts`**: Add `.limit(50000)` to the `accountsForSize` query (and other queries that may hit the 1,000 default cap) to fetch all rows.

### 3. Layout Problems
- **Page 5 is 95% blank** -- the size table has only 1 row and sits alone on a full page. After fixing the data, it will have more rows, but it should also be combined onto the Revenue Model page to avoid a nearly-empty page.
- **Revenue Leakage card (Page 9)**: The "$34K" text overlaps with the explanatory text below it because both are positioned at y+17.
- **AI Risk Assessment text truncation**: "will lead to rep bur..." gets cut off because `risk.risk.substring(0, 60)` is too aggressive.
- **"Launchpulse" in AI TAM narrative** (Page 4): The AI generates text with "Launchpulse" because the DB company name is "Launchpulse". Need to pass the corrected name to the AI prompt.

## Changes

### File 1: `supabase/functions/generate-board-report/index.ts`

| Change | Detail |
|--------|--------|
| Add row limits | Add `.limit(50000)` to `accountsForSize`, `accountsForGeo`, `accountsForLowData`, and `accountsWithIndustry` queries to bypass the 1,000 default |
| Fix company name for AI | Apply LaunchPulse casing correction to `companyName` before passing to the AI prompt |

### File 2: `src/utils/branded-pdf-export.ts`

| Change | Detail |
|--------|--------|
| Force LaunchPulse palette | When `isLaunchPulse` is true, override brand colors to use default teal (#3CF1AE) primary and black (#0F0F0F) secondary |
| Remove standalone size page | Move the "Market by Company Size" table to follow directly after "Market by Revenue Range" on the Revenue Model page instead of spilling onto a new page |
| Fix revenue leakage card | Move the explanatory text from y+17 to y+22 so it doesn't overlap with the "$34K" value |
| Fix risk text truncation | Increase `risk.risk.substring(0, 60)` to `substring(0, 90)` so risk descriptions are not cut off mid-word |

### File 3: Redeploy edge function
Redeploy `generate-board-report` after the query limit fix.

## Expected Result
- Report uses LaunchPulse teal/mint color scheme (not purple/indigo)
- Size breakdown shows full distribution: 1-10, 11-50, 51-200, 201-1000, 1001-5000, 5000+
- No nearly-blank pages -- size table lives on the Revenue Model page
- Revenue leakage text no longer overlaps
- Risk descriptions are fully readable
- AI narratives use "LaunchPulse" (correct casing)

