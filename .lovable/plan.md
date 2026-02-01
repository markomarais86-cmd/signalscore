
# Fix "this is not right" Error on Password Reset

## Problem Summary

When clicking "Update Password" after filling in the new password form, users see a cryptic error message "this is not right" instead of the password being updated.

| Issue | Root Cause |
|-------|------------|
| Cryptic error message | Raw Supabase API error shown to user |
| Password update fails | Session may not be fully ready, or token expired |

## Technical Diagnosis

The error flows from:
```
supabase.auth.updateUser({ password })
    ↓ fails
error.message = "this is not right"
    ↓ displayed via
createErrorState(error.message)
```

This Supabase error indicates the session is invalid or the recovery token has issues. Possible causes:

1. **Token expired** - Recovery tokens expire after 1 hour
2. **Token already used** - Tokens are single-use
3. **Session not fully established** - Race condition between token processing and form submission
4. **Token exchange failed silently** - The hash token wasn't properly converted to a session

## Solution

Improve the password reset flow with:

1. **Better session verification before allowing form submission**
2. **User-friendly error messages instead of raw API errors**
3. **Verify the session is valid before attempting updateUser**
4. **Add a "request new link" option when token issues occur**

---

## Implementation Details

### Changes to `src/pages/ResetPassword.tsx`

**1. Verify session is valid before password update:**

```typescript
const resetAction = async (prevState: FormState, formData: FormData): Promise<FormState> => {
  const password = getFormValue(formData, 'password');
  const confirmPassword = getFormValue(formData, 'confirmPassword');

  if (password !== confirmPassword) {
    return createErrorState("Passwords don't match.");
  }

  if (password.length < 6) {
    return createErrorState("Password must be at least 6 characters long.");
  }

  // Verify we have a valid session before attempting update
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return createErrorState("Your reset link has expired. Please request a new password reset link.");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    // Map cryptic Supabase errors to user-friendly messages
    let friendlyMessage = error.message;
    
    if (error.message.includes('not right') || 
        error.message.includes('invalid') ||
        error.message.includes('expired')) {
      friendlyMessage = "Your reset link has expired or is invalid. Please request a new password reset link.";
    } else if (error.message.includes('same_password')) {
      friendlyMessage = "New password must be different from your current password.";
    }
    
    return createErrorState(friendlyMessage);
  }

  // Success
  toast({
    title: "Password updated",
    description: "Your password has been updated successfully."
  });
  navigate("/");
  return createFormState();
};
```

**2. Add option to request new link when error occurs:**

Update the error display in the form to include a link back to request a new reset:

```tsx
{state.error && (
  <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>
      {state.error}
      {state.error.includes('expired') && (
        <Button 
          variant="link" 
          className="p-0 h-auto ml-1 text-primary"
          onClick={() => navigate('/auth')}
        >
          Request new link
        </Button>
      )}
    </AlertDescription>
  </Alert>
)}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/ResetPassword.tsx` | Add session verification before updateUser, improve error messages |

---

## Expected Behavior After Fix

| Scenario | Before | After |
|----------|--------|-------|
| Token expired | "this is not right" | "Your reset link has expired. Please request a new password reset link." |
| Token invalid | Cryptic error | Clear message + link to request new |
| Same password | Error shown | "New password must be different from your current password." |
| Success | Works | No change |

---

## Additional Recommendation

**Supabase Dashboard Setting:** The password reset token expiry can be configured in Supabase. The default is 1 hour. If users often have expired tokens, consider increasing this in:

`Authentication > URL Configuration > Password recovery link expiry`

You may want to increase it to 24 hours for a better user experience.
