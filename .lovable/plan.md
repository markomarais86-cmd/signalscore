

# Dynamic MQL/SQL Branding + Customer Sidebar Reorganization

## Overview

Two changes in one implementation:

1. **Dynamic branding from `org_onboarding_config`** -- applies to BOTH the public MQL/SQL quiz funnel landing page AND the logged-in customer dashboard/sidebar (logo, colors, company name)
2. **Customer Sidebar reorganization** -- group Tasks and Opportunities under a collapsible "Sales" dropdown

---

## Part 1: Customer Sidebar -- "Sales" Dropdown

### Modify `src/components/CustomerSidebar.tsx`

Restructure the flat navigation into:

- **Dashboard** (top-level)
- **Leads** (top-level)
- **Sales** (collapsible group containing):
  - Tasks
  - Opportunities
- **Settings** (top-level)

Use the same `Collapsible` + `CollapsibleTrigger` + `CollapsibleContent` pattern already used in `AppSidebar.tsx` (Build/Configure sections). Auto-expand the Sales group when the current route is `/tasks` or `/opportunities`.

---

## Part 2: Database Changes for Branded Pages

### Migration SQL

1. **Add `slug` column to `organizations`**:
   - `ALTER TABLE organizations ADD COLUMN slug TEXT UNIQUE`
   - Create index on `slug`

2. **Create `get_branded_config_by_slug` RPC** (SECURITY DEFINER):
   - Joins `organizations.slug` with `org_onboarding_config`
   - Returns only public branding fields: `company_name`, `logo_url`, `brand_primary_color`, `brand_secondary_color`, `value_proposition`, `target_persona_description`, `calendly_base_url`
   - Filters by `onboarding_status = 'active'`
   - Callable by anonymous users (for public landing pages)

3. **Create `get_branded_config_by_org_id` RPC** (SECURITY DEFINER):
   - Same fields but looks up by `org_id` directly
   - For authenticated users viewing their own customer dashboard
   - Validates caller belongs to the org

---

## Part 3: Branding Hook

### Create `src/hooks/useBrandedConfig.ts`

Two modes:
- **By slug** (public pages): calls `get_branded_config_by_slug` RPC
- **By org_id** (logged-in dashboard): calls `get_branded_config_by_org_id` RPC

Returns a `BrandConfig` type:
```
{
  company_name, logo_url, brand_primary_color,
  brand_secondary_color, value_proposition
}
```

---

## Part 4: Public Branded Landing Page (MQL/SQL Only)

### Create `src/pages/BrandedLanding.tsx`

- Route: `/p/:orgSlug`
- Reads `orgSlug` from URL params
- Fetches brand config via `useBrandedConfig(slug)`
- Shows loading skeleton while fetching; redirects to default landing on invalid/inactive slug
- Renders a branded version of the marketing page with:
  - Customer logo in nav (via `BrandedMarketingNav`)
  - CSS custom properties (`--brand-primary`, `--brand-secondary`) on wrapper div
  - `value_proposition` as hero subheadline
  - `company_name` in headline
  - QuizFunnel receives `orgSlug` as source and `brandConfig` for color overrides

### Create `src/components/marketing/BrandedMarketingNav.tsx`

- Variant of `MarketingNav` that accepts `logoUrl`, `companyName`, `primaryColor`
- Shows customer logo instead of LaunchPulse logo
- Applies brand color to CTA button

### Modify `src/components/marketing/QuizFunnel.tsx`

- Add optional `brandConfig` prop with `primaryColor`
- When provided, apply `primaryColor` to progress bar fill and selected option highlight via inline styles
- Pass `orgSlug` in submission payload for lead attribution

---

## Part 5: Customer Dashboard Branding

### Modify `src/components/CustomerSidebar.tsx`

- Fetch brand config using `useBrandedConfig({ orgId })` from the logged-in user's `org_id`
- If `logo_url` exists, show customer logo instead of `BrandLogo`
- Apply `brand_primary_color` as accent color for active nav items via CSS custom property

### Modify `src/components/CustomerLayout.tsx`

- Pass brand config down or apply `--brand-primary` CSS variable on the layout wrapper
- Header accent and footer can pick up the brand color

### Modify `src/pages/CustomerDashboard.tsx`

- Show `company_name` in the greeting/header area (e.g., "Welcome back, {company_name}")
- Metric card accents use brand color

---

## Part 6: Routing

### Modify `src/App.tsx`

- Add route: `<Route path="/p/:orgSlug" element={<BrandedLanding />} />`

---

## Files Changed Summary

| File | Action |
|------|--------|
| Migration SQL | Create -- add `slug` to organizations, create 2 RPCs |
| `src/hooks/useBrandedConfig.ts` | Create -- fetches brand config by slug or org_id |
| `src/pages/BrandedLanding.tsx` | Create -- public branded MQL/SQL landing page |
| `src/components/marketing/BrandedMarketingNav.tsx` | Create -- brand-aware nav for landing page |
| `src/components/marketing/QuizFunnel.tsx` | Modify -- accept optional `brandConfig` for color overrides |
| `src/components/CustomerSidebar.tsx` | Modify -- add "Sales" collapsible group + brand logo/colors |
| `src/components/CustomerLayout.tsx` | Modify -- apply brand CSS variables |
| `src/pages/CustomerDashboard.tsx` | Modify -- show company name, brand-colored accents |
| `src/App.tsx` | Modify -- add `/p/:orgSlug` route |

