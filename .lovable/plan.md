

# Fix Sidebar Navigation, Feature Flags, 404s, and Lead Detail Scroll

## Issues Found

1. **Sidebar order is wrong** -- Currently: Dashboard > Accounts > Leads (Core), then Sales, Build, Configure. User wants: Dashboard > ICP Manager > Enrichment (top level), then Accounts + Leads + Enrichment under a "Data" group, Sales below, then Configure.
2. **No "Sales" feature flag** -- The Sales section (Opportunities, Tasks) cannot be toggled on/off from the admin feature flags panel. Need to add a `sales` feature flag.
3. **Clicking accounts in Priority Revenue table gives 404** -- `PriorityRevenueAccounts` navigates to `/accounts/{id}` but no route exists for that path. Fix: open the AccountDetailDrawer instead of navigating.
4. **"Contacts" column label** -- `PriorityRevenueAccounts` shows "Contacts" as a column header; should say "Leads" for consistency.
5. **"All Accounts" count shows 0** -- The `AccountsTable` header says "All Accounts (0)" even though data loads. This is likely a timing issue where `totalCount` from the RPC `total_count` field is not being returned properly. Will investigate and fix.
6. **Lead detail sheet cannot scroll** -- The `SheetContent` in `Leads.tsx` has no scroll container. The content overflows but the sheet locks scroll. Fix: wrap the detail content in a `ScrollArea`.

## Changes

### 1. Restructure Sidebar (`src/components/AppSidebar.tsx`)

New structure:
- **Core** (always visible): Dashboard, ICP Manager
- **Data** (collapsible): Accounts, Leads, Enrichment
- **Sales** (collapsible, feature-flagged): Opportunities, Tasks
- **Configure** (collapsible): AI Agents, Settings, Help
- Analytics (feature-flagged, unchanged)
- Admin (super admin only, unchanged)

### 2. Add "Sales" Feature Flag

**`src/hooks/use-feature-flags.tsx`**: Add `sales: boolean` to the `FeatureFlags` interface and defaults (default: `true`).

**`src/components/platform-admin/OrganizationFeatureFlags.tsx`**: Add `sales` entry to `FEATURE_FLAG_LABELS` so it appears in the admin toggle panel.

**`src/components/AppSidebar.tsx`**: Gate the Sales section behind `flags.sales`.

### 3. Fix Account Click 404 (`src/components/executive/PriorityRevenueAccounts.tsx`)

Replace `navigate(\`/accounts/\${id}\`)` with opening the `AccountDetailDrawer` via a callback prop or by navigating to `/accounts?selected={id}`. Simplest fix: navigate to `/accounts` page instead of a non-existent detail route.

### 4. Rename "Contacts" to "Leads" (`src/components/executive/PriorityRevenueAccounts.tsx`)

Change the column header from "Contacts" to "Leads" on line 291.

### 5. Fix Lead Detail Scroll (`src/pages/Leads.tsx`)

Wrap the lead detail content (the `div.space-y-6.mt-6` inside `SheetContent`) in a `ScrollArea` with `className="h-[calc(100vh-120px)]"` so users can scroll through all lead details.

### 6. Investigate "All Accounts (0)" count

The `totalCount` comes from `total_count` in the RPC response. The RPC returns data (25 rows per the console logs) but totalCount may not be mapping correctly. Will check the `get_filtered_accounts` RPC response and fix the mapping in `use-infinite-accounts.tsx` if needed.

## Files Modified

| File | Change |
|------|--------|
| `src/components/AppSidebar.tsx` | Restructure nav order; gate Sales behind feature flag |
| `src/hooks/use-feature-flags.tsx` | Add `sales` flag to interface and defaults |
| `src/components/platform-admin/OrganizationFeatureFlags.tsx` | Add `sales` to flag labels |
| `src/components/executive/PriorityRevenueAccounts.tsx` | Fix 404 navigation; rename "Contacts" to "Leads" |
| `src/pages/Leads.tsx` | Add ScrollArea to lead detail sheet |
| `src/hooks/use-infinite-accounts.tsx` | Fix totalCount mapping if needed |

