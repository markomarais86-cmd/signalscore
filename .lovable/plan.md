
# Fix Password Reset Link Pointing to Localhost

## Problem

When clicking the password reset link from the email, users are redirected to `localhost:3000` which doesn't work because:

1. The `resetPassword()` function uses `window.location.origin` for the redirect URL
2. When you triggered the reset from your local development environment, it captured `http://localhost:3000`
3. Supabase stored this and put it in the email link

## Solution

Two changes are needed:

### 1. Supabase Dashboard Configuration (Required - You Must Do This)

Go to your Supabase Dashboard and update these settings:

**Authentication > URL Configuration:**

| Setting | Current (Likely) | Should Be |
|---------|-----------------|-----------|
| Site URL | `http://localhost:3000` | `https://www.launchpulse.io` |
| Redirect URLs | Missing entries | Add all of these: |
| | | `https://www.launchpulse.io/**` |
| | | `https://signalscore.lovable.app/**` |
| | | `https://id-preview--f6080332-94e1-4aef-bfee-6cc8143489f0.lovable.app/**` |

### 2. Code Change - Use Production URL for Password Reset

Update `src/hooks/use-auth.tsx` to use the production URL instead of `window.location.origin`:

**Current code:**
```typescript
const resetPassword = async (email: string) => {
  const redirectUrl = `${window.location.origin}/reset-password`;
  // ...
};
```

**Updated code:**
```typescript
const resetPassword = async (email: string) => {
  // Always use production URL for password reset emails
  // This ensures the email link works regardless of where the reset was triggered
  const productionUrl = 'https://www.launchpulse.io';
  const redirectUrl = `${productionUrl}/reset-password`;
  // ...
};
```

This ensures that even if you trigger a password reset from localhost, the preview URL, or any other environment, the email link will always point to your production site.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/use-auth.tsx` | Hardcode production URL for password reset redirect |

---

## Why This Happens

When `resetPasswordForEmail()` is called, Supabase:
1. Takes the `redirectTo` URL you provide
2. Validates it against your configured Redirect URLs in the dashboard
3. Embeds it in the email template

If you call this from `localhost:3000`, it captures that origin. The dashboard settings act as a whitelist - if localhost isn't in the Redirect URLs, Supabase may fall back to the Site URL (which might also be localhost).

---

## Expected Flow After Fix

```text
1. User clicks "Forgot password?" (from any environment)
   ↓
2. Code sends redirect URL as https://www.launchpulse.io/reset-password
   ↓
3. Supabase validates against Redirect URLs whitelist (passes)
   ↓
4. Email contains link to https://www.launchpulse.io/reset-password#token=xxx
   ↓
5. User clicks link → lands on production site with valid token
   ↓
6. Password reset form works correctly
```

---

## Immediate Action Required

Before any code changes will help, you **must update the Supabase Dashboard settings**. Go to:

`https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/auth/url-configuration`

And configure the Site URL and Redirect URLs as described above.
