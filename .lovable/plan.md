

# Fix Report Pages 4-10: Data Logic Bugs and Layout Improvements

## Problems and Fixes

### 1. Size Breakdown Shows Only "1-10" (Page 4)

The `categorizeEmployeeCount` function in the edge function uses numeric thresholds, but the `company_sizes` field in ICP profiles stores string ranges like "500", "1000", "2000". The accounts table stores `employee_count` as a number. The issue is that accounts with employee counts of 500-10000 (matching the ICP) are being correctly bucketed into "201-1000", "1001-5000", "5000+", but the query only fetches `employee_count` and many may be null or very small.

**Fix in `supabase/functions/generate-board-report/index.ts`:**
- Filter out "Unknown" bucket from size breakdown (or show it separately)
- Ensure the size query isn't limited to 500 rows (currently unlimited, good)

Actually, looking more closely: `accountsForSize` fetches ALL accounts' `employee_count`. If 1,000 accounts have `employee_count` between 1-10 and others have null, the "1-10" bucket would dominate. The real issue is the data itself — but we should also show the revenue range breakdown which is more meaningful for a B2B report.

**Fix:** Add a revenue range breakdown alongside or instead of the employee size breakdown since revenue data exists (top prospects show $100M-$1B ranges).

### 2. All Segments Show "Exit" (Page 5)

**File: `src/utils/revenue-modeling.ts`**

The `deriveSegmentAction` thresholds are unrealistically high:
- `highFitPct >= 40` for Focus/Expand — normal B2B is 5-15%
- This means everything gets "Maintain" or "Exit"

**Fix:** Lower thresholds to realistic levels:
- Focus: `highFitPct >= 10 && accounts >= median`
- Expand: `highFitPct >= 10 && accounts < median`  
- Maintain: `highFitPct >= 5`
- Exit: below 5%

### 3. All Prospects Show "Monitor" (Page 7)

**File: `src/utils/revenue-modeling.ts`**

The `deriveNextAction` function doesn't handle high-fit + moderate-intent (the most common case):
- Intent >= 60 -> "Engage Now"
- Fit >= 60 AND intent < 40 -> "Warm with Content"
- Leads < 2 -> "Source Contacts"
- Everything else -> "Monitor"

When fit=100, intent=50, leads=9, it falls to "Monitor" because intent is between 40-60.

**Fix:** Add a case for high-fit + moderate-intent:
- Fit >= 70 AND intent >= 40 AND intent < 60 -> "Accelerate" (they're warming, push them)
- Fit >= 60 AND intent >= 40 -> "Warm with Content" (broaden the second condition)

### 4. Header Casing "Launchpulse" (Page 4+)

The casing fix was applied to `companyName` on line 215 of the PDF generator. The headers should already show "LaunchPulse." If they don't in the PDF, it means the old code was running when this PDF was generated. The fix from the last edit should resolve this.

### 5. Layout Improvements

**File: `src/utils/branded-pdf-export.ts`**

- Revenue Model page: Add revenue range breakdown table (using `revenueRange` data from accounts)
- Increase table row height from 7mm to 8mm for readability
- Add more spacing between sections
- Make KPI cards slightly larger
- Ensure text doesn't get truncated (company names cut at 16 chars)

### 6. Enhance AI Prompt for Better Report Quality

**File: `supabase/functions/generate-board-report/index.ts`**

The AI is already producing good content. We can improve by:
- Adding revenue range distribution data to the AI context
- Including signal summary details in the prompt
- Asking AI to specifically comment on size/revenue distribution patterns

## Files to Change

| File | Changes |
|------|---------|
| `src/utils/revenue-modeling.ts` | Fix `deriveSegmentAction` thresholds (40% -> 10%), fix `deriveNextAction` to handle moderate-intent |
| `src/utils/branded-pdf-export.ts` | Increase row heights, add revenue range breakdown, widen truncation limits, improve spacing |
| `supabase/functions/generate-board-report/index.ts` | Add revenue range distribution data to AI context, redeploy |

## Technical Detail

### Updated `deriveSegmentAction`:
```text
highFitPct >= 10 AND accounts >= median  -> Focus
highFitPct >= 10 AND accounts < median   -> Expand  
highFitPct >= 5                          -> Maintain
below 5%                                -> Exit
```

### Updated `deriveNextAction`:
```text
intentScore >= 60                              -> Engage Now
fitScore >= 70 AND intentScore >= 40           -> Accelerate
fitScore >= 60 AND intentScore < 40            -> Warm with Content
leadCount < 2                                  -> Source Contacts
else                                           -> Monitor
```

### Revenue Range Breakdown (new table on Page 4):
Uses the existing `revenue_range` field from accounts to show distribution by revenue band ($1M-$5M, $5M-$10M, etc.) — more meaningful than employee count for a revenue-focused report.

## Expected Result
- Page 5: Industries show "Focus", "Expand", "Maintain" based on realistic thresholds
- Page 7: Top prospects show "Accelerate" or "Engage Now" instead of all "Monitor"  
- Page 4: Revenue range breakdown replaces/supplements the broken size table
- All pages: Better spacing, wider text columns, more readable layout
- Headers: "LaunchPulse" correctly cased (already fixed, just needs fresh generation)

