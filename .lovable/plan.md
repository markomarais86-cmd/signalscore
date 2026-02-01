
# Improve Password Reset Email Template

## Overview

Currently, the password reset uses Supabase's default email template via `supabase.auth.resetPasswordForEmail()`. To create a custom branded email with LaunchPulse's design and clearer instructions, we need to implement a custom email sending system using Supabase Auth Hooks and React Email.

## What We'll Create

### 1. Email Assets Storage Bucket

Create a public storage bucket to host the LaunchPulse logo for email templates.

**File: `supabase/migrations/XXXXXX_create_email_assets_bucket.sql`**

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-assets', 'email-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Email assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-assets');
```

### 2. Password Reset Email Template

Create a React Email template with LaunchPulse branding.

**File: `supabase/functions/send-auth-email/_templates/password-reset.tsx`**

The template will include:
- LaunchPulse logo and brand colors
- Clear, friendly instructions
- Primary CTA button for resetting password
- Fallback text link
- Security notice
- Help section with contact information
- Professional footer

Key design elements:
- Brand color: `#6366f1` (primary purple/indigo)
- Clean white background with subtle gray footer
- Mobile-responsive table-based layout
- Clear typography hierarchy

### 3. Auth Email Edge Function

Create an edge function that handles Supabase Auth email hooks.

**File: `supabase/functions/send-auth-email/index.ts`**

This function will:
- Receive password reset requests via Supabase Auth Hook
- Validate the webhook signature using `standardwebhooks`
- Render the React Email template with user data
- Send the email via Resend API
- Handle errors gracefully

**Config: `supabase/config.toml`**

```toml
[functions.send-auth-email]
verify_jwt = false
```

## Email Template Design

```text
┌─────────────────────────────────────────────────────────┐
│                                                         │
│     [LaunchPulse Logo]                                  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│     Reset Your Password                                 │
│                                                         │
│     Hi [Name],                                          │
│                                                         │
│     We received a request to reset your password        │
│     for your LaunchPulse account. Click the button      │
│     below to create a new password.                     │
│                                                         │
│              ┌─────────────────────┐                    │
│              │   Reset Password    │ (purple button)    │
│              └─────────────────────┘                    │
│                                                         │
│     This link expires in 1 hour for security.           │
│                                                         │
├─────────────────────────────────────────────────────────┤
│     Security Notice                                     │
│     If you didn't request this reset, you can           │
│     safely ignore this email. Your password will        │
│     remain unchanged.                                   │
├─────────────────────────────────────────────────────────┤
│     Having trouble?                                     │
│     Copy and paste this link: [URL]                     │
│                                                         │
│     Need help? Contact us at support@launchpulse.io     │
├─────────────────────────────────────────────────────────┤
│     © 2026 LaunchPulse. All rights reserved.            │
│     Where GTM Meets ICP Precision                       │
└─────────────────────────────────────────────────────────┘
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/XXXXXX_create_email_assets_bucket.sql` | Create | Storage bucket for email logo |
| `supabase/functions/send-auth-email/_templates/password-reset.tsx` | Create | React Email template |
| `supabase/functions/send-auth-email/index.ts` | Create | Edge function handler |
| `supabase/config.toml` | Modify | Add function config |

## Post-Implementation Steps

After deployment, you'll need to configure the Auth Hook in Supabase:

1. Go to Supabase Dashboard → Authentication → Hooks
2. Enable the "Send Email" hook
3. Set the URL to: `https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/send-auth-email`
4. Generate and save the webhook secret as `SEND_EMAIL_HOOK_SECRET` in project secrets

## Technical Details

### Dependencies Used
- `npm:@react-email/components@0.0.22` - Email component library
- `npm:react@18.3.1` - React for template rendering
- `npm:resend@4.0.0` - Email sending API
- `https://esm.sh/standardwebhooks@1.0.0` - Webhook signature verification

### Email Types Handled
The function will handle:
- `recovery` - Password reset emails (primary focus)
- Other auth email types can be added later (magic links, email verification)

### Brand Colors
- Primary: `#6366f1` (Indigo)
- Text: `#18181b` (Near black)
- Muted: `#71717a` (Gray)
- Background: `#ffffff` (White)
- Footer bg: `#f4f4f5` (Light gray)

### Security Features
- Webhook signature verification using `standardwebhooks`
- Token hash passed via secure URL parameter
- 1-hour expiration notice
- Clear security messaging about ignoring unexpected emails
