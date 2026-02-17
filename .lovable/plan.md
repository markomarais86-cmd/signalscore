

# Make Everything Real: Eliminate Static Data, Add AI Everywhere, Reduce Latency

## Current State Summary

| Area | Status | Problem |
|------|--------|---------|
| Average Deal Size | Hardcoded `$75,000` in 6+ files | Not real -- every TAM/SAM/SOM calculation uses a fake number |
| Account Insights | 0 records in `account_insights` | AI insights panel has nothing to show |
| Account Signals | 0 records in `account_signals` | Intent engine has no signal data |
| Lead Enrichment | 98 of 53,303 enriched (0.18%) | LinkedIn, persona, direct phone mostly empty |
| Funding/Tech | 2 funded, 319 with tech stack (of 40k) | Intent scoring starved |
| Dashboard AI | Insights panel exists but generates only rule-based fallback | No proactive AI recommendations |
| Account AI Chat | Works but only on individual accounts | No bulk or dashboard-level AI |
| TAM Settings | User can change deal size in popover but it resets on page reload | Not persisted |

## Plan: 7 Improvements

### 1. Persist Average Deal Size and Conversion Rate in the Database

**Problem**: `averageDealSize = 75000` is hardcoded in 6 components. User can change it in the TAM card popover, but it resets on reload.

**Fix**: 
- Add an `org_settings` query that reads/writes `average_deal_size` and `conversion_rate` from the `icp_profiles` table (or a new `org_settings` JSONB column on `organizations`).
- Create a small hook `useOrgSettings` that fetches and persists these values.
- Replace the hardcoded `75000` in `SimpleTAMCard`, `GrowthCommandKPIs`, `ExecutiveDashboard`, `TAMOverviewCard`, `EnhancedTAMCard`, and `TAMSAMSOMCalculator` with the persisted value.

**Files**: New `src/hooks/use-org-settings.ts`, edits to 6 components.

---

### 2. Auto-Generate Account Insights on Dashboard Load

**Problem**: `account_insights` table has 0 rows. The `generate-account-insights` edge function exists and works, but nothing triggers it at scale.

**Fix**:
- Add a "Generate AI Insights" button to the UnifiedInsightsPanel that calls `generate-proactive-insights` for the org (already exists as an edge function).
- On dashboard load, if `account_insights` count is 0 and the org has scored accounts, auto-trigger a batch of 10 top-scoring accounts through `generate-account-insights`.
- Show a subtle loading indicator ("Generating AI insights for your top accounts...") during this process.

**Files**: Edit `UnifiedInsightsPanel.tsx`, edit `ExecutiveDashboard.tsx`.

---

### 3. Populate Account Signals via compute-intent-signals

**Problem**: `account_signals` has 0 rows. The `compute-intent-signals` edge function was recently updated to use `score_history` as a fallback, but nothing triggers it.

**Fix**:
- Add a "Compute Signals" step to the BulkScoring flow: after scoring completes, automatically call `compute-intent-signals` for the top 100 scored accounts.
- Add a standalone "Compute Intent Signals" button next to the existing "Enrich Intent Data" button.

**Files**: Edit `BulkScoring.tsx`, minor edit to `use-intent-enrichment.ts`.

---

### 4. Batch Lead Enrichment Trigger

**Problem**: Only 98 of 53,303 leads are enriched. The `enrich-unified` edge function supports lead enrichment, but there is no UI to trigger it in bulk.

**Fix**:
- Add a "Bulk Enrich Leads" action on the Leads page header (next to existing filters).
- Use the existing `useUnifiedEnrichment` hook's `enrichLeads` method.
- Select up to 50 leads at a time where `enriched_at IS NULL` and `email IS NOT NULL`, call `enrich-unified` with `record_type: 'lead'`.
- Show progress toast.

**Files**: Edit `src/components/leads/EnrichedLeadsHeader.tsx` or `src/pages/Leads.tsx`.

---

### 5. AI Summary Widget on Dashboard

**Problem**: The dashboard shows metrics but no AI narrative. Users must click into individual accounts for AI chat.

**Fix**:
- Add a compact "AI Brief" card to the ExecutiveDashboard that calls the `ai-chat` edge function on load with a system prompt like: "Summarize the user's current data: X accounts, Y scored, Z high-fit, W campaign-ready. Top risk: ... Recommended action: ..."
- Cache the response in `localStorage` with a 1-hour TTL to reduce latency on repeat visits.
- Show a "Refresh" button to regenerate.

**Files**: New `src/components/executive/AIBriefCard.tsx`, edit `ExecutiveDashboard.tsx`.

---

### 6. Reduce Dashboard Latency with Parallel Queries and Skeleton Loading

**Problem**: Dashboard loads sequentially -- metrics, then geography, then insights, then trends. Each waits for the previous.

**Fix**:
- Ensure all React Query hooks in `ExecutiveDashboard` fire in parallel (most already do, but `generateInsights()` and `calculateTrends()` are called inside a `useEffect` that depends on `dashboardData` -- move them to independent queries).
- Add proper skeleton states for each card section so the dashboard feels instant.
- Use `staleTime: 5 * 60 * 1000` on dashboard queries so navigation back to the dashboard is instant.

**Files**: Edit `ExecutiveDashboard.tsx`, edit `src/hooks/use-dashboard-data.ts`.

---

### 7. One-Click "Power Up" Action

**Problem**: Users need to manually run 4 separate actions (Enrich Intent Data, Score All, Compute Signals, Generate Insights) to get the system fully working.

**Fix**:
- Add a single "Power Up" button on the dashboard that sequentially runs:
  1. Enrich Intent Data (funding + tech stack)
  2. Bulk Score All Accounts
  3. Compute Intent Signals (top 100)
  4. Generate AI Insights (top 10)
- Show a stepper/progress indicator as each phase completes.
- This becomes the "first time setup" action after data upload.

**Files**: New `src/components/executive/PowerUpButton.tsx`, edit `ExecutiveDashboard.tsx`.

---

## Technical Details

### New Files
| File | Purpose |
|------|---------|
| `src/hooks/use-org-settings.ts` | Persist deal size, conversion rate per org |
| `src/components/executive/AIBriefCard.tsx` | AI narrative summary on dashboard |
| `src/components/executive/PowerUpButton.tsx` | One-click orchestration of all enrichment/scoring/signals/insights |

### Modified Files
| File | Change |
|------|--------|
| `ExecutiveDashboard.tsx` | Add AIBriefCard, PowerUpButton, parallel query optimization, replace hardcoded deal size |
| `UnifiedInsightsPanel.tsx` | Auto-trigger proactive insights generation |
| `BulkScoring.tsx` | Post-scoring auto-compute signals |
| `SimpleTAMCard.tsx` | Use persisted deal size from hook |
| `GrowthCommandKPIs.tsx` | Use persisted deal size from hook |
| `TAMOverviewCard.tsx` | Use persisted deal size |
| `EnhancedTAMCard.tsx` | Use persisted deal size |
| `TAMSAMSOMCalculator.tsx` | Use persisted deal size |
| `Leads.tsx` or `EnrichedLeadsHeader.tsx` | Add bulk lead enrichment button |
| `use-dashboard-data.ts` | Add staleTime for faster re-navigation |

### No New Edge Functions Required
All AI and enrichment edge functions already exist. This plan wires them up to the UI properly.

