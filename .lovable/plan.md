

# Consulting-to-SaaS Funnel

## Problem
Today there is no distinction between a "managed" customer (where LaunchPulse does the work) and a "self-service" customer (who logs in and runs the platform themselves). The plan tiers exist but there is no service-type differentiation, no Stripe checkout, and no UI gating based on whether a customer is managed or self-service.

## Two-Tier Model

```text
Tier 1: MANAGED (Consulting Entry Point)
  - LaunchPulse team does ICP builds, data uploads, scoring, reporting
  - Customer sees a read-only dashboard with delivered leads, tasks, and branded reports
  - Pricing: Custom (quoted via sales), billed via Stripe subscription
  - Conversion path: After 90-day pilot, prompt to upgrade to self-service

Tier 2: SELF-SERVICE (Platform Access)
  - Customer logs in and has full access to the platform tools
  - Can upload data, build ICPs, run scoring, configure enrichment
  - Pricing: Professional / Growth / Enterprise tiers via Stripe checkout
  - All existing features enabled based on plan tier
```

## Implementation

### 1. Database: Add `service_type` to Organizations

Add a column to the `organizations` table to distinguish managed vs self-service customers:

```sql
ALTER TABLE organizations
  ADD COLUMN service_type text NOT NULL DEFAULT 'self_service'
  CHECK (service_type IN ('managed', 'self_service'));
```

Also add Stripe fields to track subscriptions:

```sql
ALTER TABLE organizations
  ADD COLUMN stripe_customer_id text,
  ADD COLUMN stripe_subscription_id text,
  ADD COLUMN subscription_status text DEFAULT 'inactive'
    CHECK (subscription_status IN ('inactive', 'trialing', 'active', 'past_due', 'canceled'));
```

No new tables needed -- this extends the existing `organizations` table.

### 2. Stripe Integration

Enable the Lovable Stripe integration to handle subscription billing. This will:

- Create Stripe Products and Prices matching the existing plan tiers (Professional at $2,500/mo, Growth at $5,000/mo, Enterprise custom)
- Create a checkout edge function that creates a Stripe Checkout Session for a given plan
- Create a webhook edge function that listens for `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted` events to sync subscription status back to the `organizations` table
- Create a customer portal edge function so customers can manage billing

### 3. New File: `src/hooks/use-service-type.ts`

A hook that reads the current org's `service_type` from the organizations table:

- Returns `{ serviceType: 'managed' | 'self_service', isManaged: boolean, isSelfService: boolean, loading: boolean }`
- Uses the `effectiveOrgId` from the org-switcher context
- Cached via React Query

### 4. Modify: `src/components/CustomerSidebar.tsx`

Gate navigation items based on `service_type`:

- **Managed customers** see: Dashboard, Leads, Tasks, Opportunities, Settings (read-only data consumption)
- **Self-service customers** additionally see: Data Upload, ICP Manager, Scoring, Enrichment, API Access (platform tools)

Add new nav items for self-service users:

```text
Managed:     Dashboard | Leads | Sales (Tasks, Opps) | Settings
Self-Service: Dashboard | Leads | Sales | Data Upload | ICP Manager | Accounts | Settings
```

### 5. Modify: `src/components/CustomerLayout.tsx`

Add a subtle upgrade banner for managed customers showing "Upgrade to self-service for full platform access" with a CTA that links to the checkout flow.

### 6. New File: `src/pages/CustomerUpgrade.tsx`

A page at `/upgrade` that:

- Shows the plan comparison (Professional vs Growth vs Enterprise)
- Reuses the existing `PLAN_TIERS` config from `plan-tiers.ts`
- Calls the Stripe checkout edge function to create a session
- Redirects to Stripe Checkout
- On success return, updates the org's `service_type` to `self_service` and sets the `plan_id`

### 7. Modify: `src/pages/admin/CustomerOnboarding.tsx`

Add a `service_type` selector (Managed vs Self-Service) to the Company step of the onboarding wizard. This determines:

- Whether LaunchPulse team does the setup work (managed)
- Or the customer gets platform credentials to do it themselves (self-service)

### 8. Modify: `src/components/platform-admin/OrganizationManagementDialog.tsx`

Add the `service_type` field to the org management dialog so super admins can toggle an organization between managed and self-service at any time.

### 9. New File: `src/components/ManagedUpgradeBanner.tsx`

A reusable banner component shown to managed customers:

- "Your account is managed by LaunchPulse. Want to run it yourself?"
- "Upgrade to Self-Service" button
- Dismissible (stores dismissal in localStorage)
- Only shown on the customer dashboard

### 10. Edge Functions for Stripe

Three edge functions (created after enabling Stripe):

- **`create-checkout`**: Creates a Stripe Checkout Session for a given plan tier, attaches the org_id as metadata
- **`stripe-webhook`**: Handles Stripe events to update `organizations.subscription_status` and `service_type`
- **`customer-portal`**: Creates a Stripe Customer Portal session for billing management

## Conversion Flow

```text
1. Sales closes a managed deal
2. Super admin creates org via Customer Onboarding wizard (service_type = 'managed')
3. LaunchPulse team uploads data, builds ICPs, runs scoring using org-switcher
4. Customer logs in, sees branded dashboard with leads/tasks
5. After 90 days, upgrade banner appears more prominently
6. Customer clicks "Upgrade" -> Plan selection -> Stripe Checkout
7. On payment success:
   - organizations.service_type -> 'self_service'
   - organizations.subscription_status -> 'active'
   - organizations.plan_id -> selected plan UUID
8. Customer now sees full sidebar with all platform tools
```

## Security

- `service_type` changes only via super admin or Stripe webhook (RLS policy)
- Stripe webhook validates signature before updating org records
- Customer-facing routes for self-service tools (Data Upload, ICP Manager, etc.) check `service_type` and redirect managed users to the upgrade page
- No client-side privilege checks -- all gating uses database-backed `service_type`

## Implementation Order

1. Enable Stripe integration
2. Run database migration (add columns to organizations)
3. Create `use-service-type` hook
4. Update `CustomerSidebar` with service-type gating
5. Create `CustomerUpgrade` page with plan selection
6. Create Stripe edge functions (checkout, webhook, portal)
7. Add `ManagedUpgradeBanner` to customer dashboard
8. Update admin onboarding wizard and org management dialog
9. Test end-to-end: managed customer login, upgrade flow, self-service access

