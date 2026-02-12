

# Managed Demand Engine: Customer Onboarding for "Done-For-You" Lead Generation

## The Model

LaunchPulse runs the entire demand engine on behalf of each customer. Customers don't touch ad platforms, funnels, or conversion tracking. They log in and see qualified leads, tasks, and pipeline -- ready to work. You bill them for the service.

## What You Need From Each Customer

There are two categories of inputs: **required to launch** and **needed for optimization**.

### Required to Launch (Day 1)

| Input | Why | Where It Lives Today |
|-------|-----|---------------------|
| Company name, logo, brand colors | White-label the landing pages and quiz funnel to their brand | Not captured -- needs `org_onboarding_config` |
| ICP definition (industries, company sizes, geographies, titles) | Target the right audience in ads and score leads correctly | `icp_profiles` table (exists) |
| Sales team roster (names, emails, territories) | Route leads to the right rep, create tasks for them | `user_profiles` (partially exists -- needs territory/capacity fields) |
| Routing preferences (geo/size/industry rules) | Assign leads based on their sales org structure | `lead_routing_rules` (exists) |
| Calendly/booking link(s) per rep | Let qualified leads book directly after the funnel | Not captured -- needs field on user_profiles or org config |
| Value proposition and messaging | Populate quiz intro, landing page copy, email templates | Not captured -- needs `org_campaign_config` |

### Needed for Optimization (Week 2+)

| Input | Why |
|-------|-----|
| CRM credentials (Salesforce/HubSpot) | Sync leads and deals bi-directionally |
| Historical closed-won data | Train scoring model on what "good" looks like for them |
| Competitor list | Use in quiz disqualification and ad targeting |
| Objection handling notes | Feed into AI follow-up email sequences |

## What You Build

### A. Database: Customer Onboarding Config

A new `org_onboarding_config` table stores everything LaunchPulse needs to run campaigns for a customer:

```text
org_onboarding_config
---------------------
org_id (FK)
company_name, logo_url, brand_primary_color, brand_secondary_color
website_url
value_proposition (text -- elevator pitch)
target_persona_description (text)
calendly_base_url
onboarding_status: draft | ready | active | paused
launched_at, paused_at
monthly_lead_target (integer)
```

### B. Database: Campaign Config (per customer)

A new `org_campaign_config` table lets you manage what campaigns are running for each customer:

```text
org_campaign_config
-------------------
org_id (FK)
campaign_name
platform (google | meta | linkedin)
ad_account_id (YOUR ad account, not theirs)
monthly_budget_cents
landing_page_variant
quiz_variant
status: draft | active | paused | completed
start_date, end_date
```

### C. Database: Rep Profiles Extension

Add fields to `user_profiles` for routing intelligence:

- `territory` (text array -- countries/regions this rep covers)
- `max_leads_per_day` (integer -- capacity cap)
- `calendly_url` (text -- personal booking link)
- `working_hours_start`, `working_hours_end` (time -- for SLA calculation)

### D. Super-Admin Customer Onboarding Wizard

A new page at `/admin/customer-onboarding` (super-admin only) with a step-by-step wizard:

1. **Company Profile** -- name, logo upload, colors, website, value prop
2. **ICP Setup** -- industries, sizes, geos, titles (feeds into existing `icp_profiles`)
3. **Sales Team** -- add reps with territories, capacity, Calendly links
4. **Routing Rules** -- auto-generate default rules from ICP + territories
5. **Campaign Setup** -- which platforms, budget, landing page variant
6. **Review and Launch** -- summary card, "Activate" button that sets status to `active`

### E. Customer Dashboard (What They See)

Customers log in and see a simplified view -- no ad platform config, no funnel setup. Just:

- **Lead feed**: New qualified leads with contact info, company, score, and quiz answers
- **Task list**: "Call Jane at Acme within 5 minutes" with SLA countdown
- **Pipeline**: Their deals moving through stages
- **Monthly report**: Leads delivered, meetings booked, pipeline generated, cost per lead

### F. Edge Function Updates

- **`demo-request`**: Use `org_onboarding_config` to resolve which customer's funnel captured this lead (based on `funnel_variant` or landing page domain)
- **`route-lead`**: Check rep capacity (`max_leads_per_day`) before assignment; respect working hours for SLA start time
- **Landing page / quiz**: Dynamically load branding from `org_onboarding_config` based on URL parameter or subdomain

---

## Technical Details

### Migration: `org_onboarding_config`

```sql
CREATE TABLE public.org_onboarding_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_name TEXT,
  logo_url TEXT,
  brand_primary_color TEXT DEFAULT '#6366f1',
  brand_secondary_color TEXT DEFAULT '#818cf8',
  website_url TEXT,
  value_proposition TEXT,
  target_persona_description TEXT,
  calendly_base_url TEXT,
  onboarding_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (onboarding_status IN ('draft', 'ready', 'active', 'paused')),
  monthly_lead_target INTEGER DEFAULT 50,
  launched_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.org_onboarding_config ENABLE ROW LEVEL SECURITY;
```

### Migration: `org_campaign_config`

```sql
CREATE TABLE public.org_campaign_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('google', 'meta', 'linkedin', 'tiktok')),
  ad_account_id TEXT,
  monthly_budget_cents INTEGER,
  landing_page_variant TEXT,
  quiz_variant TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.org_campaign_config ENABLE ROW LEVEL SECURITY;
```

### Migration: user_profiles extension

```sql
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS territory TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS max_leads_per_day INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS calendly_url TEXT,
  ADD COLUMN IF NOT EXISTS working_hours_start TIME DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS working_hours_end TIME DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';
```

### New UI Components

| File | Purpose |
|------|---------|
| `src/pages/admin/CustomerOnboarding.tsx` | Multi-step wizard for super-admins to set up a new customer |
| `src/components/admin/OnboardingStepCompany.tsx` | Step 1: Company profile, logo, colors, value prop |
| `src/components/admin/OnboardingStepICP.tsx` | Step 2: ICP definition (writes to `icp_profiles`) |
| `src/components/admin/OnboardingStepTeam.tsx` | Step 3: Add reps with territories and Calendly links |
| `src/components/admin/OnboardingStepRouting.tsx` | Step 4: Auto-generate routing rules from ICP + territories |
| `src/components/admin/OnboardingStepCampaigns.tsx` | Step 5: Campaign platform, budget, variants |
| `src/components/admin/OnboardingStepReview.tsx` | Step 6: Summary + "Activate" button |
| `src/components/admin/CustomerList.tsx` | Table of all customers with status badges (draft/active/paused) and lead counts |

### Route Changes

- Add `/admin/customer-onboarding` and `/admin/customer-onboarding/:orgId` routes
- Add "Customer Onboarding" link to the admin sidebar

### Implementation Sequence

1. Database migrations (3 tables + user_profiles extension)
2. `CustomerList.tsx` -- overview of all managed customers
3. Multi-step onboarding wizard (6 steps)
4. Update `route-lead` to respect capacity and working hours
5. Dynamic quiz/landing page branding from `org_onboarding_config`
6. Customer-facing simplified dashboard view

