

## Fix ICP Scoring Accuracy for 91.Life

### Root Causes Identified

| Problem | Impact | Accounts Affected |
|---------|--------|-------------------|
| `bed_count` data missing on 99.94% of accounts, causing Band C cap | All accounts capped at max fit score 69 | 39,904 / 39,928 |
| Size matching uses exact values instead of ranges | Most accounts fail size match even when within ICP range | ~35,000 miss that otherwise fall in range |
| Industry taxonomy mismatch between ICP terms and enriched data | Industry score = 0 for many healthcare accounts | ~1,500 healthcare accounts partially missed |
| Intent and reachability are hardcoded constants | No differentiation between engaged and inactive accounts | All 27,500 scored accounts |

### Proposed Fixes (in priority order)

#### 1. Make bed_count a soft signal, not a hard gate

**Current behavior:** If ANY ICP segment defines `bed_range` and the account has no `bed_count`, the entire score is capped at 69 (`missing_required_vertical = true`).

**Proposed behavior:** Treat missing `bed_count` as a **scoring penalty** rather than a hard cap. Accounts missing `bed_count` lose the vertical score points (up to 15) but are NOT capped at Band C. This lets well-matching accounts on industry/size/geo/revenue still reach Band A.

**File:** `supabase/functions/bulk-score-accounts/index.ts`
- Remove the Band C cap logic (lines 182-195) that enforces `Math.min(totalScore, 69)` when `bed_count` is null
- Keep `missing_required_vertical` in the breakdown for visibility but stop using it to cap the score
- Add a smaller penalty: reduce vertical score contribution by 50% when bed_count is missing (instead of capping the entire score)

#### 2. Use range-based size matching instead of exact values

**Current behavior:** `icp.company_sizes.some(s => s === ec)` with a few hardcoded fallback ranges.

**Proposed behavior:** Interpret the ICP `company_sizes` array as defining a target range (min to max of the array values). Score based on proximity to that range:
- Within range: 25 points (full match)
- Within 2x of range boundaries: 15 points (partial match)
- Outside: 0 points

**File:** `supabase/functions/bulk-score-accounts/index.ts` (lines 56-63)

#### 3. Improve industry fuzzy matching

**Current behavior:** Case-insensitive `includes()` check between account industry and ICP industry terms.

**Proposed behavior:** Additionally tokenize compound industry strings (split on `,`, `/`, `&`, `;`) and match each token individually. This catches "Hospitals & Healthcare" matching ICP term "Healthcare" and "Hospital & Health Care, Pharmaceuticals" matching "Healthcare".

**File:** `supabase/functions/bulk-score-accounts/index.ts` (lines 46-53)

#### 4. Add basic intent signals from score history

**Current behavior:** `intent: 50` hardcoded for every account.

**Proposed behavior:** Query `score_history` table for recent score changes and derive a basic intent signal:
- Recent score improvement: higher intent
- Multiple scoring cycles with stable high fit: moderate intent
- No history: baseline 50

This aligns with the existing architecture note about using `score_history` as a proxy for engagement velocity.

**File:** `supabase/functions/bulk-score-accounts/index.ts` -- add a pre-processing step that loads recent score deltas

### Technical Details

#### Change 1: Soft bed_count penalty (biggest impact)

```text
BEFORE:
  if (anySegHasBeds && bedCount == null) {
    missingRequiredVertical = true;
    totalScore = Math.min(totalScore, 69);  // HARD CAP
    fitScore = Math.min(fitScore, 69);
  }

AFTER:
  if (anySegHasBeds && bedCount == null) {
    missingRequiredVertical = true;
    // Soft penalty: reduce vertical contribution, don't cap entire score
    verticalScore = Math.round(verticalScore * 0.3);  // 70% penalty on vertical only
    // No hard cap -- let other dimensions determine band
  }
```

#### Change 2: Range-based size scoring

```text
BEFORE:
  const sizeMatch = icp.company_sizes.some(s => s === ec) || hardcoded fallbacks

AFTER:
  const sortedSizes = [...icp.company_sizes].sort((a,b) => a - b);
  const minSize = sortedSizes[0];
  const maxSize = sortedSizes[sortedSizes.length - 1];
  if (ec >= minSize && ec <= maxSize) { sizeScore = 25; matches++; }
  else if (ec >= minSize * 0.5 && ec <= maxSize * 2) { sizeScore = 15; matches++; }
```

#### Change 3: Tokenized industry matching

```text
BEFORE:
  normLower.includes(indLower) || indLower.includes(normLower)

AFTER:
  // Split compound industries on delimiters
  const tokens = normLower.split(/[,\/&;]+/).map(t => t.trim());
  // Match if any token contains or is contained by any ICP term
  tokens.some(token => token.includes(indLower) || indLower.includes(token))
```

### Implementation Order

1. Update `scoreAccount()` in `bulk-score-accounts/index.ts` with all 3 scoring fixes
2. Update the SQL scoring function `calculate_account_score_readonly` to match (if it exists)
3. Redeploy the edge function
4. Trigger a re-score for the 91.life org to apply the new logic

### Expected Impact

| Metric | Before | After (estimated) |
|--------|--------|-------------------|
| Band A accounts (fit >= 80) | 17 | ~2,000-3,000 |
| Band B accounts (fit 50-79) | 17,118 | ~8,000-10,000 |
| Accounts capped by bed_count | 23,483 | 0 (penalty instead of cap) |
| Industry matches | ~1,800 | ~2,500+ |
| Size matches | ~2,136 exact | ~14,000 range |

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/bulk-score-accounts/index.ts` | Scoring logic: soft bed penalty, range sizes, tokenized industry |

### No Database Changes Required

All changes are in the edge function scoring logic. No schema migrations needed.

