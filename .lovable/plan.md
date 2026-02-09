

## Fix Password Reset: Add the Missing Webhook Secret

### The Problem

The `send-auth-email` Edge Function crashes because it tries to verify a webhook signature using `SEND_EMAIL_HOOK_SECRET`, which was never added to the secrets. This breaks the entire password reset flow.

### What You Need to Do

1. **Go to your Supabase Dashboard**:  
   [Authentication > Hooks](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/auth/hooks)

2. **Find the "Send Email" hook** — it should be pointing to your `send-auth-email` Edge Function

3. **Copy the hook secret** — it will look something like `whsec_xxxxxxxxxxxxxxxxxxxxxxxx`
   - If no hook is configured yet, you'll need to create one:
     - Hook type: "Send Email"
     - Endpoint: `https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/send-auth-email`
     - It will generate a secret for you — copy that

4. **I will then add it** as `SEND_EMAIL_HOOK_SECRET` to your Edge Function secrets using the add_secret tool

### After the Secret Is Added

- Password reset requests will flow through correctly
- The Edge Function will verify the webhook, render the email template, and send via Resend
- No code changes needed — the function is already correctly written

### Quick Workaround (Optional)

If you need to log in right now while we set this up, you can manually reset your password in the [Supabase Users panel](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/auth/users) by clicking on your user and updating the password directly.

