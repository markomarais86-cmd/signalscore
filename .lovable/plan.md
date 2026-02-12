

# Customer Dashboard Branding

## What's Already Done
- Sidebar "Sales" dropdown (both admin and customer) -- complete
- Database migration (slug column + both RPCs) -- complete
- `useBrandedConfig` hook -- complete
- Branded landing page (`/p/:orgSlug`) -- complete
- `CustomerLayout.tsx` brand CSS variables -- complete

## What's Left

### Modify `src/pages/CustomerDashboard.tsx`

The only remaining piece from the original plan: apply org branding to the customer dashboard page itself.

**Changes:**
1. Import `useBrandedConfig` and `useAuth` to fetch the org's brand config
2. Replace the static "My Dashboard" heading with a dynamic greeting: **"Welcome back, {company_name}"** (falls back to "My Dashboard" if no company name)
3. Apply `brand_primary_color` to the hero icon background and metric card accent borders/icons using inline styles that reference the `--brand-primary` CSS variable already set by `CustomerLayout`

### Technical Details

- Use `var(--brand-primary)` in inline styles for the hero icon container and metric card icon colors
- No new dependencies or database changes needed
- Graceful fallback: if no brand config exists, the page renders exactly as it does today

