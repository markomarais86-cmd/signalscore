
# Align Plan Tiers: Database and Frontend to Match Pricing Page

## The Problem

Your Pricing Page shows: **Pilot, Professional, Growth, Enterprise**
Your Database and Frontend use: **Free, Starter, Professional, Enterprise**

This creates inconsistency where customers see one set of tiers on the marketing site, but your admin tools and enforcement use completely different ones.

---

## Source of Truth: Pricing Page

From `src/pages/Pricing.tsx` (lines 29-97):

| Tier | Accounts | ICP Models | Credits | Integrations | History |
|------|----------|------------|---------|--------------|---------|
| **Pilot** | 3,000 | 1 | 500 total | 1 (manual) | 3 months |
| **Professional** | 10,000 | 3 | 1,000/mo | 2 | 12 months |
| **Growth** | 30,000 | 10 | 3,000/mo | unlimited | 24 months |
| **Enterprise** | unlimited | unlimited | 10K+/mo | custom | full |

Credit Packs (lines 100-125):
- Starter: 200 credits
- Growth: 1,000 credits
- Scale: 5,000 credits
- Enterprise: 25,000 credits

---

## Changes Required

### 1. Database: Update `plan_limits` Table

**Current rows to update/add:**

| plan_name | Current → New Credits | Current → New Accounts |
|-----------|----------------------|----------------------|
| free | 50/mo | Keep as-is (internal trial tier) |
| ~~starter~~ → **pilot** | 500/mo → 500 total | 1,000 → 3,000 |
| professional | 5,000/mo → 1,000/mo | 10,000 (same) |
| **growth** (NEW) | — → 3,000/mo | — → 30,000 |
| enterprise | unlimited (same) | unlimited (same) |

**New columns needed:**
- `max_icp_models` (integer) - Track ICP model limits per plan
- `max_integrations` (integer, null = unlimited)
- `history_months` (integer) - Data history retention

**Migration SQL:**
```sql
-- Add new columns
ALTER TABLE plan_limits 
ADD COLUMN IF NOT EXISTS max_icp_models integer,
ADD COLUMN IF NOT EXISTS max_integrations integer,
ADD COLUMN IF NOT EXISTS history_months integer DEFAULT 3;

-- Rename starter → pilot
UPDATE plan_limits SET 
  plan_name = 'pilot',
  display_name = 'Pilot',
  max_accounts = 3000,
  enrichment_credits_monthly = 500,
  max_icp_models = 1,
  max_integrations = 1,
  history_months = 3,
  sort_order = 2
WHERE plan_name = 'starter';

-- Update professional
UPDATE plan_limits SET
  enrichment_credits_monthly = 1000,
  max_icp_models = 3,
  max_integrations = 2,
  history_months = 12
WHERE plan_name = 'professional';

-- Insert growth tier
INSERT INTO plan_limits (plan_name, display_name, max_accounts, max_users, enrichment_credits_monthly, max_icp_models, max_integrations, history_months, features, sort_order, is_active)
VALUES ('growth', 'Growth', 30000, 25, 3000, 10, NULL, 24, 
  '{"basic_analytics":true,"basic_enrichment":true,"ai_enrichment":true,"pipeline_analytics":true,"crm_sync":true,"deep_research":true,"alerts":true,"benchmarking":true}',
  4, true);

-- Update enterprise
UPDATE plan_limits SET
  max_icp_models = NULL,
  max_integrations = NULL,
  history_months = NULL,
  sort_order = 5
WHERE plan_name = 'enterprise';

-- Update free tier sort order
UPDATE plan_limits SET sort_order = 1 WHERE plan_name = 'free';
```

### 2. Frontend: Rewrite `src/lib/plan-tiers.ts`

**Update the PlanTier type:**
```typescript
// Old
export type PlanTier = 'free' | 'starter' | 'professional' | 'enterprise';

// New
export type PlanTier = 'free' | 'pilot' | 'professional' | 'growth' | 'enterprise';
```

**Update PlanTierConfig interface:**
```typescript
limits: {
  maxAccounts: number | null;
  maxLeads: number | null;
  maxUsers: number | null;
  maxCrmIntegrations: number | null;
  maxIcpModels: number | null;        // NEW
  maxIntegrations: number | null;      // NEW
  historyMonths: number | null;        // NEW
};
```

**New tier configurations:**
```typescript
pilot: {
  id: 'pilot',
  displayName: 'Pilot',
  monthlyEnrichmentCredits: 500, // Total, not monthly
  limits: {
    maxAccounts: 3000,
    maxUsers: 3,
    maxIcpModels: 1,
    maxIntegrations: 1,
    historyMonths: 3,
  },
  features: {
    basicTam: true,
    advancedTam: false,
    personaInsights: true,
    aiAgents: true,
    crmSync: false,
    apiAccess: false,
    sso: false,
    customReporting: false,
    benchmarking: false,    // NEW
    multiRegion: false,     // NEW
    subIndustry: false,     // NEW
  },
},
professional: {
  id: 'professional',
  displayName: 'Professional',
  monthlyEnrichmentCredits: 1000,
  limits: {
    maxAccounts: 10000,
    maxUsers: 10,
    maxIcpModels: 3,
    maxIntegrations: 2,
    historyMonths: 12,
  },
  features: {
    basicTam: true,
    advancedTam: true,
    personaInsights: true,
    aiAgents: true,
    crmSync: true,
    multiRegion: true,
    // ...
  },
},
growth: {
  id: 'growth',
  displayName: 'Growth',
  monthlyEnrichmentCredits: 3000,
  limits: {
    maxAccounts: 30000,
    maxUsers: 25,
    maxIcpModels: 10,
    maxIntegrations: null, // unlimited
    historyMonths: 24,
  },
  features: {
    // All professional features plus:
    subIndustry: true,
    benchmarking: true,
  },
},
enterprise: {
  // All unlimited, all features
},
```

**Update credit packs to match pricing page:**
```typescript
export const ENRICHMENT_CREDIT_PACKS: EnrichmentCreditPack[] = [
  { id: 'starter', name: 'Starter', credits: 200, price: 39, perCredit: 0.20 },
  { id: 'growth', name: 'Growth', credits: 1000, price: 149, perCredit: 0.15, popular: true },
  { id: 'scale', name: 'Scale', credits: 5000, price: 499, perCredit: 0.10 },
  { id: 'enterprise', name: 'Enterprise', credits: 25000, price: 1999, perCredit: 0.08 },
];
```

### 3. Update Admin Components

**`OrganizationManagementDialog.tsx`:**
- Add plan selector dropdown using PLAN_TIER_LIST
- Show plan limits in the dialog
- Allow setting ICP model limits

**`CreditManagementDashboard.tsx`:**
- No changes needed - already uses `getPlanDisplayName()` which will auto-update

---

## Feature Comparison Alignment

From Pricing page `featureComparison` (lines 127-139):

| Feature | Pilot | Pro | Growth | Enterprise |
|---------|-------|-----|--------|------------|
| ICP and TAM Engine | ✓ | ✓ | ✓ | ✓ |
| Revenue Signal Index | ✓ | ✓ | ✓ | ✓ |
| Board Dashboards | ✓ | ✓ | ✓ | ✓ |
| Persona Conversion | ✓ | ✓ | ✓ | ✓ |
| Multi-Region Analytics | — | ✓ | ✓ | ✓ |
| Sub-Industry Modeling | — | — | ✓ | ✓ |
| Benchmarking Index | — | — | ✓ | ✓ |
| Portfolio View | — | — | — | ✓ |
| API Access | — | — | — | ✓ |
| SSO / SLA | — | — | — | ✓ |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/plan-tiers.ts` | Complete rewrite with new tiers and features |
| `src/components/platform-admin/OrganizationManagementDialog.tsx` | Add plan selector, show limits |

## Database Migration Required

Run SQL migration to:
1. Add new columns: `max_icp_models`, `max_integrations`, `history_months`
2. Rename `starter` to `pilot`
3. Update credit amounts to match pricing page
4. Insert new `growth` tier

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| Tier names | Free, Starter, Pro, Enterprise | Free, Pilot, Pro, Growth, Enterprise |
| Professional credits | 5,000/mo | 1,000/mo |
| Growth tier | Missing | 3,000/mo, 30K accounts |
| ICP limits | Not tracked | 1 → 3 → 10 → unlimited |
| Integration limits | Not tracked | 1 → 2 → unlimited |
| Credit packs | 250/1000/5000/25000 | 200/1000/5000/25000 |
