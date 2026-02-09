

## Add Rate Limit Error Handling to Password Reset

### Problem
When users hit the email rate limit during password reset, they get no clear feedback. The Supabase API returns a 429 status with "email rate limit exceeded", but the UI doesn't handle this specific error.

### Changes

**File: `src/pages/ResetPassword.tsx`** (or wherever the reset request is triggered)

First, I need to find where the password reset *request* (the "send me a reset link" form) lives -- this is likely on the Auth page since the user is on `/auth`.

**File: `src/lib/friendly-errors.ts`**
- The mapping `'rate limit': 'Too many requests. Please wait a moment and try again.'` already exists but is generic. Add a more specific mapping for the email rate limit scenario.

### Technical Details

1. **`src/lib/friendly-errors.ts`** -- Add a specific mapping:
   - Key: `'email rate limit'` with message: `"Too many reset attempts. Please wait about 60 minutes before trying again."`
   - Key: `'over_email_send_rate_limit'` with message: same as above
   - Place these before the generic `'rate limit'` entry so they match first

2. **Auth page (password reset request handler)** -- Ensure the error from `supabase.auth.resetPasswordForEmail()` is caught and displayed using the friendly error system. The 429 response message or error code should flow through `friendlyErrorMessage()` and display in the UI (e.g., as an alert or toast).

### Result
When a user hits the rate limit, they'll see: *"Too many reset attempts. Please wait about 60 minutes before trying again."* instead of a generic or missing error message.

