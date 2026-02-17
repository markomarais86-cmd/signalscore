
# Add Debug Logging and Toast Messages to Bulk Scoring Handler

## What Changes

Add step-by-step debug logging (`console.log`) and toast notifications to the `runBulkScoring` function in `src/components/BulkScoring.tsx` so every stage is visible -- both in the browser console and as on-screen toasts.

## Technical Details

**File: `src/components/BulkScoring.tsx` -- `runBulkScoring` function (line ~371)**

Add logging and toasts at each decision point:

1. **Entry** -- `console.log("[BulkScoring] Button clicked, org_id:", userProfile?.org_id)` + toast "Starting scoring process..."
2. **After existing-job check** (line ~396) -- log the result and toast if resuming
3. **After prerequisite check** (line ~413) -- log account count and ICP count
4. **Before edge function invoke** (line ~422) -- `console.log("[BulkScoring] Invoking edge function...")` + toast
5. **After invoke returns** (line ~426) -- log success/error response, toast on success
6. **Catch block** (line ~431) -- log the full error object with `JSON.stringify` so we capture the complete error shape

This is a single-file change to `src/components/BulkScoring.tsx` only. No new files or dependencies needed.
