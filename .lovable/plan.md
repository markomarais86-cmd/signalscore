
# GTM Systems Assessment -- Full Diagnostic

## Executive Summary

Your GTM pipeline has **5 critical issues**, **3 high-priority issues**, and **2 medium-priority items**. The pipeline is currently blocked at Stage 1 (Lead Qualification) -- zero leads have been qualified, meaning the entire downstream funnel (enrichment, follow-up, meeting scheduling) is idle.

---

## 1. Systems Map

```text
DATA LAYER                    SCORING LAYER                PIPELINE LAYER
-----------                   -------------                --------------
39,928 accounts               22,715 scored (57%)          53,190 open leads
  - 724 w/ bed_count (1.8%)   17,213 unscored (43%)        0 qualified leads
  - 1,958 missing industry    0 Band A (80+)               0 followed-up
  - 2,899 missing emp count   1,859 Band B (70-79)         0 meeting-ready
  - 621 missing country       5,082 Band B (60-69)
  - 1,192 missing revenue     17,633 Band C/D (<60)        53,162 matched to accounts
                                                            141 unmatched
                              Max score: 77
                              Avg score: 44

CRON JOBS (7 active)          AGENTS                       INTEGRATIONS
--------------------          ------                       ------------
[OK]  job-auto-recovery       0 registered agents          Apollo: key works, credits
[OK]  enrich-bed-counts       (ai_agent_registry empty)      not trackable (403)
[OK]  scheduled-agent-runner
[BUG] auto-score-daily        ICP Profiles:                CRM sync: cron active
[OK]  crm-sync-periodic       Parent: 1 active               (no crm_connections table)
[OK]  auto-match-leads        Child: 1 active
[OK]  weekly-quality-snapshot
```

---

## 2. Critical Issues (P0 -- Revenue Blocking)

### CRIT-1: Auto-Score Daily Cron Missing `org_id` in Body

The `auto-score-accounts-daily` cron (job 4) calls `bulk-score-accounts` but does NOT include `org_id` in the request body. It only passes `chunk_size` and `triggered_by`. The `bulk-score-accounts` function requires `org_id` and will reject every request with a 400 validation error.

Additionally, the cron queries `organizations WHERE is_active = true`, but the `organizations` table has **no `is_active` column** -- this query silently fails or returns 0 rows.

**Impact:** Daily scoring never runs. All 17,213 unscored accounts stay unscored.

**Fix:** Reschedule the cron to pass `org_id` from each organization row and remove the `is_active` filter:
```sql
SELECT cron.unschedule('auto-score-accounts-daily');
SELECT cron.schedule(
  'auto-score-accounts-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/bulk-score-accounts',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
    body := jsonb_build_object('org_id', id, 'chunk_size', 500, 'triggered_by', 'scheduled')
  ) as request_id
  FROM public.organizations;
  $$
);
```

### CRIT-2: Zero Band A Accounts -- Scoring Ceiling at 77

The maximum score across all 22,715 scored accounts is **77**. No account reaches Band A (80+). This means the ICP scoring engine is structurally capped. The segment scoring (30 points) requires `bed_count` data, but only 724/39,928 accounts (1.8%) have it. Accounts missing `bed_count` get a 15% penalty AND a hard cap at 69 for the segment portion.

**Impact:** The pipeline's "high-value" filters at 70+ or 80+ return thin or empty result sets, starving downstream agents.

**Fix:** This is being addressed by the `enrich-bed-counts` pipeline fix (deployed earlier today). As bed counts populate, scores will naturally rise above 80. No code change needed -- just time for the cron to process all 39,204 remaining accounts at 200/batch every 2 minutes (~6.5 hours to complete).

### CRIT-3: Lead Qualification Agent -- Child Org Has No Scores

The `agent-lead-qualification` fix was deployed earlier to use `dataOrgId` for scores queries. However, the child org `cd592f73-3e0e-478d-905b-47fe7c5fb634` has **0 scores**. The parent org `726a0dc0` has 22,715 scores. The fix should now correctly pull parent scores, but this needs verification via a test invocation.

### CRIT-4: Bulk Scoring Jobs Keep Failing

All recent scoring jobs have failed:
- Job 53823758: Failed at chunk 77/200 (15,400 processed) -- "Auto-recovery failed after 3 attempts"
- Job d6c92111: Failed at chunk 10/80 (5,000 processed) -- "index bloat caused statement timeouts"
- Job b2e398e6: Failed at chunk 196/80 (51,500 processed) -- same
- Job b7d00cef: Failed at chunk 6/80 (3,000 processed) -- same

The scoring function times out at 50s per invocation. With 39,928 accounts and chunk size 500, it needs 80 chunks, each making N+2 DB queries per account (account lookup + intent RPC + reachability RPC). This is too many round-trips.

**Impact:** 17,213 accounts remain unscored. Jobs never complete.

**Fix:** Reduce chunk size to 200 in the cron body. The JS scoring engine in `bulk-score-accounts` already does most scoring in-memory, but the intent map fetch and individual account lookups create bottlenecks. Alternatively, increase the job's resilience by having auto-recovery resume from the last successful chunk (which it already does, but 3 retries isn't enough for systematic timeouts).

### CRIT-5: Zero Agents Registered

The `ai_agent_registry` table is **empty**. The `scheduled-agent-runner` cron fires hourly but has nothing to run. The `agent-coordinator` and `agent-pipeline-controller` rely on registry entries to find and invoke agents.

**Impact:** No autonomous agent execution. The entire agent framework is dormant.

**Fix:** Register the core agents:
```sql
INSERT INTO ai_agent_registry (org_id, agent_name, capabilities, status) VALUES
('cd592f73-3e0e-478d-905b-47fe7c5fb634', 'lead_qualification', '["qualify_leads"]', 'active'),
('cd592f73-3e0e-478d-905b-47fe7c5fb634', 'data_enrichment', '["enrich_accounts"]', 'active'),
('cd592f73-3e0e-478d-905b-47fe7c5fb634', 'follow_up', '["follow_up_leads"]', 'active'),
('cd592f73-3e0e-478d-905b-47fe7c5fb634', 'meeting_scheduler', '["schedule_meetings"]', 'active');
```
(Need to check `ai_agent_registry` columns first.)

---

## 3. High-Priority Issues (P1)

### HIGH-1: Pipeline Stage Never Advances Beyond "new"

All 53,303 leads have `pipeline_stage = 'new'`. The `agent-pipeline-controller` updates pipeline_stage to `'qualified'` only when leads have `status = 'qualified'`, but 0 leads are qualified. Even after the lead-qualification agent fix, the first run needs to happen and succeed.

### HIGH-2: 43% of Accounts Unscored

17,213 accounts have no score at all. Combined with the auto-score cron being broken (CRIT-1), these will never get scored unless manually triggered.

### HIGH-3: Data Completeness Gaps

| Field | Missing | % of 39,928 |
|-------|---------|-------------|
| bed_count | 39,204 | 98.2% |
| employee_count | 2,899 | 7.3% |
| industry_norm | 1,958 | 4.9% |
| revenue_range | 1,192 | 3.0% |
| country | 621 | 1.6% |
| domain | 0 | 0% |

The bed_count gap is being actively filled by the fixed enrichment cron. The other gaps affect scoring accuracy but aren't pipeline blockers.

---

## 4. Medium Priority (P2)

### MED-1: Score History / Intent Signal Data Thin

The scoring engine computes intent from `score_history`, but since most scoring jobs fail partway through, history accumulation is slow. Intent scores default to 50 for most accounts.

### MED-2: Pipeline Controller Uses Child org_id for Score Queries

The `agent-pipeline-controller` passes `org_id` directly to score queries (line 165) without resolving `dataOrgId`. This means the data enrichment stage queries scores for the child org (which has 0 scores) rather than the parent. Same parent/child mismatch pattern as the lead qualification agent.

---

## 5. Recommended Fix Sequence

| Priority | Fix | Impact | Effort |
|----------|-----|--------|--------|
| 1 | Fix auto-score-daily cron (CRIT-1) | Enables daily scoring of all accounts | SQL only |
| 2 | Register agents in ai_agent_registry (CRIT-5) | Enables autonomous agent execution | SQL only |
| 3 | Fix pipeline-controller org_id for scores (MED-2) | Correct enrichment stage targeting | 1 line change |
| 4 | Reduce bulk-score chunk size (CRIT-4) | Reduce timeout failures | SQL cron update |
| 5 | Wait for bed_count enrichment (CRIT-2) | Scores rise above 77 ceiling | Automated (6.5h) |
| 6 | Trigger lead qualification test run | Verify CRIT-3 fix works | Manual invocation |

## 6. Implementation Plan

### Step 1: Fix auto-score-daily cron
Unschedule the broken cron and reschedule with `org_id` passed from each org row, removing the non-existent `is_active` column reference.

### Step 2: Check ai_agent_registry schema and register agents
Query the table schema, then insert the 4 core pipeline agents for the child org.

### Step 3: Fix agent-pipeline-controller
Update score queries on line 165 to resolve `dataOrgId` from the organization's `parent_org_id`, matching the pattern used in `agent-lead-qualification`.

### Step 4: Update bulk-score chunk size
Reduce the cron's chunk_size from 5000 to 500 (matching the function's default `CHUNK_SIZE` constant) to prevent timeouts.

### Step 5: Verify pipeline end-to-end
After fixes are deployed, invoke `agent-pipeline-controller` with `dry_run: true` to verify each stage sees records, then run live.
