
## Full Platform Audit: Consulting Readiness Analysis

### Current State Summary

| Capability | Status | Notes |
|---|---|---|
| Account data ingestion | Working | 39,928 accounts loaded via parent org (LaunchPulse) |
| Lead data ingestion | Working | 53,303 leads loaded |
| ICP definition | Working | 1 active ICP per org |
| Bulk scoring | Working | 39,928 accounts scored for 91.Life (avg score 34) |
| Score distribution | Working | 2,837 High-Fit / 17,110 Medium / 19,981 Low |
| Strategic Brief (board report) | Working | Fixed RPC aggregation + ICP-only filtering |
| Closed-won upload | Working | But only for self-service orgs (LaunchPulse has 53, 91.Life has 0) |
| Customer sidebar (managed view) | Working | Read-only dashboard, leads, sales |
| Admin onboarding wizard | Working | 6-step flow: Company, ICP, Team, Routing, Campaigns, Review |
| Dashboard metrics | Working | Cached RPC with graceful fallback |

---

### Issues Found (What's Broken or Missing)

#### 1. Closed-Won Upload is NOT Per-Customer (CRITICAL)
The `ClosedWonUpload` component writes to `userProfile.org_id` -- the logged-in user's org. For the consulting model, the admin (LaunchPulse) uploads closed-won data, but it always saves under the LaunchPulse org ID, NOT the child customer org.

**Result**: 91.Life has 0 closed-won deals. LaunchPulse has 53. There's no way to upload closed-won deals for a specific customer from the admin view.

**Fix**: Add an org selector to the Closed-Won Upload (or integrate it into the Admin Onboarding flow) so admins can upload closed-won data against the child org ID.

#### 2. Scoring Shows "Not Scored" on Dashboard Despite Having Scores
91.Life has 39,928 scores in the `scores` table but the dashboard may show stale cached metrics (the `get_dashboard_metrics_cached` timeout issue was fixed, but the cache may need a refresh after scoring).

**Fix**: After bulk scoring completes, invalidate/refresh the dashboard metrics cache for that org.

#### 3. No Auto-Score Trigger After Data Upload
When new account data or closed-won deals are uploaded for a customer, there's no automatic trigger to run bulk scoring. The admin must manually go to the scoring page and kick it off.

**Fix**: Add a "Score Now" button to the Admin Onboarding flow, or auto-trigger scoring after data upload completes.

#### 4. Consulting Audit Workflow Has No Structured Checklist
When onboarding a new customer, the admin needs a repeatable process:
1. Upload account data (or confirm parent org data is shared)
2. Upload closed-won deals for that customer
3. Define ICP for that customer
4. Run bulk scoring
5. Generate strategic brief
6. Deliver to customer

Currently steps 2-5 are scattered across different pages with no unified workflow.

---

### What Customers Will Ask For (Audit Deliverables)

Based on the platform's capabilities, a consulting customer audit should deliver:

1. **TAM/SAM/SOM Analysis** -- "How big is my addressable market?" (Already in board report)
2. **ICP Validation** -- "Does my ICP match my closed-won history?" (Requires closed-won data per customer)
3. **Account Scoring & Prioritization** -- "Which accounts should I pursue first?" (Working, but needs per-customer closed-won to calibrate)
4. **Industry/Geo/Size Breakdown** -- "Where are my best-fit accounts concentrated?" (Fixed with RPCs)
5. **Data Quality Assessment** -- "How complete is my account data?" (In board report)
6. **Top Prospects List** -- "Give me my top 10 accounts to go after" (In board report)
7. **Revenue Modeling** -- "What's my pipeline potential?" (In board report, but ACV is hardcoded at $75K)

---

### Implementation Plan

#### Phase 1: Per-Customer Closed-Won Upload (High Priority)

**Database**: No schema changes needed -- `closed_won_deals` already has `org_id`.

**Edge Function**: Update `analyze-closed-won` to accept an optional `target_org_id` parameter so admins can run analysis against a child org.

**Frontend**: 
- Add an org selector dropdown to `ClosedWonUpload` component (visible only to super admins)
- When an admin selects a child org, uploads go to that org's `org_id` instead of the admin's own org
- Add a "Closed Won" step to the Admin Onboarding wizard (`CustomerOnboarding.tsx`)

#### Phase 2: Post-Upload Auto-Score Trigger

**Frontend**: After closed-won upload completes for a customer org, show a "Score Accounts Now" CTA button that triggers `bulk-score-accounts` for that org.

**Edge Function**: After bulk scoring completes, automatically call `get_dashboard_metrics_cached` with a cache-bust flag to refresh metrics.

#### Phase 3: Consulting Audit Dashboard

**Frontend**: Create a unified "Audit Checklist" card in the Admin Onboarding flow that shows completion status:
- Account data loaded (check parent org account count)
- Closed-won deals uploaded (check `closed_won_deals` count for child org)
- ICP defined (check `icp_profiles` count for child org)
- Accounts scored (check `scores` count for child org)
- Strategic brief generated (check if report exists)

Each item links to the relevant action page.

#### Phase 4: Customer-Specific ACV

**Database**: Add `default_acv` column to `organizations` table.

**Edge Function**: Update `generate-board-report` to use the org's ACV instead of the hardcoded $75K, so revenue modeling is accurate per customer.

---

### Technical Details

**Files to modify:**
- `src/components/data-upload/ClosedWonUpload.tsx` -- Add org selector for admin mode
- `supabase/functions/analyze-closed-won/index.ts` -- Accept `target_org_id` param
- `src/pages/admin/CustomerOnboarding.tsx` -- Add closed-won step + audit checklist
- `src/components/BulkScoring.tsx` -- Add post-score cache refresh
- `supabase/functions/generate-board-report/index.ts` -- Use per-org ACV

**New files:**
- `src/components/admin/OnboardingStepClosedWon.tsx` -- Closed-won upload embedded in onboarding
- `src/components/admin/AuditChecklist.tsx` -- Status checklist for consulting workflow

**Database migration:**
- Add `default_acv` numeric column to `organizations` table (nullable, defaults to null = use $75K)
