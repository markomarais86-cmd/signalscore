

# Fix Password Reset Link Not Working

## Problem Summary

The password reset flow breaks at step 3 - when clicking the link from the email:

| Step | Status | Issue |
|------|--------|-------|
| 1. Click "Forgot password?" | Works | Shows email input form |
| 2. Enter email, get reset link | Works | Email is sent by Supabase |
| 3. Click link in email | Broken | Page shows "Check Your Email" instead of password form |

## Root Cause

When you click the reset link from your email, Supabase redirects you to `/reset-password` with a special token in the URL hash:

```text
https://www.launchpulse.io/reset-password#access_token=xxx&type=recovery
```

The current `ResetPassword.tsx` immediately checks for a session and shows the "no session" message before Supabase has a chance to process the token and create a session. This is a **race condition**.

The app also doesn't listen for the `PASSWORD_RECOVERY` auth event from Supabase.

## Solution

Update `ResetPassword.tsx` to:

1. Wait for Supabase to process the URL hash token before checking session
2. Listen for the `PASSWORD_RECOVERY` auth event
3. Only show the "no session" message if:
   - No recovery token in URL AND
   - No session exists after waiting

---

## Implementation Details

### Changes to `src/pages/ResetPassword.tsx`

```typescript
import { useActionState, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function ResetPassword() {
  const [noSession, setNoSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  
  useEffect(() => {
    let mounted = true;
    
    // Check if URL has recovery token (from email link)
    const hasRecoveryToken = window.location.hash.includes('type=recovery') ||
                              window.location.hash.includes('access_token');
    
    // Set up auth state listener FIRST - this catches the PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        console.log('Auth event:', event); // Debug
        
        if (event === 'PASSWORD_RECOVERY') {
          // Token was valid - session is now active
          setCheckingSession(false);
          setNoSession(false);
        } else if (event === 'SIGNED_IN' && session) {
          // Already signed in
          setCheckingSession(false);
          setNoSession(false);
        }
      }
    );
    
    // Then check for existing session
    const checkSession = async () => {
      // If URL has recovery token, wait a bit for Supabase to process it
      if (hasRecoveryToken) {
        // Give Supabase time to process the hash token
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!mounted) return;
      
      if (session) {
        // Session exists (either from recovery or existing login)
        setNoSession(false);
      } else if (!hasRecoveryToken) {
        // No session AND no recovery token - user navigated directly
        setNoSession(true);
      }
      // If hasRecoveryToken but no session yet, keep waiting for auth event
      
      setCheckingSession(false);
    };
    
    checkSession();
    
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);
  
  // ... rest of component
}
```

### Key Changes

1. **Detect recovery token in URL** - Check for `type=recovery` or `access_token` in hash
2. **Listen for PASSWORD_RECOVERY event** - Supabase fires this when token is processed
3. **Add delay for token processing** - Give Supabase time to exchange the token
4. **Better logic for "no session"** - Only show error if no token AND no session

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/ResetPassword.tsx` | Add auth state listener for `PASSWORD_RECOVERY` event, detect URL token, add processing delay |

---

## Expected User Flow After Fix

```text
1. User on /auth clicks "Forgot password?"
   ↓
2. Form shows email input
   ↓
3. User enters email, clicks "Send Reset Link"
   ↓
4. Supabase sends email with reset link
   ↓
5. User clicks link in email → lands on /reset-password#access_token=xxx&type=recovery
   ↓
6. Page shows loading spinner while Supabase processes token
   ↓
7. Supabase fires PASSWORD_RECOVERY event, session is created
   ↓
8. Password reset form appears
   ↓
9. User enters new password → success!
```

---

## Supabase Configuration Reminder

Make sure these settings are correct in Supabase Dashboard (Authentication > URL Configuration):

| Setting | Value |
|---------|-------|
| Site URL | `https://www.launchpulse.io` |
| Redirect URLs | Should include `https://www.launchpulse.io/reset-password` |

