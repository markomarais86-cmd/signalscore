

# Fix 91.Life Scoring Regression

## Root Cause Analysis

The -15 flat penalty is mathematically wrong for this score distribution.

**The data tells the story:**

| Group | Count | Avg Base (before penalty) | Old Avg (cap at 69) | New Avg (-15 flat) |
|-------|-------|--------------------------|---------------------|-------------------|
| Has bed_count (missing_vert=false) | 1,989 | 10.3 | 10.3 | 10.3 (unaffected) |
| Missing bed_count (missing_vert=true) | 37,939 | 32.0 | ~32.0 | 20.4 |

**Why the old cap (min at 69) was nearly invisible:** The average base score for accounts missing bed_count is only 32. Since 32 < 69, the old cap `Math.min(score, 69)` had zero effect on 99.9% of accounts. It only clipped the top ~29 accounts that scored 60-69.

**Why the new -15 penalty crushed everything:** Subtracting 15 from an average of 32 yields 17. Every single one of the 37,939 accounts lost 15 points, dragging the org average from ~34 to ~20. The penalty hits low-scoring accounts just as hard as high-scoring ones -- that's the bug.

**Current distribution for missing_vert=true accounts (after -15):**
- 0-10: 8,283 accounts (21.8%)
- 10-20: 10,186 accounts (26.8%) -- massive pileup
- 20-30: 9,399 accounts (24.8%)
- 30-40: 7,515 accounts (19.8%)
- 40-50: 2,030 accounts
- 50-70: 526 accounts

## The Fix

Replace the flat -15 penalty with a **proportional penalty (15%) plus a hard cap at 69** to prevent Band A without bed_count:

```typescript
if (missingRequiredVertical) {
  totalScore = Math.min(Math.round(totalScore * 0.85), 69);
  fitScore = Math.min(Math.round(fitScore * 0.85), 69);
}
```

**Why this works:**

| Base Score | Old (cap 69) | Current (-15) | Fixed (x0.85, cap 69) |
|-----------|-------------|--------------|----------------------|
| 85 | 69 | 70 | 69 |
| 60 | 60 | 45 | 51 |
| 45 | 45 | 30 | 38 |
| 32 (avg) | 32 | 17 | 27 |
| 20 | 20 | 5 | 17 |

- **Preserves rank order** -- no compression to a single value
- **Proportional** -- low-scoring accounts lose only ~5 points, not 15
- **Band A protected** -- cap at 69 means no account reaches Band A without bed_count
- **Predicted new org average:** ~27 (up from current 20.4, slightly below old 34 which is correct since bed_count matters)

## Implementation

**File:** `supabase/functions/bulk-score-accounts/index.ts`

**Change:** Lines 208-213 -- replace the flat penalty with proportional + cap:

```typescript
// Proportional penalty (15%) + cap at 69 when bed_count is missing
// Prevents Band A assignment while preserving score differentiation
if (missingRequiredVertical) {
  totalScore = Math.min(Math.round(totalScore * 0.85), 69);
  fitScore = Math.min(Math.round(fitScore * 0.85), 69);
}
```

**Post-fix:** Re-trigger `bulk-score-accounts` for 91.Life org `cd592f73` to rescore all 39,928 accounts with the corrected logic.

