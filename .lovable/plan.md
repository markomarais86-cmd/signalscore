

# LaunchPulse ICP & Intelligence Brief Rebuild

This is a comprehensive rebuild across four major areas: ICP model structure, scoring engine, system-wide ICP propagation, and a unified 9-page intelligence document. Given the scale, this plan is organized into 3 implementation phases.

---

## Phase 1: ICP Model Rebuild (Weighted, Layered, Versioned)

### 1A. Database Schema Changes

Add weighting and versioning support to `icp_profiles`:

**New columns on `icp_profiles`:**
- `weights` (JSONB) -- per-field weight (1-10) and mandatory/bonus flags
- `disqualifiers` (JSONB) -- structured hard-no criteria (excluded geos, sizes, industries)
- `version_notes` (TEXT) -- changelog per version
- `scoring_config` (JSONB) -- ACV, win rate, scenario assumptions (conservative/base/aggressive)

**New table: `icp_versions`**
- Stores snapshots of each ICP version with full criteria, weights, and performance metrics
- Columns: `id`, `icp_id`, `version`, `snapshot` (JSONB), `performance_delta` (JSONB), `created_at`
- Automatically populated via a trigger on `icp_profiles` UPDATE

**New table: `revenue_assumptions`**
- `org_id`, `acv_source` (manual/closed-won), `acv_value`, `win_rate_source`, `win_rate_value`, `scenarios` (JSONB with conservative/base/aggressive multipliers), `updated_at`
- Replaces hardcoded `DEFAULT_ACV = 75000` and `DEFAULT_CONVERSION_RATE = 0.15`

### 1B. ICP Wizard Updates (4-Layer Structure)

Restructure the existing 5-step wizard into the 4-layer model:

| Current Step | New Layer |
|---|---|
| Step 1 (Basic Info) | Kept as-is (metadata) |
| Step 2 (Company Targeting) | **Layer 1: Firmographic Core** -- add ownership type field, per-field weight sliders (1-10), mandatory/bonus toggles |
| Step 3 (Persona Targeting) | **Layer 3: Buying Committee** -- add minimum persona coverage threshold, seniority minimum |
| Step 4 (Advanced Targeting) | **Layer 2: Operational Fit** -- tech stack, business model, maturity, growth signals, funding |
| New Step | **Layer 4: Disqualifiers** -- move exclusion criteria from Step 4 into dedicated step with hard-no logic |

Each field gets a small weight control:
```
[Industry] [Weight: 8/10] [x Mandatory] [ ] Bonus
```

### 1C. ICP Versioning UI

- Show current version badge in ICP detail view: "v3 -- Updated Feb 2026"
- Version history tab showing snapshots with delta comparison
- Auto-increment version on save with changelog prompt
- Board reports display: "Current ICP version: v3"

**Files changed:**
- `src/types/icp.ts` -- add `weights`, `disqualifiers`, `scoring_config` to ICPFormData/ICPProfile
- `src/components/icp/ICPWizardStep2.tsx` -- add weight sliders per field
- `src/components/icp/ICPWizardStep4.tsx` -- split exclusions into new Step 5
- `src/components/icp/ICPWizardStep5Disqualifiers.tsx` -- **new** dedicated disqualifier step
- `src/components/icp/ICPVersionHistory.tsx` -- **new** version comparison component
- `src/components/icp/ICPWeightControl.tsx` -- **new** reusable weight slider with mandatory/bonus
- Migration SQL for schema changes

---

## Phase 2: Scoring Engine Rebuild (Weighted, Transparent, Debuggable)

### 2A. Weighted Composite Scoring

Replace the current equal-weight scoring (4 factors at 100 points each, total 400) with a weighted model that reads weights from the ICP profile.

**Update `calculate_account_score` SQL function:**
- Read `weights` JSONB from `icp_profiles` row
- Each dimension score (0-100) multiplied by its weight
- Mandatory fields: if a mandatory field doesn't match, cap total score at 25 (hard fail)
- Bonus fields: add extra points but don't penalize if missing
- Store per-field breakdown in `scores.reasons` JSONB

**Score breakdown stored per account:**
```json
{
  "industry": { "score": 100, "weight": 8, "weighted": 32, "mandatory": true, "matched": true },
  "size": { "score": 80, "weight": 6, "weighted": 19.2, "mandatory": false, "matched": true },
  "revenue": { "score": 0, "weight": 4, "weighted": 0, "mandatory": false, "matched": false },
  "geography": { "score": 100, "weight": 5, "weighted": 20, "mandatory": false, "matched": true },
  "tech_stack": { "score": 50, "weight": 3, "weighted": 6, "bonus": true },
  "total_weighted": 77.2,
  "overall": 77
}
```

### 2B. Account Score Debug View

Add a "Score Breakdown" expandable section on each account card/detail showing:
- Points per field with weight multiplier
- Which criteria matched vs missed
- Missing data fields highlighted
- "Why this score?" explanation

**Files changed:**
- Migration: update `calculate_account_score` function
- `src/hooks/use-icp-scoring.tsx` -- update to pass weights
- `src/components/accounts/AccountScoreBreakdown.tsx` -- **new** debug component

### 2C. ICP Change Triggers Recalculation

- On ICP save (active status): trigger batch re-score of all accounts
- Use existing `rescore_on_icp_update` trigger but ensure it uses new weighted logic
- Show progress toast: "Re-scoring 14,360 accounts..."
- Target: complete in under 60 seconds for datasets up to 50K accounts

---

## Phase 3: Unified Intelligence Brief (9 Pages, One Document)

### 3A. Merge Board Report + Strategic Brief into One Document

Replace both `branded-pdf-export.ts` (8 pages) and `pdf-export.ts` with a single `intelligence-brief-export.ts` producing a 9-page document.

**Page structure:**

| Page | Title | Data Source |
|---|---|---|
| 1 | Cover: "Growth and Revenue Intelligence Brief" | Branding, date, thesis line |
| 2 | Strategic Position Snapshot | Real metrics: TAR (modeled), active pipeline, high-fit, revenue at risk, campaign readiness (with explanation why 0) |
| 3 | ICP Definition (Full Detail) | ICP version, all 4 layers rendered, weight table, disqualifiers, match distribution chart |
| 4 | ICP Performance Analysis | % accounts matching each layer, where scoring fails, too-narrow/too-broad analysis |
| 5 | Revenue Model (TAM/SAM/SOM) | Uses `revenue_assumptions` table -- ACV source labeled, win rate source labeled, 3 scenarios (conservative/base/aggressive) |
| 6 | Segment and Industry Prioritization | Revenue per segment, conversion likelihood, ICP concentration, execution risk. Actions: Focus/Expand/Maintain/Exit (not just "Deprioritize") |
| 7 | Geographic Strategy | Revenue per region, ICP density, white space analysis |
| 8 | Priority Accounts (Top 10) | Revenue estimate, tier, readiness, coverage gaps, recommended action |
| 9 | Risk and Leakage + 90-Day Plan | Unified risk model with single revenue-at-risk number; 3 plays with revenue impact, owner field, KPI target |

### 3B. Fix Specific Report Issues

1. **"0 campaign-ready"**: Define campaign-ready as: ICP match >= 70 AND >= 2 personas AND valid email AND intent > 40. Show breakdown of why 0 (e.g., "0 accounts meet all 4 criteria: 8,972 have ICP match, but 0 have intent data").

2. **Segment actions**: Replace `deriveSegmentAction` logic:
   - Current: only returns Invest/Harvest/Deprioritize
   - New: returns **Focus** (high-fit >= 40% AND above median volume), **Expand** (high-fit >= 40% AND below median), **Maintain** (high-fit 15-40%), **Exit** (high-fit < 15%)

3. **Revenue modeling transparency**: Each revenue number labeled with source:
   - "ACV: $75K (default -- no closed-won data uploaded)"
   - "Win Rate: 15% (default -- upload closed-won deals to calibrate)"
   - Conservative/Base/Aggressive scenario toggle

4. **No contradictory static text**: All narrative text dynamically generated from actual data. Remove any hardcoded phrases like "Zero high-fit accounts identified."

5. **ICP version on Page 3**: Show "Current ICP: Enterprise Technology v3 -- Updated Jan 2026"

### 3C. Revenue Assumptions Settings Page

Add a "Revenue Modeling" section to Settings:
- Editable ACV (with source: manual vs closed-won average)
- Editable win rate (with source)
- Scenario multipliers (conservative 0.7x, base 1.0x, aggressive 1.5x)
- Saved to `revenue_assumptions` table
- All reports and dashboards read from this table

**Files changed:**
- `src/utils/intelligence-brief-export.ts` -- **new** unified 9-page PDF generator
- `src/utils/revenue-modeling.ts` -- update `deriveSegmentAction` to 4-tier; add scenario support
- `src/hooks/use-branded-report.ts` -- switch to new unified generator; read revenue_assumptions
- `src/components/settings/RevenueModelingSettings.tsx` -- **new** settings component
- `src/utils/branded-pdf-export.ts` -- deprecated (kept for backward compat, redirects to new)
- Migration SQL for `revenue_assumptions` table

---

## Summary of All New/Changed Files

| File | Status | Description |
|---|---|---|
| Migration SQL | New | `icp_profiles` weights/disqualifiers columns, `icp_versions` table, `revenue_assumptions` table, updated `calculate_account_score` |
| `src/types/icp.ts` | Modified | Add weights, disqualifiers, scoring_config types |
| `src/components/icp/ICPWeightControl.tsx` | New | Reusable weight slider (1-10) + mandatory/bonus toggle |
| `src/components/icp/ICPWizardStep2.tsx` | Modified | Add weight controls to each firmographic field |
| `src/components/icp/ICPWizardStep4.tsx` | Modified | Remove exclusions (moved to Step 5) |
| `src/components/icp/ICPWizardStep5Disqualifiers.tsx` | New | Dedicated disqualifier/hard-no step |
| `src/components/icp/ICPVersionHistory.tsx` | New | Version comparison timeline |
| `src/components/accounts/AccountScoreBreakdown.tsx` | New | Per-account score debug panel |
| `src/hooks/use-icp-scoring.tsx` | Modified | Pass weights to scoring function |
| `src/utils/revenue-modeling.ts` | Modified | 4-tier segment actions; scenario multipliers; read from DB |
| `src/utils/intelligence-brief-export.ts` | New | Unified 9-page PDF generator |
| `src/hooks/use-branded-report.ts` | Modified | Use new generator; fetch revenue assumptions |
| `src/components/settings/RevenueModelingSettings.tsx` | New | ACV/win-rate/scenario editor |

---

## Implementation Order

Given the size, this should be implemented in this sequence:

1. **Database migrations first** (schema changes, new tables)
2. **ICP weight controls + types** (Phase 1B, 1C)
3. **Scoring engine update** (Phase 2A, 2B)
4. **Revenue assumptions settings** (Phase 3C)
5. **Unified intelligence brief** (Phase 3A, 3B)

Each step builds on the previous and can be tested independently.

