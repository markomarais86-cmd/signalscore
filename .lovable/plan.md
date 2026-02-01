
# Complete LaunchPulse Website + Payments Integration Plan

## Overview

This plan consolidates everything into one unified app at launchpulse.io:
1. Marketing website rebuilt from launchpulse.org (Home, About, Product, Contact)
2. Dedicated Pricing page with Platform tiers + Enrichment Credits
3. Stripe integration for self-serve credit purchases and upgrades
4. Competitive "undercut" pricing based on cost analysis

---

## Pricing Strategy Summary

### Platform Subscription Tiers

| Tier | Price | Accounts | Users | CRM Integrations | Included Credits |
|------|-------|----------|-------|------------------|------------------|
| **Starter** | $299/mo | 2,500 | 5 | 1 | 50/mo |
| **Professional** | $699/mo | 10,000 | 15 | Unlimited | 250/mo |
| **Enterprise** | Custom | Unlimited | Unlimited | + API, SSO | Custom |

### Enrichment Credit Packs (Undercut Pricing)

Based on internal cost analysis ($0.029/lead) and competitor benchmarks:

| Pack | Credits | Price | Per Credit | Margin | vs Competitors |
|------|---------|-------|------------|--------|----------------|
| **Starter** | 250 | $49 | $0.20 | 85% | 60% cheaper than Apollo |
| **Growth** | 1,000 | $149 | $0.15 | 80% | 70% cheaper than Apollo |
| **Scale** | 5,000 | $499 | $0.10 | 70% | 80% cheaper than Apollo |
| **Enterprise** | 25,000 | $1,999 | $0.08 | 64% | 85% cheaper than Apollo |

---

## Current State

| Component | Status |
|-----------|--------|
| Auth System | Built (sign-in, sign-up, invitation) |
| Plan Tiers Config | Exists but needs restructuring |
| Credit System | Built (tracking, consumption, admin) |
| Marketing Pages | Need to be built |
| Pricing Page | Needs dedicated page |
| Stripe | Not configured |

---

## Phase 1: Marketing Website

### Step 1: Create Shared Marketing Components

Create `src/components/marketing/` folder with:

**MarketingNav.tsx** - Sticky navigation
- Logo (LaunchPulseMark)
- Links: Home, About, Product, Pricing
- "Sign In" and "Request Demo" buttons
- Mobile hamburger menu
- Backdrop blur effect

**MarketingFooter.tsx** - Consistent footer
- Logo with tagline
- Navigation links
- Social icons
- Copyright

**MarketingHero.tsx** - Reusable hero section component
- Gradient text highlights (teal accent on keywords)
- Subtitle text
- CTA buttons
- Optional graphics

**FeatureCard.tsx** - Feature display cards
- Icon in teal circle
- Title and description
- Hover effects

**PainPointCard.tsx** - Problem statement cards
- Red X icon
- Pain point text

**DemoRequestForm.tsx** - Contact form
- Name, email, company, subject, message fields
- Validation with zod + react-hook-form
- Loading states
- Success/error handling

### Step 2: Rebuild Landing Page (Home)

Replace `src/pages/Landing.tsx` matching launchpulse.org design:

**Hero Section**
- Headline: "AI-Driven ICP and TAM Intelligence for High-Performance GTM Teams"
- Subheadline: "LaunchPulse pinpoints your highest-converting customer profile, validates ICP alignment inside your CRM, and exposes where pipeline yield is being constrained by data quality, persona coverage, or segment misfit."
- "Request Demo" and "Watch Demo" CTAs
- Dashboard preview graphics

**Pain Points Section ("Why GTM Teams Stall")**
- ICP is built on assumptions, not conversion evidence
- TAM is static, poorly segmented, and rarely tied to ICP reality
- CRM data obscures persona coverage, segment gaps, and lead quality risk
- Leadership lacks a clear diagnostic view of what's blocking yield

**Features Section ("What LaunchPulse Delivers")**
- AI ICP Builder - Define and validate your ICP using real conversion patterns
- TAM Generator - Generate a dynamic, segmentable TAM aligned to your ICP
- CRM Insight Layer - Diagnose pipeline misalignment by surfacing data quality risk
- **Data Enrichment Engine** (NEW 4th pillar) - Multi-source data verification at 60-85% less than competitors

**CTA Section**
- "Request Early Access" with form or link to /contact

### Step 3: Create About Page

Create `src/pages/About.tsx`:

**Hero Section**
- "LaunchPulse exists to make GTM targeting measurable, explainable, and operational"

**"The LaunchPulse Difference" Section** - 4 cards:
- Evidence-Based ICP (not opinion-based targeting)
- Explainable Diagnostics (not opaque scoring)
- Stack-Enhancing by Design (not a rip-and-replace platform)
- Fast Time-to-Value (without heavy implementation)

**Bottom CTA Section**

### Step 4: Create Product Page

Create `src/pages/Product.tsx`:

**Hero Section**
- "LaunchPulse connects to your CRM and transforms raw activity and outcome history into a precise, continuously refined map of who to target"

**4 Product Feature Sections** (alternating layouts):
1. ICP Builder - Identify what "good" looks like in your CRM
2. TAM Generator - Dynamic TAM mapped directly to your ICP
3. Persona Conversion Insights - Quantify which personas convert
4. CRM Data Quality Analysis - Diagnose data quality risks

**Data Enrichment Section** (NEW)
- Multi-source verification waterfall
- Real-time web scraping
- Email/phone verification
- Competitor pricing comparison showing savings

**Use Cases Section** (3 columns):
- RevOps - Validate ICP/TAM, identify leakage points
- Sales Leadership - See misallocated effort and thin coverage
- Executives - Clear diagnostic view of market opportunity

**Bottom CTA**

### Step 5: Create Contact Page

Create `src/pages/Contact.tsx`:

**Two-column layout**
- Left: "Contact Us" header, description, direct email link
- Right: Demo request form with Name, Email, Company, Subject, Message fields
- Form validation and submission handling

### Step 6: Create Demo Request Backend

**Database migration** (`xxx_demo_requests.sql`):
```sql
CREATE TABLE demo_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  subject TEXT,
  message TEXT,
  source TEXT DEFAULT 'website',
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE demo_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view demo requests" ON demo_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

**Edge function** (`demo-request/index.ts`):
- Validate required fields (name, email)
- Store in database
- Send notification email via Resend
- Return success/error response

---

## Phase 2: Pricing Page

### Step 7: Create Dedicated Pricing Page

Create `src/pages/Pricing.tsx`:

**Section 1: Hero**
- "Simple, Transparent Pricing"
- "Platform subscription + pay-as-you-go enrichment credits"

**Section 2: Platform Plans** (3-column cards)

Starter - $299/mo:
- 2,500 accounts
- 5 users
- 1 CRM integration
- AI ICP Builder
- Basic TAM Generator
- 50 enrichment credits/mo
- CTA: "Request Demo"

Professional - $699/mo (MOST POPULAR badge):
- 10,000 accounts
- 15 users
- Unlimited CRM integrations
- Advanced TAM with segmentation
- Persona Conversion Insights
- AI Agents
- 250 enrichment credits/mo
- CTA: "Request Demo"

Enterprise - Custom:
- Unlimited everything
- API access, SSO/SAML
- Dedicated success manager
- Custom enrichment volume
- CTA: "Contact Sales"

**Section 3: Enrichment Credits**
- "Need more data? Add credits to any plan"
- Visual credit pack cards with pricing
- Usage examples (1-2 credits for quick enrich, 3-5 for full lead, 5-10 for deep research)
- Competitor comparison callout: "Save 60-85% vs Apollo, ZoomInfo, and Clay"

**Section 4: Feature Comparison Matrix**

| Feature | Starter | Professional | Enterprise |
|---------|---------|--------------|------------|
| AI ICP Builder | ✓ | ✓ | ✓ |
| TAM Generator | Basic | Advanced | Advanced |
| CRM Sync | 1 | Unlimited | Unlimited |
| Persona Insights | - | ✓ | ✓ |
| AI Agents | - | ✓ | ✓ |
| API Access | - | - | ✓ |
| SSO/SAML | - | - | ✓ |
| Credits/mo | 50 | 250 | Custom |
| Support | Email | Priority | Dedicated |

**Section 5: FAQ**
- "What's included in enrichment credits?"
- "Do credits roll over?"
- "Can I buy credits without a platform subscription?"
- "How does your pricing compare to competitors?"
- "What counts as one credit?"

---

## Phase 3: Update Plan Tiers Configuration

### Step 8: Restructure plan-tiers.ts

Update `src/lib/plan-tiers.ts` with new structure:

```typescript
export interface PlanTierConfig {
  id: PlanTier;
  name: string;
  displayName: string;
  
  // Pricing
  monthlyPrice: number | null;
  annualPrice: number | null;
  
  // Platform Limits
  limits: {
    maxAccounts: number | null;
    maxLeads: number | null;
    maxUsers: number | null;
    maxCrmIntegrations: number | null;
  };
  
  // Included Enrichment Credits
  monthlyEnrichmentCredits: number;
  
  // Feature Flags
  features: {
    basicTam: boolean;
    advancedTam: boolean;
    personaInsights: boolean;
    aiAgents: boolean;
    crmSync: boolean;
    apiAccess: boolean;
    sso: boolean;
    customReporting: boolean;
  };
}

export const ENRICHMENT_CREDIT_PACKS = [
  { id: 'starter', name: 'Starter Pack', credits: 250, price: 49, perCredit: 0.20 },
  { id: 'growth', name: 'Growth Pack', credits: 1000, price: 149, perCredit: 0.15 },
  { id: 'scale', name: 'Scale Pack', credits: 5000, price: 499, perCredit: 0.10 },
  { id: 'enterprise', name: 'Enterprise Pack', credits: 25000, price: 1999, perCredit: 0.08 },
];
```

---

## Phase 4: Stripe Integration

### Step 9: Enable Stripe

Use Lovable's Stripe integration tool to connect Stripe account.

### Step 10: Create Stripe Products (Manual in Dashboard)

**Subscriptions:**
- "LaunchPulse Starter" - $299/month recurring
- "LaunchPulse Professional" - $699/month recurring

**Credit Packs (one-time):**
- "250 Enrichment Credits" - $49
- "1,000 Enrichment Credits" - $149
- "5,000 Enrichment Credits" - $499
- "25,000 Enrichment Credits" - $1,999

### Step 11: Database Updates

Migration (`xxx_add_stripe_fields.sql`):
```sql
ALTER TABLE organizations 
ADD COLUMN stripe_customer_id TEXT,
ADD COLUMN stripe_subscription_id TEXT,
ADD COLUMN subscription_status TEXT DEFAULT 'none',
ADD COLUMN subscription_plan TEXT;

CREATE INDEX idx_org_stripe_customer ON organizations(stripe_customer_id);
```

### Step 12: Create Checkout Edge Functions

**create-checkout-session/index.ts:**
- Accept product type (subscription or credit pack)
- Create/retrieve Stripe customer
- Create checkout session with success/cancel URLs
- Return checkout URL

**stripe-webhook/index.ts:**
- Verify webhook signature
- Handle `checkout.session.completed` - add credits or update subscription
- Handle `customer.subscription.updated` - plan changes
- Handle `customer.subscription.deleted` - cancellations
- Update organization accordingly

**create-portal-session/index.ts:**
- Create Stripe billing portal session
- Allow users to manage subscriptions

---

## Phase 5: In-App Billing UI

### Step 13: Create Billing Components

Create `src/components/billing/`:

**BillingSection.tsx** - Settings page billing tab
- Current plan display with features
- Credit balance with visual indicator
- Usage this billing period
- "Buy Credits" and "Manage Subscription" buttons

**CreditPurchaseModal.tsx** - Buy credits dialog
- Credit pack selection cards
- Per-credit cost display
- Total price
- Checkout button → Stripe

**UpgradePrompt.tsx** - Low credit warning banner
- Shown when credits < 20% remaining
- "Buy Credits" or "Upgrade Plan" CTAs
- Dismissable but persistent

**PlanComparisonTable.tsx** - Reusable feature matrix

### Step 14: Update Settings Page

Add Billing tab to existing Settings:
- Current subscription tier and status
- Credit balance with usage chart
- "Buy Credits" button → CreditPurchaseModal
- "Manage Subscription" → Stripe portal
- Recent transactions list

### Step 15: Add Credit Warning System

Update enrichment flows:
- Check credit balance before operations
- Show warning when credits < 20%
- Block bulk operations if insufficient credits
- Prompt to purchase more

---

## Phase 6: Routing Updates

### Step 16: Update App.tsx

Add new public routes (no auth required):
- `/landing` - Home (marketing)
- `/about` - About page
- `/product` - Product page
- `/pricing` - Pricing page
- `/contact` - Contact/Demo request

Ensure proper layout wrapping for marketing pages vs app pages.

---

## File Structure Summary

```
src/
├── components/
│   ├── marketing/
│   │   ├── MarketingNav.tsx
│   │   ├── MarketingFooter.tsx
│   │   ├── MarketingHero.tsx
│   │   ├── FeatureCard.tsx
│   │   ├── PainPointCard.tsx
│   │   └── DemoRequestForm.tsx
│   └── billing/
│       ├── BillingSection.tsx
│       ├── CreditPurchaseModal.tsx
│       ├── UpgradePrompt.tsx
│       └── PlanComparisonTable.tsx
├── pages/
│   ├── Landing.tsx (rebuild)
│   ├── About.tsx (new)
│   ├── Product.tsx (new)
│   ├── Pricing.tsx (new)
│   └── Contact.tsx (new)
├── lib/
│   └── plan-tiers.ts (update)
supabase/
├── functions/
│   ├── demo-request/index.ts
│   ├── create-checkout-session/index.ts
│   ├── stripe-webhook/index.ts
│   └── create-portal-session/index.ts
└── migrations/
    ├── xxx_demo_requests.sql
    └── xxx_add_stripe_fields.sql
```

---

## Route Structure

| Route | Page | Auth Required | Purpose |
|-------|------|---------------|---------|
| `/landing` | Home | No | Marketing homepage |
| `/about` | About | No | Company mission |
| `/product` | Product | No | Feature details + enrichment |
| `/pricing` | Pricing | No | Plans + credits |
| `/contact` | Contact | No | Demo request form |
| `/auth` | Auth | No | Sign in/up |
| `/` | Dashboard | Yes | App home |
| `/settings` | Settings | Yes | Includes billing tab |

---

## Implementation Order

1. Create shared marketing components (Nav, Footer, Hero, Cards)
2. Rebuild Landing page with launchpulse.org content
3. Create About page
4. Create Product page with enrichment section
5. Create Contact page with demo form
6. Create demo_requests table and edge function
7. Create Pricing page with new pricing model
8. Update plan-tiers.ts configuration
9. Enable Stripe integration
10. Create checkout/webhook edge functions
11. Add Stripe fields to organizations table
12. Build billing UI components
13. Add billing section to Settings
14. Implement credit warning system
15. Update routing in App.tsx
16. End-to-end testing

---

## Success Criteria

- All marketing pages match launchpulse.org dark aesthetic with teal accents
- Demo request form submits correctly and sends notifications
- Pricing page clearly displays Platform + Credits model
- Stripe checkout works for credit pack purchases
- Credits correctly added to organization after purchase
- Low credit warnings appear at appropriate thresholds
- Billing section displays current plan and usage accurately
- All routes properly protected/unprotected as specified
