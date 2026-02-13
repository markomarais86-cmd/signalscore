

# LaunchPulse v1 → v2 Engineering Roadmap — Implementation Plan

## Current State Audit

After reviewing the full codebase, here's what already exists vs. what needs to be built for each epic:

| Epic | Coverage | Key Existing Assets |
|------|----------|-------------------|
| 1. Customer Intelligence Spine | ~40% | `accounts`, `Leads`, `scores`, `icp_profiles` tables; `use-dashboard-data`, `use-market-intelligence` hooks |
| 2. ICP Execution Engine | ~50% | ICP wizard (5 steps), `icp_feature_weights`, `score-account` function, scoring system |
| 3. Customer Context Processor | ~60% | `parse-icp-document` edge function, PDF text extraction, onboarding flow |
| 4. Strategy Modeling Engine | ~30% | `SimpleTAMCard` with basic TAM/SAM/SOM, `use-capital-data` hook |
| 5. Persona & Coverage Intelligence | ~20% | Persona fields on Leads, basic persona distribution in `use-market-intelligence` |
| 6. Revenue Leakage | ~25% | `DataHealthWidget` with basic gap detection, rebranded to Revenue Integrity Monitor |
| 7. AI Growth Playbook | ~15% | `UnifiedInsightsPanel`, `generate-proactive-insights` edge function |
| 8. Executive Intelligence UI | ~45% | `GrowthCommandKPIs` (just built), dashboard cards, geography, TAM views |
| 9. Board & Consulting Export | ~40% | `branded-pdf-export.ts` with 8-page PDF, jsPDF pipeline |
| 10. Advisor Mode | 0% | Nothing exists |

## Implementation Sequence

The epics have natural dependencies. The recommended build order:

```text
Phase A (Foundation)         Phase B (Intelligence)       Phase C (Strategy)          Phase D (Export & Advisory)
+-------------------------+  +-------------------------+  +-------------------------+  +-------------------------+
| Epic 1: Customer Graph  |  | Epic 5: Persona Engine  |  | Epic 7: AI Playbook     |  | Epic 9: Export Engine    |
| Epic 2: ICP Engine      |->| Epic 6: Rev Leakage     |->| Epic 4: Strategy Model  |->| Epic 10: Advisor Mode   |
| Epic 3: Context Parser  |  | Epic 8: Executive UI    |  |                         |  |                         |
+-------------------------+  +-------------------------+  +-------------------------+  +-------------------------+
```

---

## Phase A — Foundation (Epics 1, 2, 3)

### Epic 1: Customer Intelligence Spine

**1.1 — Unified Customer Graph**

What exists:
- `accounts` table with `org_id`, `industry_norm`, `country`, `tech_stack`
- `Leads` table linked via `account_external_id`
- `scores` table linking accounts to `icp_profiles`
- `icp_profiles` with industries, geographies, personas

What to build:
- New `account_segments` junction table (account_id, segment_id) since accounts currently have no explicit segment assignment
- New `segments` table (id, org_id, name, criteria JSONB, status) — currently segmentation logic lives only in the `Segmentation.tsx` page with no persistence
- Graph query helper: a database function `get_account_lineage(account_id)` returning the full chain (ICP, segment, leads, personas, region, industry) in one call
- Backfill script to auto-assign segments based on existing ICP criteria
- Validation query to check linkage completeness (target: 98%)

Files to create:
- `supabase/migrations/xxx_create_segments_table.sql`
- `supabase/migrations/xxx_create_account_segments.sql`
- `supabase/migrations/xxx_account_lineage_function.sql`

Files to modify:
- `src/pages/Segmentation.tsx` — persist segments to DB instead of in-memory
- `src/hooks/use-segments.tsx` — CRUD operations against new table

**1.2 — Data Integrity Monitor**

What exists:
- `DataHealthWidget.tsx` shows basic completeness metrics
- `use-dashboard-data.ts` calculates some gap percentages

What to build:
- Extend `DataHealthWidget` (now "Revenue Integrity Monitor") with:
  - % missing links (accounts without segments, leads without personas)
  - % stale data (enriched_at older than 90 days)
  - Orphan record count (leads with no matching account)
- Auto-flag broken pipelines: add a `data_integrity_alerts` view or materialized query
- Surface alerts in the `StatusBar` component

Files to modify:
- `src/components/executive/DataHealthWidget.tsx` — add link/stale/orphan metrics
- `src/components/executive/StatusBar.tsx` — surface integrity alerts

---

### Epic 2: ICP Execution Engine

**2.1 — ICP Rules Engine**

What exists:
- `icp_feature_weights` table with dimension weights
- `score-account` edge function using weights
- ICP wizard with 5 configuration steps
- Version tracking on `icp_profiles`

What to build:
- Rule builder UI component allowing drag-and-drop weight adjustment with live preview
- Version comparison view (diff two ICP versions)
- "Recalculate All" trigger that calls `bulk-score-accounts` when weights change
- Rollback button to restore previous ICP version

Files to create:
- `src/components/icp/ICPRuleBuilder.tsx` — visual weight editor with sliders
- `src/components/icp/ICPVersionHistory.tsx` — version list with diff and rollback

Files to modify:
- `src/pages/ICPManager.tsx` — add rule builder tab
- `supabase/functions/bulk-score-accounts/index.ts` — ensure it accepts ICP version parameter

**2.2 — Dynamic Account Tiering**

What exists:
- `score_band` field on `scores` table (A/B/C/D)
- Scoring produces bands but they're not prominently surfaced

What to build:
- Rename "score band" to "tier" in the UI language
- Tier change logging: add `tier_history` table or append to `audit_logs`
- Tier badges on the Accounts table and account detail views
- API endpoint (edge function) to query accounts by tier

Files to create:
- `supabase/migrations/xxx_tier_change_trigger.sql` — log tier changes to audit_logs

Files to modify:
- `src/pages/Accounts.tsx` — add tier badge column, tier filter
- `src/components/executive/GrowthCommandKPIs.tsx` — "Priority Accounts" tile already shows high-fit count; link to tier view

---

### Epic 3: Customer Context Processor

**3.1 — Onboarding Intelligence Parser**

What exists:
- `parse-icp-document` edge function using Gemini with structured tool calling
- Client-side PDF text extraction via `pdfjs-dist`
- `org_onboarding_config` table storing parsed results

What to build:
- Website crawl integration: call `firecrawl-scrape` during onboarding to extract value prop, differentiators from the company website
- Manual override UI: editable fields on the parsed output before it's saved
- Structured JSON schema validation on parsed output
- Store extraction confidence scores

Files to modify:
- `supabase/functions/parse-icp-document/index.ts` — add website crawl step
- `src/pages/admin/CustomerOnboarding.tsx` — add editable review step after parsing

**3.2 — AI ICP Generator (Fix)**

What exists:
- `generate-icp-recommendations` edge function (just updated to use onboarding data)
- ICP creation wizard

What to build:
- Chain: onboarding config + website crawl + existing account data into a single AI prompt
- Display rationale alongside each generated ICP field ("Why this industry? Because your website mentions...")
- Editable output with accept/reject per field
- Performance target: complete generation within 60s

Files to modify:
- `supabase/functions/generate-icp-recommendations/index.ts` — add rationale output, use firecrawl data
- `src/pages/ICPManager.tsx` — show rationale in AI generation results

---

## Phase B — Intelligence Layer (Epics 5, 6, 8)

### Epic 5: Persona & Coverage Intelligence

**5.1 — Persona Mapping Engine**

What exists:
- `Leads.title`, `Leads.seniority`, `Leads.department` fields
- `enrich-contacts-persona` edge function
- Basic persona distribution in market intelligence

What to build:
- New `persona_definitions` table (org_id, name, title_patterns, seniority_levels, departments, is_custom)
- Classification logic: match lead title/seniority against persona definitions, store `persona_id` on Leads
- Confidence scoring based on match quality
- Custom persona creation UI

Files to create:
- `supabase/migrations/xxx_persona_definitions.sql`
- `src/components/executive/PersonaCoveragePanel.tsx` — per-segment persona coverage table
- `src/hooks/use-persona-mapping.ts`

**5.2 — Coverage Risk Analyzer**

What to build:
- Per-account risk score: accounts with only 1 lead flagged as "Single-Threaded"
- Missing persona detection: compare account's leads against ICP persona requirements
- Risk alerts surfaced in account detail and dashboard

Files to create:
- `src/components/executive/CoverageRiskAnalyzer.tsx`
- Database function `compute_coverage_risk(org_id)` returning risk scores per account

---

### Epic 6: Revenue Leakage & Data Monetization

**6.1 — Leakage Attribution Engine**

What exists:
- `DataHealthWidget` calculates missing data percentages
- Revenue at Risk KPI tile in GrowthCommandKPIs

What to build:
- Leakage categories: Missing Contacts, Stale Data, No Intent, No Enrichment
- Per-category dollar impact calculation using average deal size and conversion rates
- Drill-down from leakage summary to affected accounts
- Auto-generated leakage report

Files to create:
- `src/components/executive/RevenueLeakageEngine.tsx`
- `src/hooks/use-revenue-leakage.ts`

**6.2 — Recovery Modeling**

What to build:
- Predict uplift from enriching/fixing specific data gaps
- "If you enrich these 200 accounts, estimated recovery = X" scenarios
- Link to enrichment actions

Files to create:
- `src/components/executive/RecoveryModeling.tsx`

---

### Epic 8: Executive Intelligence UI

**8.1 — Growth Command Center** — DONE (Phase 1 just completed)

**8.2 — Strategy Views**

What exists:
- TAM/SAM/SOM card, Geography card, ICP coverage
- Accounts and Leads tables

What to build:
- Market Position view (ICP Performance Matrix — 2x2 quadrant)
- Revenue Model view (scenarios)
- Coverage view (persona penetration)
- Geographic Growth Map (Core/Expansion/White Space layers)
- Account Prioritization view (readiness-scored table)

Files to create:
- `src/components/executive/ICPPerformanceMatrix.tsx`
- `src/components/executive/PriorityAccountsTable.tsx`
- All integrated into `ExecutiveDashboard.tsx` as scrollable sections

---

## Phase C — Strategy Layer (Epics 4, 7)

### Epic 4: Strategy Modeling Engine

**4.1 — Market Economics Model**

What exists:
- `SimpleTAMCard` with basic TAM/SAM/SOM
- Settings popover for deal size and conversion rate

What to build:
- Three-scenario calculator: Conservative (0.5x), Base (1x), Aggressive (1.5x) multipliers
- Win-rate bands by segment
- Pipeline velocity calculation
- Recalculate on ICP change (listen to ICP update events)

Files to modify:
- `src/components/executive/SimpleTAMCard.tsx` — add scenario tabs

**4.2 — Effort-to-Return Optimizer**

What to build:
- Rank segments by estimated ROI (deal size x win rate / effort)
- Marginal returns visualization
- Expose assumptions as editable inputs

Files to create:
- `src/components/executive/EffortReturnOptimizer.tsx`

---

### Epic 7: AI Growth Playbook

**7.1 — Quarterly Strategy Generator**

What to build:
- New edge function `generate-growth-plays` using account/ICP/segment data
- Generate 3 plays per quarter: Vertical, Geo, Persona
- Each play: Rationale, Impact estimate, Action steps
- Editable by user

Files to create:
- `supabase/functions/generate-growth-plays/index.ts`
- `src/components/executive/GrowthPlaybook.tsx`
- `src/components/executive/ActivationRoadmap.tsx` (30/60/90 day plan)

**7.2 — Campaign Linkage**

What exists:
- `push-campaign-to-crm` edge function
- HubSpot sync infrastructure

What to build:
- Link plays to HubSpot campaigns via existing sync
- Attribution tracking from play to campaign to pipeline

Files to modify:
- `supabase/functions/hubspot-sync/index.ts` — add campaign linkage

---

## Phase D — Export & Advisory (Epics 9, 10)

### Epic 9: Board & Consulting Export

**9.1 — Narrative Builder**

What exists:
- `branded-pdf-export.ts` with AI-generated executive narrative

What to build:
- Template system: configurable section ordering
- Preview mode before export
- Include all 7 mandatory sections (as defined in the spec)

**9.2 — PDF/PPT Generator**

What to build:
- PowerPoint export (using a library like `pptxgenjs`)
- Ensure branding consistency across formats
- Target: less than 30s generation time

Files to create:
- `src/utils/pptx-export.ts`

---

### Epic 10: Advisor Mode

**10.1 — Strategy Annotation Layer**

What to build:
- `advisor_annotations` table (org_id, section, annotation_text, created_by, version)
- Overlay UI visible only to admin/consultant roles
- Manual notes, overrides, and targets per dashboard section

Files to create:
- `supabase/migrations/xxx_advisor_annotations.sql`
- `src/components/executive/AdvisorModeOverlay.tsx`

**10.2 — Scenario Simulator**

What to build:
- Adjustable inputs: spend, coverage, focus area
- Real-time recalculation of revenue projections
- Side-by-side scenario comparison

Files to create:
- `src/components/executive/ScenarioSimulator.tsx`

---

## Recommended Starting Point

Phase A is the foundation everything else depends on. Within Phase A, the recommended order is:

1. Epic 1.1 — Segments table + account-segment linkage (enables tiering, persona coverage, and strategy views)
2. Epic 2.2 — Dynamic Account Tiering (surfaces existing score bands as tiers)
3. Epic 3.2 — AI ICP Generator fix (already partially done, needs rationale output)
4. Epic 1.2 — Data Integrity Monitor (extends the just-built Revenue Integrity Monitor)
5. Epic 2.1 — ICP Rules Engine UI (visual weight editor)

This gives you the data backbone before building the intelligence and strategy layers on top.

