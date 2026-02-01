
# Fix Password Reset Redirecting Immediately After Login

## Problem Identified

The password reset link now correctly points to `https://www.launchpulse.io/reset-password` (confirmed in auth logs). However, when you click it:

1. Supabase processes the recovery token and creates a session
2. The `useAuth` hook detects the session and sets `user`
3. `ResetPassword.tsx` line 82-84 runs: `if (user) { return <Navigate to="/" replace />; }`
4. You get redirected to the homepage instead of seeing the password reset form

The page doesn't distinguish between a **password recovery session** and a **regular login session**.

## Solution

Modify `ResetPassword.tsx` to:
1. Track whether we're in a password recovery flow using a state variable
2. Listen for the `PASSWORD_RECOVERY` auth event specifically  
3. Only redirect away if the user is logged in **and** we're NOT in password recovery mode

## Technical Changes

### File: `src/pages/ResetPassword.tsx`

**Current logic (broken):**
```typescript
if (user) {
  return <Navigate to="/" replace />;
}
```

**New logic:**
```typescript
// Track if we're in password recovery mode
const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

// In the auth listener:
if (event === 'PASSWORD_RECOVERY') {
  setIsPasswordRecovery(true);  // Mark that we're recovering password
  setCheckingSession(false);
  setNoSession(false);
}

// Updated redirect check:
if (user && !isPasswordRecovery) {
  return <Navigate to="/" replace />;
}
```

This ensures:
- If you're logged in normally and visit `/reset-password` → redirects to home
- If you arrived via password recovery link → shows the password reset form

## Flow After Fix

```text
Password Recovery Flow:
1. Click recovery link → lands on /reset-password#token=xxx
2. Supabase fires PASSWORD_RECOVERY event
3. isPasswordRecovery = true
4. user is set (recovery creates a session)
5. Check: user && !isPasswordRecovery → false (don't redirect)
6. Password reset form is displayed ✓
7. User enters new password and submits
8. Success → navigate to "/"

Normal Login Flow:
1. User logs in normally
2. user is set
3. If they visit /reset-password directly
4. isPasswordRecovery = false
5. Check: user && !isPasswordRecovery → true (redirect)
6. Redirects to "/" ✓
```

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/ResetPassword.tsx` | Add `isPasswordRecovery` state, update redirect logic |

## Why This Works

The `PASSWORD_RECOVERY` event is fired by Supabase **only** when processing a valid recovery token from an email link. Regular logins fire `SIGNED_IN` instead. By tracking this event, we can distinguish between the two scenarios.
