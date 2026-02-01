

# Add "Resend Password Link" Button

## Problem

After requesting a password reset, there's no way to resend the link to the same email address with a single click. The only options are:
- **"Try another email"** → Clears the email field and shows the form again
- **"Back to Sign In"** → Returns to login screen

Users expect a "Resend" button that immediately sends another reset email to the same address.

## Current State

```text
+--------------------------------+
|    Check Your Email           |
|                                |
|  ✓ Reset link sent to...      |
|                                |
|  [Try another email]           |  ← Clears email, shows form
|  [Back to Sign In]             |  ← Goes to login
+--------------------------------+
```

## Solution

Add a **"Resend link"** button that keeps the email and calls `resetPassword` again.

```text
+--------------------------------+
|    Check Your Email           |
|                                |
|  ✓ Reset link sent to...      |
|                                |
|  [Resend link]                 |  ← NEW: Sends again
|  [Try another email]           |
|  [Back to Sign In]             |
+--------------------------------+
```

## Technical Changes

### File: `src/components/AuthSystem.tsx`

**Add "Resend link" button to the success state (around lines 287-297):**

Before:
```tsx
<div className="flex flex-col gap-2">
  <Button
    variant="outline"
    className="w-full"
    onClick={() => {
      setForgotPasswordSent(false);
      setForgotPasswordEmail('');
    }}
  >
    Try another email
  </Button>
```

After:
```tsx
<div className="flex flex-col gap-2">
  <Button
    variant="default"
    className="w-full"
    onClick={async () => {
      setForgotPasswordLoading(true);
      await resetPassword(forgotPasswordEmail);
      setForgotPasswordLoading(false);
    }}
    disabled={forgotPasswordLoading}
  >
    {forgotPasswordLoading ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Sending...
      </>
    ) : (
      "Resend link"
    )}
  </Button>
  <Button
    variant="outline"
    className="w-full"
    onClick={() => {
      setForgotPasswordSent(false);
      setForgotPasswordEmail('');
    }}
  >
    Try another email
  </Button>
```

**Also need to add `Loader2` to imports (if not already imported).**

## Files to Modify

| File | Change |
|------|--------|
| `src/components/AuthSystem.tsx` | Add "Resend link" button with loading state before "Try another email" button |

## Expected Outcome

- Users can click "Resend link" to send another password reset email to the same address
- Button shows loading state while sending
- Success/error toasts appear as usual from the `resetPassword` function

