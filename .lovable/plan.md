

# Admin Org-Switcher Plan

## Overview
Add an organization selector to the admin dashboard header so super admins can scope all data views to any customer organization. This enables the "consulting mode" workflow -- doing the work on behalf of a client.

## Architecture

The core idea is a React context (`OrgSwitcherContext`) that overrides the `org_id` used by all data hooks. Today, every hook reads `userProfile?.org_id`. With the switcher, super admins get an "effective org ID" that can be changed via a dropdown in the header.

```text
+--------------------------------------------------+
|  Header:  [Sidebar] [Cmd+K]   [OrgDropdown v] ...|
+--------------------------------------------------+
|                                                    |
|  Dashboard / Accounts / Leads / ICPs / Scoring     |
|  (all scoped to selected org)                      |
+--------------------------------------------------+
```

## New Files

### 1. `src/contexts/OrgSwitcherContext.tsx`
- Creates a context providing: `effectiveOrgId`, `selectedOrg`, `setSelectedOrgId`, `isImpersonating` (true when viewing a different org), and `resetToOwnOrg`
- On mount (for super admins only), fetches the list of organizations from the `organizations` table
- Defaults `effectiveOrgId` to the user's own `userProfile.org_id`
- When a different org is selected, `effectiveOrgId` updates, which cascades through all hooks
- Non-super-admin users always get their own org_id (no override possible)
- Persists selection to `sessionStorage` so it survives page refreshes

### 2. `src/hooks/use-effective-org.ts`
- A convenience hook: returns `effectiveOrgId` from the context
- This becomes the single replacement for `userProfile?.org_id` across all data hooks

### 3. `src/components/OrgSwitcher.tsx`
- A dropdown (using the existing Select component) shown in the Layout header, only visible to super admins
- Displays org name + a colored dot for status
- Shows a subtle banner/badge when impersonating ("Viewing as: Acme Corp")
- Includes a "Back to my org" option at the top

## Modified Files

### 4. `src/App.tsx` (or wherever providers are composed)
- Wrap the app with `<OrgSwitcherProvider>` inside `<AuthProvider>` (needs auth context)

### 5. `src/components/Layout.tsx`
- Add the `<OrgSwitcher />` component to the header bar, between the sidebar trigger and the right-side icons
- Add a thin colored banner below the header when impersonating (e.g., "Viewing data for: Acme Corp")

### 6. Refactor data hooks to use `useEffectiveOrg()`
The following hooks currently read `userProfile?.org_id` and will be updated to use `useEffectiveOrg()` instead. This is a mechanical find-and-replace:

- `use-dashboard-data.ts` -- already takes `orgId` as param; callers will pass `effectiveOrgId`
- `use-infinite-accounts.tsx` -- replace org_id source
- `use-infinite-leads.tsx` -- replace org_id source
- `use-icp-scoring.tsx` -- replace org_id source
- `use-icp-insights.tsx` -- replace org_id source
- `use-tasks.ts` -- replace org_id source
- `use-opportunities.ts` -- replace org_id source
- `use-trend-data.ts` -- replace org_id source
- `use-market-intelligence.tsx` -- replace org_id source
- `useAccountSignals.ts` -- replace org_id source

Pages that call these hooks and pass `userProfile?.org_id` directly (like the executive dashboard) will also be updated to use `effectiveOrgId`.

**Note**: This is incremental. We start with the core hooks above; remaining hooks (enrichment, campaigns, etc.) can be migrated later without breaking anything.

## Security Considerations

- The org-switcher context only allows overriding for super admins (checked via `useRoles().isSuperAdmin`)
- RLS policies already scope data by `org_id`; super admins need existing RLS bypass or a policy that allows super_admin role to read any org's data
- We will verify that existing RLS policies use `has_role(auth.uid(), 'super_admin')` checks for cross-org access; if not, a small migration will add those policies

## State Preservation

- When switching orgs, React Query cache keys already include `orgId`, so each org's data is cached independently
- Switching back to a previously viewed org will show cached data instantly while refetching in the background
- No page navigation occurs on switch -- only the data refreshes

## Implementation Order

1. Create `OrgSwitcherContext` and `use-effective-org` hook
2. Create `OrgSwitcher` dropdown component
3. Wire into `Layout.tsx` header and App providers
4. Migrate core data hooks (dashboard, accounts, leads, ICPs, scoring) to use `effectiveOrgId`
5. Verify RLS policies allow super admin cross-org reads
6. Test end-to-end with org switching

