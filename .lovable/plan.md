

# Executive Intelligence View — Full Implementation Plan

## Current State vs. Spec

The existing Executive Dashboard has basic coverage for about 40% of the spec. Here's what maps and what's entirely new:

| Spec Section | Status | Current Component |
|---|---|---|
| 1. Growth Command Center | Partial | `SimplifiedHeroMetrics` — needs different KPIs |
| 2. Strategic Position View | NEW | No quadrant matrix or segment health bars |
| 3. Revenue Opportunity Engine | Partial | `SimpleTAMCard` — needs scenario modelling |
| 4. Account Monetisation View | NEW | No priority accounts table with readiness |
| 5. Territory & Expansion | Partial | `SimpleGeographyCard` — needs Core/Expansion/White Space layers |
| 6. Persona & Buying Committee | NEW | No persona coverage analysis |
| 7. Data Quality & Revenue Leakage | Partial | `DataHealthWidget` — needs revenue framing |
| 8. AI Strategy Engine | NEW | `UnifiedInsightsPanel` exists but no quarterly playbooks |
| 9. Execution Roadmap | NEW | No 90-day plan |
| 10. Board Report Generator | Partial | PDF export exists — needs all 7 mandatory sections |
| 11. Consulting Overlay Mode | NEW | No advisor mode |
| 12. Governance Rules | Apply | Language/UX rules to enforce across all views |
| 13. Customer Journey | Workflow | Onboarding flow changes |
| 14. Commercial Outcome | Positioning | No code changes |

## Phased Approach

Given the scope (~14 major features), this should be built in 4 phases to keep each deliverable testable.

---

### Phase 1: Rebrand + Hero KPIs + Language Governance (Foundation)

**Goal**: Transform the dashboard header and top-level metrics to match the spec's "Growth Command Center" language.

**Changes**:
- Rename "Executive Dashboard" to "Growth Command Center" in the page header
- Replace `SimplifiedHeroMetrics` KPIs from (Total Accounts / Total Leads / Campaign Ready) to the spec's 5 tiles:
  - Market Coverage % (accounts in system / TAM estimate)
  - Revenue-Ready % (accounts with usable contacts / total)
  - Priority Accounts (high-fit + high-readiness count)
  - Pipeline Potential (modelled upside from TAM/SAM/SOM)
  - Revenue at Risk (from data gaps, pulled from DataHealthWidget logic)
- Apply governance rules: no "records", no "rows" — use Revenue/Risk/Opportunity/Impact language
- Colour-code tiles vs benchmarks (green >70%, amber 40-70%, red <40%)
- Every tile shows a "So What" subtitle

**Files**: `ExecutiveDashboard.tsx`, `SimplifiedHeroMetrics.tsx` (rewrite)

---

### Phase 2: Strategic Views (Sections 2, 4, 6, 7)

**Goal**: Add the analytical depth layers beneath the hero.

**2a. ICP Performance Matrix (Section 2)**
- New component: `ICPPerformanceMatrix.tsx`
- 2x2 quadrant chart (High/Low Value vs High/Low Fit)
- Plots segments with "Core Focus / Test / Prune / Ignore" labels
- Segment Health Bars showing Coverage, Penetration, Conversion, Growth per segment
- Each segment tagged: "Invest / Maintain / Exit"

**2b. Priority Revenue Accounts (Section 4)**
- New component: `PriorityAccountsTable.tsx`
- Table: Account | Segment | Est Value | Readiness | Coverage | Next Action
- Readiness = composite of Data + Intent + Persona + History scores
- Every row has a recommended action (auto-generated from score logic)
- Filter out "dead rows" (accounts with 0 readiness)

**2c. Decision-Maker Penetration (Section 6)**
- New component: `PersonaCoveragePanel.tsx`
- For each segment: Persona | Coverage % | Gap | Risk
- Flag "Single-Threaded Deals" (accounts with only 1 contact)
- Data source: `Leads` table grouped by title/role per account

**2d. Revenue Integrity Monitor (Section 7)**
- Enhance existing `DataHealthWidget.tsx`
- Reframe from "Data Health" to "Revenue Integrity Monitor"
- Add leakage table: Leakage Source | Impact | Recovery Value
- Sources: Missing contacts, Stale data, No intent, No enrichment
- Auto-calculate: "You are losing ~$X/month due to data gaps"

**Files**: 4 new components in `src/components/executive/`, update `ExecutiveDashboard.tsx` layout

---

### Phase 3: Revenue Engine + Geography + AI Playbook (Sections 3, 5, 8, 9)

**3a. Revenue Potential Model (Section 3)**
- Enhance `SimpleTAMCard.tsx` to add Conservative / Base / Aggressive scenarios
- Add win-rate band and pipeline velocity metrics
- Auto-calculate 3 scenarios using configurable multipliers
- Keep the existing settings popover for deal size / conversion

**3b. Geographic Growth Map (Section 5)**
- Enhance `SimpleGeographyCard.tsx` with 3 layers:
  - Core (fully monetised regions)
  - Expansion (high upside)
  - White Space (untapped)
- Each region shows: Pipeline, Coverage, Growth trend, Risk
- Classification logic based on account density + conversion rates

**3c. Growth Playbook (Section 8)**
- New component: `GrowthPlaybook.tsx`
- Auto-generates 3 quarterly plays: Vertical, Geo, Persona
- Each play: Why | Impact | Steps | Link to Campaign
- Uses AI (edge function) to generate plays from account/ICP data
- New edge function: `generate-growth-plays`

**3d. 90-Day Activation Plan (Section 9)**
- New component: `ActivationRoadmap.tsx`
- 30/60/90 day phased table: Phase | Actions | Owner | Expected Outcome
- Auto-generated from Growth Playbook plays
- Editable inline (saves to `org_onboarding_config` or new table)

**Files**: Enhance 2 components, create 2 new components, 1 new edge function

---

### Phase 4: Export Engine + Advisor Mode (Sections 10, 11)

**4a. Board Report Generator (Section 10)**
- Enhance `branded-pdf-export.ts` to include ALL 7 mandatory sections:
  1. Executive Summary
  2. Market Position (ICP quadrant)
  3. Revenue Model (TAM/SAM/SOM with scenarios)
  4. Priority Accounts (top 20 with readiness)
  5. Growth Plays (from AI Strategy Engine)
  6. Risk & Leakage (Revenue Integrity data)
  7. Activation Plan (90-day roadmap)
- No optional sections — all always included

**4b. Consulting Overlay Mode (Section 11)**
- New component: `AdvisorModeOverlay.tsx`
- Toggle visible only to admin/consultant roles
- Features: Manual annotations on any card, Scenario overlays, Custom plays, Margin modelling
- Stored per-org in a new `advisor_annotations` table
- Pricing sensitivity calculator

**Files**: Enhance PDF export, 1 new component, 1 new DB table, role-based visibility

---

## Technical Notes

- **No new pages** — all sections render as cards/panels within the existing `ExecutiveDashboard.tsx`, keeping the single-scroll experience
- **Navigation**: Sections can be jumped to via the existing Command Palette (Cmd+K)
- **Data sources**: All metrics derive from existing tables (`accounts`, `scores`, `Leads`, `icp_profiles`, `external_data_sources`) — no new data ingestion needed except the `advisor_annotations` table in Phase 4
- **Edge functions**: 1 new function (`generate-growth-plays`) in Phase 3
- **Language governance**: Applied incrementally — Phase 1 sets the pattern, Phases 2-4 follow it
- **Performance**: Each section uses independent React Query hooks with 5-min stale times, so adding sections won't cascade re-renders
- **DataHealthWidget bug**: Currently uses `userProfile?.org_id` instead of `effectiveOrgId` — will be fixed in Phase 1

## Recommended Starting Point

Phase 1 is the quickest win (2-3 components to modify, no new DB tables, no edge functions). It immediately transforms the look and language of the dashboard. Should I proceed with Phase 1?

