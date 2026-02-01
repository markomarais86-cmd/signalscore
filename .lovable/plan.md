
# Authentication Redirect URL Audit

## Summary

I've audited all authentication-related redirect URLs in the codebase. Here's what I found:

## Current State

### Correctly Using launchpulse.io (Hardcoded)

| File | Line | URL | Purpose |
|------|------|-----|---------|
| `src/hooks/use-auth.tsx` | 317-318 | `https://www.launchpulse.io/reset-password` | Password reset redirect |
| `src/components/settings/CreateOrganizationDialog.tsx` | 75 | `https://launchpulse.io/auth?invite=` | Org admin invitation link |

### Using `window.location.origin` (Dynamic)

| File | Line | Pattern | Purpose |
|------|------|---------|---------|
| `src/hooks/use-auth.tsx` | 223 | `${window.location.origin}/` | Default signup redirect |
| `src/components/AuthSystem.tsx` | 200-202 | `${window.location.origin}/auth?invite=` | Signup with invite redirect |
| `src/components/settings/InvitationsManager.tsx` | 113 | `${window.location.origin}/auth?invite=` | Resend invitation URL |
| `src/components/settings/InviteUserModal.tsx` | 70 | `${window.location.origin}/auth?invite=` | New invitation URL |
| `src/components/settings/IntegrationManager.tsx` | 516 | `${window.location.origin}/settings?tab=integrations` | OAuth redirect |

### Problematic: OAuth Error Redirect

| File | Line | Issue |
|------|------|-------|
| `supabase/functions/oauth-callback/index.ts` | 239 | Broken URL construction: `SUPABASE_URL.replace('supabase.co', '') + '/settings'` |

## Issues Found

### Issue 1: Inconsistent Invitation URLs (Medium Priority)

- `CreateOrganizationDialog.tsx` hardcodes `https://launchpulse.io/auth?invite=`
- Other invitation components use `window.location.origin`

**Problem**: When testing in preview environments, `CreateOrganizationDialog` will send emails with production URLs that won't work for testing.

**Recommendation**: Use `window.location.origin` consistently, OR create a helper function that:
- Uses `https://launchpulse.io` when in production
- Uses `window.location.origin` when in development/preview

### Issue 2: OAuth Error Redirect is Broken (High Priority)

```typescript
// Line 239 - This produces an invalid URL
const redirectUrl = new URL(SUPABASE_URL.replace('supabase.co', '') + '/settings');
```

When `SUPABASE_URL` is `https://dhyfbaptcprxxixgnpby.supabase.co`:
- After replace: `https://dhyfbaptcprxxixgnpby./settings`
- This is not a valid URL!

**Recommendation**: Hardcode to `https://launchpulse.io/settings` or use the stored `redirect_url` from the oauth_state table.

### Issue 3: Dynamic URLs May Cause Email Deliverability Issues (Low Priority)

Using `window.location.origin` for invitation emails means:
- Emails from preview environments contain preview URLs
- These look suspicious and may affect deliverability
- Users who receive emails from preview environments may get confused

**Recommendation**: For invitation emails specifically, always use the production domain.

## Recommended Changes

### 1. Fix OAuth Error Redirect (Critical)

```typescript
// supabase/functions/oauth-callback/index.ts line 237-243
function redirectWithError(error: string, description: string): Response {
  // Use production domain for error redirects
  const redirectUrl = new URL('https://launchpulse.io/settings');
  redirectUrl.searchParams.set('oauth_error', error);
  redirectUrl.searchParams.set('oauth_error_description', description);
  
  return Response.redirect(redirectUrl.toString(), 302);
}
```

### 2. Standardize Invitation URLs

Create a utility function:

```typescript
// src/lib/url-utils.ts
export function getProductionUrl(): string {
  return 'https://launchpulse.io';
}

export function getInviteUrl(token: string): string {
  // Always use production for email links
  return `${getProductionUrl()}/auth?invite=${token}`;
}
```

Update all invitation components to use this helper:
- `InviteUserModal.tsx`
- `InvitationsManager.tsx`  
- `CreateOrganizationDialog.tsx`

### 3. Keep Dynamic for OAuth Redirects

OAuth success redirects should continue using `window.location.origin` since users need to return to the environment they started from.

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/oauth-callback/index.ts` | Fix broken error redirect URL |
| `src/lib/url-utils.ts` | Create new utility file |
| `src/components/settings/InviteUserModal.tsx` | Use standardized invite URL |
| `src/components/settings/InvitationsManager.tsx` | Use standardized invite URL |
| `src/components/settings/CreateOrganizationDialog.tsx` | Use standardized invite URL |

## Summary Table

| URL Type | Current Approach | Recommended Approach |
|----------|-----------------|---------------------|
| Password reset | ✅ Hardcoded production | Keep as-is |
| Email confirmations | 🟡 Dynamic origin | Consider hardcoding production |
| Invitation emails | 🟡 Mixed | Standardize to production |
| OAuth success | ✅ Dynamic origin | Keep as-is (correct) |
| OAuth error | ❌ Broken | Fix to production URL |
