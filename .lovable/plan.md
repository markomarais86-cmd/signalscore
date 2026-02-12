

# Customer-Facing Simplified Dashboard

## Overview

Create a new `/my-dashboard` page and a simplified sidebar layout specifically for non-admin, non-super-admin users ("customer" users). This gives customers a clean, focused view of only their leads, tasks, and pipeline -- no ICP Manager, Enrichment, AI Agents, Analytics, Admin, or other power-user controls.

## Approach: Role-Based Layout Switching

Rather than building an entirely separate app shell, we'll create:

1. **A new `CustomerLayout` component** -- a simplified version of `Layout` with a stripped-down sidebar showing only: Dashboard, Leads, Tasks, Opportunities, Settings, and Sign Out.
2. **A new `CustomerDashboard` page** -- a single-page overview combining key metrics from leads, tasks, and pipeline in a clean card-based layout.
3. **Role-based routing in `App.tsx`** -- customer users (role = `user`, not `admin` or `super_admin`) get routed to the customer layout; admin/super-admin users see the existing full layout.

## New Files

### 1. `src/components/CustomerSidebar.tsx`
A minimal sidebar with only 5 nav items:
- **My Dashboard** (`/my-dashboard`)
- **Leads** (`/leads`)
- **Tasks** (`/tasks`)
- **Opportunities** (`/opportunities`)
- **Settings** (`/settings`)

Plus footer with user name and Sign Out button. Uses the same `Sidebar` UI primitives from `@/components/ui/sidebar`. No Build, Configure, Analytics, or Admin sections.

### 2. `src/components/CustomerLayout.tsx`
A simplified layout wrapper (like `Layout.tsx`) that uses `CustomerSidebar` instead of `AppSidebar`. Keeps the header bar (with theme toggle) but removes:
- Command Palette trigger
- Export Queue Manager
- AI Chat floating widget
- Campaign Builder
- Help Panel and Notification Center (optional: keep Notification Center)

### 3. `src/pages/CustomerDashboard.tsx`
A single overview page with three sections:

**Section A -- Key Metrics (4 cards)**
- Total Leads assigned to this user
- Tasks pending/overdue
- Open deals count
- Pipeline value (sum of open deal amounts)

**Section B -- My Tasks (condensed list)**
- Shows top 5 pending/overdue tasks using existing `TaskCard` component
- "View All" link to `/tasks`

**Section C -- My Pipeline (mini deal board)**
- Horizontal summary of deal stages with counts and values
- Uses data from `useOpportunities` hook
- "View All" link to `/opportunities`

### 4. Modifications to `src/App.tsx`
Add new route:
```
/my-dashboard -> CustomerLayout > CustomerDashboard
```

Update `LandingRedirectWrapper` to redirect customer-role users to `/my-dashboard` instead of `/dashboard`.

For the existing `/leads`, `/tasks`, `/opportunities`, and `/settings` routes, wrap them conditionally:
- If user role is `admin` or `super_admin`: use existing `Layout`
- If user role is `user`: use `CustomerLayout`

This will be implemented via a new `RoleAwareLayout` component that checks `useRoles()` and renders the appropriate layout.

## Technical Details

### `RoleAwareLayout` component
```typescript
// src/components/RoleAwareLayout.tsx
function RoleAwareLayout({ children }) {
  const { isSuperAdmin, isOrgAdmin } = useRoles();
  if (isSuperAdmin || isOrgAdmin) return <Layout>{children}</Layout>;
  return <CustomerLayout>{children}</CustomerLayout>;
}
```

This is used in App.tsx for shared routes (`/leads`, `/tasks`, `/opportunities`, `/settings`) so they automatically get the right chrome.

### Data scoping
- **Leads**: Already scoped by `org_id` via `useInfiniteLeads` hook -- no changes needed
- **Tasks**: Already scoped by `org_id` via `useTasks` hook -- no changes needed  
- **Opportunities**: Already scoped by `org_id` via `useOpportunities` hook -- no changes needed
- **CustomerDashboard metrics**: Will query the same hooks/RPCs but display simplified summaries

### Routes that remain admin-only (unchanged, keep `Layout`)
`/dashboard`, `/icp-manager`, `/accounts`, `/enrichment`, `/ai-agents`, `/admin/*`, `/data-upload`, all analytics pages, `/reports`, etc.

### No database changes required
All data is already properly scoped by `org_id` through existing RLS policies and hooks.

## Files Changed Summary

| File | Action |
|------|--------|
| `src/components/CustomerSidebar.tsx` | Create -- minimal 5-item sidebar |
| `src/components/CustomerLayout.tsx` | Create -- simplified layout shell |
| `src/components/RoleAwareLayout.tsx` | Create -- switches layout by role |
| `src/pages/CustomerDashboard.tsx` | Create -- overview with metrics, tasks, pipeline |
| `src/App.tsx` | Modify -- add `/my-dashboard` route, update shared routes to use `RoleAwareLayout`, update redirect logic |

