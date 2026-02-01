
# Fix Login After Failed Password Reset

## Summary

The password reset failed because the email link pointed to `localhost:3000`. Your password was never actually changed, which is why login with your "new" password fails.

## Immediate Solution

### Step 1: Verify Supabase URL Configuration (You Must Do This First)

Go to your Supabase Dashboard:
**https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/auth/url-configuration**

Set these values:

| Setting | Value |
|---------|-------|
| Site URL | `https://www.launchpulse.io` |
| Redirect URLs (add all) | `https://www.launchpulse.io/**` |
| | `https://signalscore.lovable.app/**` |
| | `https://id-preview--f6080332-94e1-4aef-bfee-6cc8143489f0.lovable.app/**` |

### Step 2: Request a New Password Reset

1. Go to **https://www.launchpulse.io** (the published site, NOT localhost)
2. Click "Forgot password?"
3. Enter your email
4. Check your email for the new reset link
5. Click the link - it should now go to `https://www.launchpulse.io/reset-password`
6. Set your new password

### Step 3: Login with New Password

After successfully resetting, login should work.

## Why This Happened

```text
Old Flow (Broken):
1. You clicked "Forgot password" from localhost:3000
2. Code used window.location.origin → captured localhost
3. Email link pointed to localhost:3000/reset-password
4. localhost isn't running → reset form never loaded
5. Password never changed → old password still active
6. You tried logging in with "new" password → fails
```

## Code Already Fixed

I already updated `src/hooks/use-auth.tsx` to hardcode the production URL:

```typescript
const resetPassword = async (email: string) => {
  const productionUrl = 'https://www.launchpulse.io';
  const redirectUrl = `${productionUrl}/reset-password`;
  // ...
};
```

This fix is deployed if you published. But **the Supabase Dashboard settings must also be updated** for this to work completely.

## Verification Steps

After completing the above:

1. Test password reset from the **published site** (not localhost)
2. Verify the email link points to `https://www.launchpulse.io/reset-password`
3. Complete the password reset
4. Login with the new password

## Files

No additional code changes needed - the fix was already implemented. This is a configuration issue in Supabase Dashboard.

## Technical Details

The auth logs confirm:
- All requests show `referer: http://localhost:3000` - indicating requests came from local environment
- `error_code: "invalid_credentials"` at 20:08:27 UTC - login failed because password was never updated
- Password reset emails were sent but pointed to localhost
