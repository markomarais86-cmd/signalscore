

# Improvement Plan: Hardening, Performance, and Quality

This plan focuses on improving what already exists -- no new features.

---

## 1. CRITICAL: Fix Security Vulnerabilities (7 errors found)

The security scan revealed serious issues that could allow any authenticated user to escalate privileges or access other organizations' data:

| Severity | Issue | Fix |
|---|---|---|
| **ERROR** | `user_profiles` UPDATE policy has no WITH CHECK -- any user can change their own `role` to `admin` or change `org_id` to hijack another org | Add WITH CHECK preventing `role` and `org_id` modification |
| **ERROR** | `quiz_responses` SELECT policy exposes all orgs' data to any authenticated user | Add org_id filter via join through `marketing_leads` |
| **ERROR** | `credit_adjustments` readable AND writable by any authenticated user across orgs | Restrict both SELECT/INSERT to `org_id = get_current_user_org_id()` |
| **ERROR** | `value_creation_plans` + `value_creation_milestones` fully open to all authenticated users | Add org_id filter to all 3 policies on each table |
| **ERROR** | `system_health_checks` accessible by anonymous/unauthenticated users (policy scoped to `public` role) | Change policy role from `public` to `service_role` |
| **ERROR** | `ai_provider_health` writable by anonymous users | Change policy role from `public` to `service_role` |

Additionally, 13 **WARN** level RLS policies use `USING (true)` or `WITH CHECK (true)` on INSERT/UPDATE/DELETE -- these should all get org_id scoping.

**Implementation**: Run SQL migrations via Supabase to drop and recreate the affected RLS policies with proper conditions.

---

## 2. Secure Edge Functions (44 functions with verify_jwt = false)

Currently **44 edge functions** have `verify_jwt = false`, many of which should not be publicly callable:

| Should stay `false` (webhooks/crons) | Should be `true` (user-initiated) |
|---|---|
| `salesforce-webhook`, `oauth-callback`, `calendly-webhook`, `clay-webhook-receiver`, `scheduled-*`, `check-sla-breaches`, `health-check` | `ai-chat`, `ai-actions-*`, `ai-orchestrator`, `ai-memory`, `ask-account-ai`, `enrich-unified`, `export-csv`, `upload-master-data`, `match-leads-to-accounts`, `generate-icp-insights`, `generate-account-insights`, `compute-intent-signals`, `firecrawl-scrape`, `discover-domain`, `standardize-industry` |

**Implementation**: Update `config.toml` to set `verify_jwt = true` on ~20 functions that handle user data but are currently open. Functions that need internal-only access should validate a shared secret header instead.

---

## 3. Performance: Add QueryClient Defaults

The `QueryClient` at line 72 of `App.tsx` has zero configuration:

```ts
const queryClient = new QueryClient(); // no defaults
```

This means every query uses React Query's defaults (no staleTime, gc after 5min, retry 3 times). With 32+ hooks making queries, this causes excessive refetching.

**Fix**: Add sensible global defaults:
- `staleTime: 2 * 60 * 1000` (2 min) -- avoid redundant refetches on tab focus
- `gcTime: 10 * 60 * 1000` (10 min)
- `retry: 1` (instead of 3 -- faster failure feedback)
- `refetchOnWindowFocus: false` (the app already uses realtime subscriptions)

---

## 4. Performance: Lazy-Load Page Components

All 30+ page components are eagerly imported in `App.tsx` (lines 23-70). Only `Settings.tsx` uses `lazy()` internally. This means the initial bundle includes every page.

**Fix**: Convert all page imports in `App.tsx` to `React.lazy()` with a shared `Suspense` fallback. This would split the bundle into ~30 chunks loaded on demand, significantly improving initial load time.

---

## 5. Consistency: Wrap All Routes in FeatureErrorBoundary

Currently only 3 routes (Portfolio, Value Creation, Due Diligence) use `FeatureErrorBoundary`. The other ~25 protected routes have no error isolation -- a crash in any page takes down the entire app.

**Fix**: Add `FeatureErrorBoundary` inside every `<Layout>` / `<RoleAwareLayout>` wrapper, or better yet, add it once inside the `Layout` component itself so it wraps `{children}` automatically.

---

## 6. Consistency: Standardize Layout Usage

Routes use three different layout patterns inconsistently:

| Pattern | Routes using it |
|---|---|
| `<Layout>` (admin only) | Dashboard, ICP, Accounts, Data Upload, Admin, Enrichment, etc. |
| `<RoleAwareLayout>` (auto-switches) | Leads, Settings, Opportunities, Tasks |
| `<CustomerLayout>` (customer only) | My Dashboard, Upgrade |
| No layout at all | Help, Presentations |

Routes like `/accounts` use `<Layout>` (admin-only) but should probably use `<RoleAwareLayout>` if customers can access them. `/help` and `/presentations` have no layout wrapper at all.

**Fix**: Audit each route and standardize: use `<RoleAwareLayout>` for pages both roles access, `<Layout>` for admin-only pages.

---

## 7. Move Extensions Out of Public Schema

The security scan flagged 2 extensions installed in `public`. Best practice is to use a dedicated `extensions` schema.

**Fix**: Run `ALTER EXTENSION ... SET SCHEMA extensions` for the affected extensions.

---

## Implementation Priority

| # | Task | Risk if skipped | Effort |
|---|---|---|---|
| 1 | Fix RLS privilege escalation (user_profiles) | **Critical** -- active exploit vector | Low (SQL only) |
| 2 | Fix remaining RLS open policies (6 tables) | **High** -- cross-org data leaks | Low (SQL only) |
| 3 | Secure edge functions (verify_jwt) | **High** -- public API abuse | Trivial (config) |
| 4 | Add QueryClient defaults | Medium -- wasted bandwidth | Trivial |
| 5 | Add FeatureErrorBoundary to Layout | Medium -- app crashes | Trivial |
| 6 | Lazy-load pages | Medium -- slow initial load | Low |
| 7 | Standardize route layouts | Low -- UX inconsistency | Low |
| 8 | Move extensions to dedicated schema | Low -- best practice | Trivial |

