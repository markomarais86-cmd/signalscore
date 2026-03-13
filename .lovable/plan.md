
# LaunchPulse Fuel Line Engine — Implementation Plan

## Context
LaunchPulse operates a **Managed Demand Engine** — we run campaigns on behalf of customers.
We're borrowing the "Fuel Line" concept (segmented data pipelines into campaigns) but adapting it to our managed model where **we** control the infrastructure and customers action the output.

TPG doesn't have 28 databases — they repackage a handful of providers. We already have a strong enrichment waterfall (Apollo, PDL, Firecrawl, Perplexity, Hunter). The gap is in **how we route enriched data into campaigns**.

---

## Current State

### What we have
- **CampaignBuilderV2**: 7-step wizard (Setup → Targeting → Sequence → Persona → DataSource → Preview → Export)
- **3 sequence templates**: Enterprise, SMB, Partner
- **Enrichment waterfall**: 8-stage pipeline across 6+ providers
- **ICP scoring**: Automated fit scoring with bulk jobs
- **Account signals**: Intent, tech changes, funding events tracked in `account_signals`
- **Suppression**: Basic dedup via `apollo_redemption_log.redeemed_emails`

### What's missing
1. No concept of **Fuel Line type** — all campaigns use the same generic flow
2. No **suppression list** management (global exclusions)
3. No **signal-to-campaign routing** (signals exist but don't auto-trigger campaigns)
4. No **fuel line performance tracking** (which data source/segment converts best)
5. Sequence templates are hardcoded, not tied to fuel line type

---

## Phase 1: Fuel Line Types in Campaign Builder (UI-only, no migration)

**Goal**: Let operators pick a fuel line type in Step 1 (Setup), which auto-configures targeting, persona, and sequence defaults.

### Fuel Line Definitions

| Fuel Line | Description | Auto-config |
|-----------|-------------|-------------|
| **ABM** | Named accounts from signals/manual selection | Pre-selects signal-triggered accounts, Enterprise sequence |
| **Technographic** | Accounts using specific tech stack | Filters by `tech_stack[]` column, SMB/Enterprise sequence based on size |
| **Firmographic** | Industry + size + geography targeting | Uses existing segment filters, auto-sets employee/revenue ranges |
| **Persona** | Job title + seniority + department first | Leads with persona filters, pulls matching accounts second |

### Files to modify
- `src/components/campaigns/constants/campaign-config.ts` — Add `FUEL_LINE_TYPES` config with defaults per type
- `src/components/campaigns/hooks/useCampaignState.ts` — Add `fuelLineType` to state, auto-apply defaults on selection
- `src/components/campaigns/steps/SetupStep.tsx` — Add fuel line selector cards before campaign name
- `src/components/campaigns/steps/TargetingStep.tsx` — Conditionally show filters based on fuel line type

### No database changes needed — fuel line type is stored in campaign `metadata` JSON on export.

---

## Phase 2: Suppression List Management

**Goal**: Global and per-campaign suppression lists to prevent contacting excluded domains/emails.

### Database (migration)
```sql
CREATE TABLE suppression_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) NOT NULL,
  name text NOT NULL,
  list_type text NOT NULL DEFAULT 'domain', -- 'domain' | 'email' | 'company'
  entries text[] NOT NULL DEFAULT '{}',
  is_global boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE suppression_lists ENABLE ROW LEVEL SECURITY;
```

### Files to create
- `src/components/campaigns/SuppressionListManager.tsx` — CRUD UI for suppression lists
- `src/components/campaigns/steps/PreviewStep.tsx` — Show suppression count in preview stats

### Files to modify
- `src/components/campaigns/hooks/useCampaignData.ts` — Filter out suppressed domains/emails from preview
- `src/components/campaigns/steps/DataSourceStep.tsx` — Add suppression list selector

---

## Phase 3: Signal-to-Campaign Routing

**Goal**: When high-priority signals fire, auto-suggest or auto-create campaigns with the right fuel line pre-selected.

### How it works
1. `account_signals` table already tracks: intent signals, tech stack changes, funding events
2. New component watches for unactioned high-priority signals
3. One-click "Create Campaign" from signal → opens CampaignBuilderV2 with:
   - Fuel line auto-selected based on signal type
   - Accounts pre-loaded from signal
   - Sequence template pre-selected

### Signal → Fuel Line mapping
| Signal Type | Fuel Line | Sequence |
|-------------|-----------|----------|
| `intent` | ABM | Enterprise |
| `tech_change` | Technographic | Enterprise |
| `funding` | ABM | Enterprise |
| `expansion` | Firmographic | Enterprise |
| `new_hire` | Persona | SMB |

### Files to create
- `src/components/campaigns/SignalCampaignRouter.tsx` — Maps signals to campaign configs
- `src/components/dashboard/SignalActionCards.tsx` — Dashboard cards with "Launch Campaign" CTA

### Files to modify
- `src/components/campaigns/CampaignBuilderV2.tsx` — Accept `signalContext` prop alongside `insightContext`

---

## Phase 4: Fuel Line Performance Tracking

**Goal**: Track which fuel line type produces the best results so operators can optimize allocation.

### Database (migration)
```sql
ALTER TABLE campaigns ADD COLUMN fuel_line_type text;
ALTER TABLE campaigns ADD COLUMN signal_source_id uuid REFERENCES account_signals(id);
```

### New dashboard widget
- Conversion rate by fuel line type
- Cost per qualified lead by fuel line
- Time-to-meeting by fuel line
- Uses existing `campaigns` + `campaign_snapshots` data

### Files to create
- `src/components/campaigns/FuelLineAnalytics.tsx` — Performance dashboard
- `src/hooks/use-fuel-line-metrics.ts` — Data fetching hook

---

## Implementation Order

1. **Phase 1** (UI only, no migration) — 1 session
2. **Phase 2** (migration + UI) — 1 session  
3. **Phase 3** (routing logic) — 1 session
4. **Phase 4** (analytics) — 1 session

Each phase is independently shippable. Phase 1 has zero backend risk.

---

## What this is NOT
- We are NOT adding 28 fake data sources
- We are NOT rebranding existing providers as separate databases
- We ARE making our existing enrichment waterfall smarter about HOW data flows into campaigns
- We ARE giving operators control over campaign segmentation strategy
