
# Fix Password Reset Flow

## Problem Summary

The "Forgot password?" button is broken in two ways:

| Issue | Current Behavior | Expected Behavior |
|-------|-----------------|-------------------|
| 1. No email input | Button navigates directly to `/reset-password` | Should show email input form and send reset email |
| 2. Auth session missing | Reset page shows error because no session exists | Session should come from clicking email link |

## Root Cause

The password reset flow is incomplete:
- The `resetPassword()` function in `use-auth.tsx` exists and works correctly
- BUT it's never called - the "Forgot password?" button just navigates away
- Users land on `/reset-password` without a valid session from the email link

## Solution

Create a proper two-step password reset flow:

### Step 1: Add "Forgot Password" Request Form

Create a new page or dialog where users enter their email to request a reset link.

**Option A: Inline in Auth Page (Recommended)**
- Add a "forgot password" mode to `AuthSystem.tsx`
- When clicked, shows email input instead of login form
- Calls `resetPassword(email)` and shows success message

**Option B: Separate Page**
- Create `/forgot-password` page with email input
- Redirects back to `/auth` after sending email

### Step 2: Fix Reset Password Page

Update `ResetPassword.tsx` to:
1. Better detect when session is missing (user navigated directly)
2. Show helpful message: "Please check your email for the reset link"
3. Provide "Back to login" button

---

## Implementation Details

### Changes to `src/components/AuthSystem.tsx`

Add a "forgot password" state that shows an email-only form:

```typescript
const [showForgotPassword, setShowForgotPassword] = useState(false);

// In the forgot password view:
<div className="space-y-4">
  <p className="text-sm text-muted-foreground">
    Enter your email and we'll send you a password reset link.
  </p>
  <Input
    name="email"
    type="email"
    placeholder="you@company.com"
  />
  <Button onClick={() => resetPassword(email)}>
    Send Reset Link
  </Button>
  <Button variant="ghost" onClick={() => setShowForgotPassword(false)}>
    Back to Sign In
  </Button>
</div>
```

### Changes to `src/pages/ResetPassword.tsx`

Improve session detection and user guidance:

```typescript
useEffect(() => {
  const checkSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (!session) {
      // User navigated here directly without email link
      setNoSession(true);
    }
  };
  checkSession();
}, []);

// If no session, show helpful message instead of error
if (noSession) {
  return (
    <Card>
      <CardTitle>Check Your Email</CardTitle>
      <p>To reset your password, you need to click the link we sent to your email.</p>
      <p>Didn't receive an email? Go back and try again.</p>
      <Button onClick={() => navigate('/auth')}>
        Back to Login
      </Button>
    </Card>
  );
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/AuthSystem.tsx` | Add forgot password form with email input that calls `resetPassword()` |
| `src/pages/ResetPassword.tsx` | Better handle missing session with helpful UX |

---

## Expected User Flow After Fix

```text
1. User on /auth clicks "Forgot password?"
   ↓
2. Form changes to show email input
   ↓
3. User enters email, clicks "Send Reset Link"
   ↓
4. resetPassword() calls Supabase API
   ↓
5. Success message: "Check your email for reset link"
   ↓
6. User clicks link in email → lands on /reset-password WITH session
   ↓
7. User enters new password → success!
```

---

## Supabase Configuration Check

The password reset email functionality uses Supabase's built-in auth emails. These should be working, but verify:

1. **Site URL** in Supabase dashboard should be set to `https://www.launchpulse.io`
2. **Redirect URLs** should include `https://www.launchpulse.io/reset-password`

If emails aren't being sent, these settings may need to be updated in:
`Authentication > URL Configuration`
