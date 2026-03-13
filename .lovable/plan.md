

# Improve Current Product Architecture — No New Features

## Assessment

After reviewing the recently added features (Value Creation Plan, Due Diligence, AI Chat NLP commands, Slack/Teams notifications), I found several architectural issues: excessive `as any` casts hiding type bugs, missing error boundaries, notification dispatcher running globally even for non-admin users, and the Due Diligence page doing a hook-order-dependent auth guard.

## Plan

### 1. Remove `as any` type casts in value creation plan hook
The Supabase types already define `value_creation_plans` and `value_creation_milestones` tables. The `as any` casts on inserts/updates are unnecessary and hide type errors. Replace all 6 `as any` usages in `use-value-creation-plan.ts` with properly typed objects using `Database['public']['Tables']` types.

### 2. Type-safe notification channels in AlertsConfiguration
Replace the 12+ `(ch as any).slack` / `(form.notification_channels as any)?.teams` patterns with a typed `NotificationChannels` interface (`{ slack: boolean; teams: boolean; webhook: boolean; email: boolean }`). Apply it once with a parse function and use throughout.

### 3. Guard notification dispatcher to admin-only
`useNotificationDispatcher()` runs in `Layout.tsx` for every authenticated user, opening 3 realtime channels per session. It should only activate for super admins or org admins — wrap the `useEffect` subscription logic behind a role check using `useRoles()`.

### 4. Fix React hook ordering in DueDiligence page
The auth guard (`if (!isSuperAdmin) navigate(...)`) must not appear between hook calls. Move it after all hooks and wrap in `useEffect` to avoid the conditional-return-before-hooks anti-pattern that can crash in edge cases.

### 5. Add error boundaries around new feature pages
Wrap `ValueCreationPlan` and `DueDiligence` route entries in a shared `ErrorBoundary` component so a crash in one page doesn't take down the entire app. Create a simple `FeatureErrorBoundary` with a retry button.

### 6. Deduplicate org resolution pattern
Both `ValueCreationPlan` and `useValueCreationPlan` independently resolve `dataOrgId` via a `parent_org_id` query. Extract this into the existing `use-data-org.ts` hook (if it doesn't already serve this purpose) to ensure consistent caching and avoid duplicate network calls.

---

### Files to modify
| File | Change |
|---|---|
| `src/hooks/use-value-creation-plan.ts` | Remove `as any`, use typed inserts/updates |
| `src/components/settings/AlertsConfiguration.tsx` | Add `NotificationChannels` type, remove `as any` |
| `src/hooks/use-notification-dispatcher.ts` | Add `useRoles()` guard, skip subscriptions for non-admins |
| `src/pages/DueDiligence.tsx` | Move navigate guard into `useEffect` after all hooks |
| `src/pages/ValueCreationPlan.tsx` | Same navigate guard fix |
| `src/components/FeatureErrorBoundary.tsx` | New — simple error boundary with retry |
| `src/App.tsx` | Wrap new routes in `FeatureErrorBoundary` |

