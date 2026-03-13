

# LaunchPulse Fuel Line Engine — Detailed Implementation Plan

## What Exists Today

| Component | Status |
|---|---|
| Campaign Builder (7-step wizard) | Working — Setup, Targeting, Sequence, Persona, DataSource, Preview, Export |
| 3 sequence templates | Enterprise, SMB, Partner (hardcoded in `campaign-config.ts`) |
| `campaigns` table | Has `campaign_type`, `metadata` JSON, `account_ids`, `status` |
| `account_signals` table | Tracks intent, tech changes, funding with priority + signal_type |
| `suppression_rules` table | Already exists (domain, email, suppression_type, reason) |
| `AccountExclusions.tsx` | UI exists but `saveExclusions()` is a no-op stub — doesn't write to DB |
| Enrichment waterfall | 8-stage pipeline across 6+ providers |
| Leads `suppression_reason` field | Exists on Leads table but unused in campaign filtering |

## Key Insight
You already have `suppression_rules` table and `AccountExclusions` UI — they're just not wired together or integrated into campaign creation. Phase 2 is mostly connecting existing pieces.

---

## Phase 1: Fuel Line Types in Campaign Builder (UI-only)

**Goal**: Add a fuel line selector to Step 1 that auto-configures targeting, persona, and sequence defaults.

### 1A. Add Fuel Line Config
**File**: `src/components/campaigns/constants/campaign-config.ts`
- Add `FUEL_LINE_TYPES` constant with 4 types:
  - **ABM** — Pre-selects signal-triggered accounts, Enterprise sequence, C-Level/VP management levels
  - **Technographic** — Filters by tech stack column on accounts, auto-selects sequence based on company size
  - **Firmographic** — Uses existing segment filters, sets employee/revenue ranges
  - **Persona** — Leads with persona filters (titles, seniority, departments first), then pulls matching accounts
- Each type defines: `defaultTemplate`, `defaultManagementLevels`, `defaultMarketSegments`, `defaultDataSource`, description, icon

### 1B. Add Fuel Line to State
**File**: `src/components/campaigns/hooks/useCampaignState.ts`
- Add `fuelLineType: 'abm' | 'technographic' | 'firmographic' | 'persona'` to `CampaignState`
- Add `setFuelLineType` setter that auto-applies defaults from config (template, management levels, market segments, data source)
- Default to `'firmographic'` (closest to current behavior)

### 1C. Fuel Line Selector UI
**File**: `src/components/campaigns/steps/SetupStep.tsx`
- Add 4 clickable cards above campaign name input, each showing: icon, title, one-line description
- Selecting a fuel line visually highlights the card and auto-fills downstream defaults
- Pass `fuelLineType` and `setFuelLineType` as new props

### 1D. Conditional Targeting
**File**: `src/components/campaigns/steps/TargetingStep.tsx`
- **ABM mode**: Show account search/signal-based account picker instead of generic filters
- **Technographic mode**: Add tech stack multi-select filter (reads `tech_stack` from accounts table)
- **Firmographic mode**: Current behavior (employee count, revenue, market segment)
- **Persona mode**: Move persona filters (from Step 4) into Step 2, show account count as secondary

### 1E. Wire Into Builder
**File**: `src/components/campaigns/CampaignBuilderV2.tsx`
- Pass `fuelLineType`/`setFuelLineType` to `SetupStep`
- Pass `fuelLineType` to `TargetingStep` for conditional rendering
- Store `fuel_line_type` in campaign `metadata` JSON on export (no migration needed)

**No database changes. No migration. Pure frontend.**

---

## Phase 2: Suppression List Integration

**Goal**: Wire existing `suppression_rules` table and `AccountExclusions` UI into campaign creation flow.

### 2A. Fix AccountExclusions Save
**File**: `src/components/settings/AccountExclusions.tsx`
- Replace the stub `saveExclusions()` with actual inserts into `suppression_rules` table
- Load existing suppression rules on mount
- Support delete (remove from table)

### 2B. Suppression Hook
**File**: `src/hooks/use-suppression-rules.ts` (new)
- Fetch all `suppression_rules` for the org
- Provide `addRule`, `removeRule`, `isSupressed(domain/email)` helpers
- Cache with React Query

### 2C. Filter Suppressed in Campaign Preview
**File**: `src/components/campaigns/hooks/useCampaignData.ts`
- Before setting `previewData`, filter out accounts whose domain matches any `suppression_rules` entry
- Show suppressed count in the preview stats

### 2D. Suppression Selector in DataSource Step
**File**: `src/components/campaigns/steps/DataSourceStep.tsx`
- Add toggle: "Apply global suppression list" (default: on)
- Show count: "X domains/emails will be excluded"

### 2E. Suppression Count in Preview
**File**: `src/components/campaigns/steps/PreviewStep.tsx`
- Add a card showing: "X accounts suppressed" with reason breakdown
- Sits alongside the existing deduplication warning

**Migration**: None — `suppression_rules` table already exists.

---

## Phase 3: Signal-to-Campaign Routing

**Goal**: Unactioned high-priority signals auto-suggest campaigns with the right fuel line pre-selected.

### 3A. Signal-to-Fuel-Line Mapping
**File**: `src/components/campaigns/constants/campaign-config.ts`
- Add `SIGNAL_FUEL_LINE_MAP`:

```text
intent       → ABM fuel line, Enterprise sequence
tech_change  → Technographic fuel line, Enterprise sequence
funding      → ABM fuel line, Enterprise sequence
expansion    → Firmographic fuel line, Enterprise sequence
new_hire     → Persona fuel line, SMB sequence
```

### 3B. Signal Action Cards on Dashboard
**File**: `src/components/dashboard/SignalActionCards.tsx` (new)
- Query `account_signals` where `actioned_at IS NULL` and `signal_priority = 'high'`
- Group by signal_type, show count per type
- Each card has "Launch Campaign" button

### 3C. Signal Context in Campaign Builder
**File**: `src/components/campaigns/CampaignBuilderV2.tsx`
- Add `signalContext` prop: `{ signalType, signalIds, accountExternalIds }`
- When provided: auto-select fuel line from mapping, pre-load accounts from signal, mark signals as actioned on export

### 3D. Update Signal Hook
**File**: `src/hooks/useAccountSignals.ts`
- Add `getUnactionedHighPriority()` query
- Add `bulkAction(signalIds[])` mutation for marking signals actioned after campaign creation

**No migration needed — uses existing `account_signals` table.**

---

## Phase 4: Fuel Line Performance Tracking

**Goal**: Track which fuel line type converts best so operators can optimize allocation.

### 4A. Schema Migration
- Add columns to `campaigns` table:
  - `fuel_line_type text` — stores ABM/Technographic/Firmographic/Persona
  - `signal_source_id uuid REFERENCES account_signals(id)` — links campaign to triggering signal

### 4B. Update Campaign Export
**File**: `src/components/campaigns/hooks/useCampaignExport.ts`
- When creating campaign, write `fuel_line_type` and `signal_source_id` to the `campaigns` table row (not just metadata JSON)

### 4C. Fuel Line Analytics Dashboard
**File**: `src/components/campaigns/FuelLineAnalytics.tsx` (new)
- Query `campaigns` grouped by `fuel_line_type`
- Show:
  - Campaign count per fuel line
  - Total accounts/contacts per fuel line
  - Average score band distribution per fuel line
  - Campaigns from signals vs manual

### 4D. Analytics Hook
**File**: `src/hooks/use-fuel-line-metrics.ts` (new)
- Supabase queries joining `campaigns` + `campaign_snapshots`
- Grouped aggregations by `fuel_line_type`
- React Query with 5-min stale time

---

## Implementation Order

| Phase | Scope | DB Changes | Risk |
|-------|-------|-----------|------|
| **Phase 1** | UI only — fuel line selector + conditional targeting | None | Zero |
| **Phase 2** | Wire existing suppression_rules into campaigns | None (table exists) | Low |
| **Phase 3** | Signal routing + dashboard cards | None (table exists) | Low |
| **Phase 4** | Analytics + 2 new columns on campaigns | Migration | Medium |

Each phase ships independently. Phase 1 has zero backend risk and delivers the most visible UX improvement.

