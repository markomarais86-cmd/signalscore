

# Architecture Improvement Plan — Full Platform Audit

## Assessment Summary

After reviewing all major pages, hooks, and data flows, I found **3 systemic issues** that affect the majority of the platform, plus **4 targeted improvements** for specific subsystems.

---

## Systemic Issue 1: Inconsistent Org Resolution (Critical)

The platform has a well-designed `useDataOrgId()` hook that correctly resolves parent-org for accounts/leads vs child-org for scores/ICPs. But **most pages ignore it**:

| Page | Currently Uses | Should Use |
|---|---|---|
| **Leads** | `useEffectiveOrg()` for accounts+leads queries | `useDataOrgId()` — leads live in parent org |
| **AIAgents** | `useEffectiveOrg()` | Fine (agents are org-specific) |
| **ICPManager** | `useEffectiveOrg()` | Fine (ICPs are child-org) |
| **ListBuilder** | `useEffectiveOrg()` for `search_list_builder` RPC | `useDataOrgId()` — searches accounts+leads |
| **Settings** | `useEffectiveOrg()` | Fine (settings are org-specific) |
| **CampaignBuilderV2** | `useEffectiveOrg()` | `useDataOrgId()` for account/lead queries |
| **useCampaignData** | `userProfile.org_id` directly | `useDataOrgId()` — queries accounts+leads+scores |
| **useICPScoring** | `useEffectiveOrg()` for both accounts AND scores | Split: `dataOrgId` for accounts, `effectiveOrgId` for scores |
| **QuickEnrich** | `useEffectiveOrg()` | `useDataOrgId()` — enriches accounts |

**Impact**: For managed/child organizations, these pages query the wrong org and return zero results.

### Fix
Migrate all account/lead data queries to `useDataOrgId()`. Approximately 6 files need updating. Score and ICP queries stay on `effectiveOrgId`.

---

## Systemic Issue 2: Remaining `as any` Casts (140 instances across 12 hooks)

The previous cleanup addressed `AlertsConfiguration` and `use-value-creation-plan`. The remaining hotspots:

| File | Count | Root Cause |
|---|---|---|
| `use-dashboard-data.ts` | ~10 | RPC functions not in generated types (`get_dashboard_metrics_cached`, `count_campaign_ready_accounts`, `get_data_completeness`) |
| `use-data-org.ts` | 1 | `parent_org_id` not in generated types |
| `useBrandedConfig.ts` | 4 | RPCs `get_branded_config_by_slug/org_id` not typed |
| `use-enriched-leads.tsx` | 4 | Missing `seniority_level`, `department_category` columns |
| `use-notification-dispatcher.ts` | 4 | Realtime payload typing |
| `use-data-change-listener.tsx` | 6 | Realtime payload typing |
| `use-score-history.tsx` | 2 | `old_score`/`new_score` JSON typing |
| `use-org-settings.ts` | 1 | `org_settings` JSONB column |
| `use-icp-scoring.tsx` | 1 | `reasons` JSON typing |

### Fix
1. Create a `src/types/supabase-rpc.ts` file with typed overloads for the ~6 custom RPCs
2. Create `src/types/realtime-payloads.ts` with interfaces for signal, scoring_job, and enrichment_job payloads
3. Replace `as any` with proper typed helpers

---

## Systemic Issue 3: `useICPScoring` Loads All 50K Accounts Client-Side

`use-icp-scoring.tsx` line 75-79 does `.limit(50000)` to load every account into browser memory, then scores them in JS. This is the single largest performance bottleneck for orgs with real data.

### Fix
This scoring should already happen server-side via the `score-accounts` edge function. Remove the client-side scoring loop and make `useICPScoring` read-only (fetch pre-computed scores from the `scores` table). If ad-hoc "what-if" scoring is needed, add a server RPC that returns scored results paginated.

---

## Targeted Improvement 4: Leads Page Uses Hardcoded Score Colors

`Leads.tsx` line 320-324 uses hardcoded `bg-green-500` for score badges instead of brand tokens. Multiple other places in the file likely do the same.

### Fix
Replace with `bg-[hsl(var(--signal-high))]` / `bg-[hsl(var(--signal-medium))]` / `bg-destructive` to match the brand system used everywhere else.

---

## Targeted Improvement 5: List Builder Missing `dataOrgId` + No Score Integration

The List Builder queries accounts but never joins scores. Users can't filter by fit score, which is the platform's core differentiator vs Clay/Apollo.

### Fix
1. Update `search_list_builder` RPC (or create a v2) to accept `p_score_org_id` and join `scores` table
2. Add `fitScoreMin`/`fitScoreMax` to `ListBuilderFilters`
3. Add score column to results table
4. Switch to `useDataOrgId()` for correct managed-org behavior

---

## Targeted Improvement 6: Campaign Builder Uses `userProfile.org_id` Directly

`useCampaignData.ts` bypasses all org resolution hooks and uses `userProfile.org_id` directly. This breaks for super admins viewing other orgs and for managed child orgs.

### Fix
Accept `dataOrgId` and `scoreOrgId` as parameters (or use `useDataOrgId()` internally). Update account queries to use `dataOrgId`, score queries to use `scoreOrgId`.

---

## Targeted Improvement 7: ReportBuilder Wraps Itself in `<Layout>`

`ReportBuilder.tsx` line 56 renders `<Layout>` inside itself, but it's already rendered inside `<Layout>` by `App.tsx`. This causes a double-Layout (double sidebar, double header).

### Fix
Remove the `<Layout>` wrapper from `ReportBuilder.tsx`.

---

## Implementation Order

| Priority | Task | Files |
|---|---|---|
| 1 | Fix org resolution across Leads, ListBuilder, CampaignData, ICPScoring, QuickEnrich | 5 hooks + 2 pages |
| 2 | Remove client-side 50K account load in useICPScoring | 1 hook |
| 3 | Create typed RPC + realtime payload interfaces, eliminate `as any` | 2 new type files + 8 hooks |
| 4 | Fix hardcoded colors in Leads score badges | 1 page |
| 5 | Add score filtering to List Builder | 1 hook + 1 component + 1 RPC |
| 6 | Fix Campaign Builder org resolution | 1 hook |
| 7 | Fix ReportBuilder double-Layout | 1 page |

