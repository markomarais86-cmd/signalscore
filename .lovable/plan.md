

# Fix ICP Confidence Score Showing 0%

## Problem

The ICP profile "91.Life Heart+ - Hospital & Health System ICP" shows **0% Low** in the confidence meter because `confidence_score` defaults to `0` in the database and is only updated when the `analyze-closed-won` or `analyze-correlations` edge functions run. For manually created ICPs (not derived from closed-won analysis), the confidence score is never computed, so it stays at 0.

The ICP actually has extensive criteria filled in (6 industries, multiple company sizes, revenue ranges, geographies, personas, buying signals, pain points), so it should show a much higher confidence score based on profile completeness.

## Solution

Compute a **profile completeness-based confidence score** whenever the ICP is saved or displayed, so that even manually created ICPs get a meaningful score.

### 1. Create a utility function: `src/utils/icp-confidence.ts`

A pure function that computes confidence from ICP field completeness:

```
fields checked (each worth points):
- industries (15 pts if >= 1)
- company_sizes (10 pts if >= 1)
- revenue_ranges (10 pts if >= 1)
- geographies (10 pts if >= 1)
- persona_job_titles (10 pts if >= 1)
- persona_seniority_levels (10 pts if >= 1)
- persona_departments (5 pts if >= 1)
- pain_points (10 pts if >= 1)
- buying_signals (10 pts if >= 1)
- tech_stack (5 pts if >= 1)
- company_stages (5 pts if >= 1)

Total possible: 100 pts
```

This gives a completeness-based confidence. The 91.Life ICP has most fields filled, so it would score around 85-95%.

### 2. Update `src/pages/ICPManager.tsx`

When saving/updating an ICP profile, compute the confidence score and include it in the upsert:

```typescript
const computedConfidence = computeICPConfidence(icpData);
// Include confidence_score: computedConfidence in the upsert
```

### 3. Update `src/components/executive/ICPProfileSummaryCard.tsx`

As a fallback for existing ICPs that haven't been re-saved, compute confidence on-the-fly when `confidence_score` is 0 or null:

```typescript
const confidenceScore = profile.confidence_score || computeICPConfidence(profile);
```

This ensures the meter always shows a meaningful value.

### 4. Backfill existing ICP

Run a one-time update to set the confidence score for the existing ICP based on its completeness, so the fix is immediately visible without requiring the user to re-save.

## Technical Summary

| File | Change |
|------|--------|
| `src/utils/icp-confidence.ts` (new) | Pure function to compute ICP confidence from field completeness |
| `src/pages/ICPManager.tsx` | Compute and persist confidence on save |
| `src/components/executive/ICPProfileSummaryCard.tsx` | Fallback: compute on-the-fly when score is 0/null |
| SQL migration | Backfill confidence_score for existing ICPs with filled-in fields |

