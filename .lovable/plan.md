

# GTM Platform Fix Plan — LaunchPulse

## Executive Summary

Six targeted fixes to unblock the entire GTM pipeline. Ordered by downstream impact — each fix unlocks the next layer.

---

## Fix 1: Clean Up Stuck Agent Runs (Immediate — Data Fix)

**Problem:** 6 agent runs are permanently stuck in "running" status (oldest from Dec 11, 2025). These orphaned runs may prevent new runs from executing properly.

**Stuck runs to clean up:**
- Lead Qualification Agent: Feb 19, Feb 17, Dec 11
- Data Enrichment Agent: Feb 11, Feb 3, Jan 27

**Fix:** Execute a SQL update to mark all stuck runs as `failed` with an explanation, clearing the way for fresh runs.

**File changes:** None — data-only fix via SQL.

---

## Fix 2: Fix Lead Qualification Agent — Wrong Status Filter (Critical)

**Problem:** The `agent-lead-qualification` function queries leads with `status IN ('open', 'new')` (line 244), but the actual lead statuses in the database are `open` (53,190), `follow_up_needed` (74), and `meeting_requested` (39). There are zero leads with `status = 'new'`. This is fine — "open" matches.

The real problem is the **score threshold + org scoping mismatch:**
- The agent queries `scores` using `org_id` (the child org `cd592f73` for 91.Life)
- 91.Life only has **20 accounts** scoring >= 70 (due to the bed_count cap at line 209-211)
- Those 20 accounts only map to **75 leads**
- But the agent processes 0 records because it creates a run, gets the leads, but the edge function times out or errors before completing — and the run stays "running" forever

**Root cause chain:**
1. 91.Life scoring cap (Fix 3) limits high-fit accounts to 20
2. Agent finds only 75 leads but processes 0 — likely hitting an error in the AI qualification call or the run record management
3. Run stays "running", blocking subsequent runs

**Fix (in `supabase/functions/agent-lead-qualification/index.ts`):**
1. Add a try/catch around the entire processing block that always marks the run as completed/failed — never leaves it stuck
2. Add a timeout guard (45 seconds) so the function completes before the edge function limit
3. Lower the default `min_score_threshold` from 70 to 50 for orgs where < 50 accounts meet the threshold — this captures the compressed 91.Life distribution

**For the parent org (LaunchPulse):** 8,653 accounts score >= 70, mapping to 37,224 leads. Once the agent runs cleanly, this will process in batches of 500 leads per run.

---

## Fix 3: Fix 91.Life Scoring Compression — Bed Count Cap (Critical)

**Problem:** Line 208-212 of `bulk-score-accounts/index.ts`:
```
if (missingRequiredVertical) {
  totalScore = Math.min(totalScore, 69);
  fitScore = Math.min(fitScore, 69);
}
```

When the ICP's vertical_filters have segments with `bed_range` defined, ANY account missing `bed_count` gets hard-capped at 69 (Band B maximum). Since only ~310 of 39,928 accounts have `bed_count` enriched, 99.2% are capped.

**The cap is architecturally correct** — bed count IS important for healthcare targeting. But capping at 69 is too aggressive when enrichment is only 1% complete. During the enrichment ramp-up period, the cap should be softer.

**Fix (in `supabase/functions/bulk-score-accounts/index.ts`):**

Change the cap logic to be proportional rather than a hard ceiling:
- If `missingRequiredVertical` is true, apply a **15-point penalty** instead of a hard cap at 69
- This means an account scoring 85 on all other dimensions drops to 70 (still Band B) instead of 69
- An account scoring 60 drops to 45 (Band C) — still penalized but not all compressed to the same ceiling
- This preserves the signal that bed_count matters while allowing differentiation among accounts

```typescript
// Penalty instead of hard cap when bed_count is missing
if (missingRequiredVertical) {
  totalScore = Math.max(0, totalScore - 15);
  fitScore = Math.max(0, fitScore - 15);
}
```

This immediately redistributes 91.Life's scores from the current compressed distribution (avg 34.1) to a spread that allows meaningful prioritization.

---

## Fix 4: Fix Bulk Scoring Job Failures (High)

**Problem:** 12 of 15 recent scoring jobs for 91.Life failed due to statement timeouts from index bloat on the `scores` table.

**Fix (two parts):**

1. **Manual step (user action):** Run `REINDEX TABLE CONCURRENTLY public.scores;` in the Supabase SQL Editor. This reclaims space from deleted indexes and prevents timeout errors.

2. **Code fix (in `supabase/functions/bulk-score-accounts/index.ts`):** Add error handling around the upsert operation with a retry mechanism — if a single chunk fails with a timeout, retry once with a smaller chunk size (100 instead of 200) before marking the chunk as failed.

---

## Fix 5: Pipeline Stage Advancement (High)

**Problem:** All 53,303 leads are stuck at `pipeline_stage = 'new'`. The `agent-pipeline-controller` is the only function that updates `pipeline_stage`, but it depends on the lead qualification agent succeeding first (Fix 2).

The pipeline controller (line 130-141) updates `pipeline_stage` to `'qualified'` only when:
- `result.affected > 0` (lead qualification agent actually qualified leads)
- AND the lead has `icp_qualified = true` (but the qualification agent sets `status`, not `icp_qualified`)

**Bug:** The pipeline controller filters on `icp_qualified = true` (line 140) but the lead qualification agent sets `status = 'qualified'` — it never sets `icp_qualified`. These are two different fields. The pipeline stage update will never fire.

**Fix (in `supabase/functions/agent-pipeline-controller/index.ts`):**
Change line 140 from:
```typescript
.eq("icp_qualified", true)
```
to:
```typescript
.eq("status", "qualified")
```

This connects the lead qualification output (`status = 'qualified'`) to the pipeline stage advancement.

---

## Fix 6: Verify & Contact Pipeline Activation (Medium)

**Problem:** Only 4 of 53,303 emails verified, 0 phones verified. The verification edge functions exist (`verify-contact`, `verify-phones`) but no cron or bulk trigger invokes them.

**Fix:** Create a new `bulk-verify-contacts` edge function that:
1. Queries leads with `status = 'qualified'` and `email_verified IS NULL`
2. Processes in batches of 50 with rate limiting
3. Calls the existing `verify-contact` function for each lead
4. Designed to run on a cron schedule (every 5 minutes) similar to `enrich-bed-counts`

---

## Implementation Sequence

```text
Step 1: Clean stuck runs (SQL data fix)
   |
Step 2: Fix scoring cap (bulk-score-accounts)
   |
Step 3: User runs REINDEX + re-triggers scoring
   |
Step 4: Fix pipeline_stage filter bug (agent-pipeline-controller)
   |
Step 5: Fix agent-lead-qualification timeout handling
   |
Step 6: Deploy + test — leads should start qualifying
   |
Step 7: (Future) bulk-verify-contacts cron
```

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/bulk-score-accounts/index.ts` | Scoring cap: hard ceiling to penalty; upsert retry logic |
| `supabase/functions/agent-lead-qualification/index.ts` | Always-complete run handling; timeout guard; adaptive threshold |
| `supabase/functions/agent-pipeline-controller/index.ts` | Fix `icp_qualified` to `status = 'qualified'` filter |
| `supabase/functions/bulk-verify-contacts/index.ts` | New function for bulk email/phone verification |

## Expected Outcome

After all fixes:
- 91.Life scoring redistributes from avg 34.1 to ~50-55 (meaningful differentiation)
- Lead qualification processes 37,000+ parent org leads in batches
- Pipeline stages advance: new -> qualified -> follow_up -> meeting_ready
- Verification pipeline activates for qualified leads
- The entire downstream GTM engine (campaigns, CRM export, deals) becomes unblocked

