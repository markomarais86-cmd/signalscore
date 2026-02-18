

## Fix: Dashboard Branding Uses Wrong Org When Impersonating

### Problem

When you (a LaunchPulse super admin) switch the org selector to view 91.Life's data, the dashboard still shows **LaunchPulse branding** (teal #3CF1AE) instead of **91.Life branding** (indigo #6366f1).

This is because three components fetch brand config using `userProfile?.org_id` (your personal org = LaunchPulse) instead of `effectiveOrgId` (the org you're currently viewing = 91.Life).

### Root Cause

```text
CustomerLayout.tsx    -->  useBrandedConfig({ orgId: userProfile?.org_id })   // Always LaunchPulse
CustomerSidebar.tsx   -->  useBrandedConfig({ orgId: userProfile?.org_id })   // Always LaunchPulse
CustomerDashboard.tsx -->  useBrandedConfig({ orgId: userProfile?.org_id })   // Always LaunchPulse
```

Should be:

```text
CustomerLayout.tsx    -->  useBrandedConfig({ orgId: effectiveOrgId })        // 91.Life when impersonating
CustomerSidebar.tsx   -->  useBrandedConfig({ orgId: effectiveOrgId })        // 91.Life when impersonating
CustomerDashboard.tsx -->  useBrandedConfig({ orgId: effectiveOrgId })        // 91.Life when impersonating
```

### Changes

**File 1: `src/components/CustomerLayout.tsx`**
- Import `useEffectiveOrg` instead of relying on `useAuth().userProfile.org_id`
- Change `useBrandedConfig({ orgId: orgId })` to use `effectiveOrgId`

**File 2: `src/components/CustomerSidebar.tsx`**
- Same fix: use `effectiveOrgId` from `useEffectiveOrg()` for the brand config lookup

**File 3: `src/pages/CustomerDashboard.tsx`**
- Same fix: use `effectiveOrgId` from `useEffectiveOrg()` for the brand config lookup

### Result

When you switch the org selector to 91.Life, the entire dashboard (layout, sidebar, dashboard page) will immediately reflect 91.Life's indigo branding. When you switch back to LaunchPulse, it shows teal. Non-admin users see their own org's branding as before (since `effectiveOrgId` equals their `org_id`).

### Note on the PDF Report

The PDF report (`use-branded-report.ts`) already correctly uses `effectiveOrgId` -- so the generated PDF shows 91.Life branding correctly. The issue is only in the live dashboard UI.
