

# Redirect & Demo Email Implementation Plan

## Overview

This plan covers two changes:
1. **Redirect logged-out users to marketing homepage** - Update the redirect targets from `/auth` to `/landing`
2. **Demo request email notification** - Create edge function to send demo request emails to contact@launchpulse.io

---

## Part 1: Update Redirect Logic

### Change 1: Sign-Out Redirect

**File:** `src/hooks/use-auth.tsx` (lines 161-165)

**Current:**
```typescript
if (event === 'SIGNED_OUT') {
  authLogger.info('User signed out, redirecting to /auth');
  window.location.href = '/auth';
}
```

**Updated:**
```typescript
if (event === 'SIGNED_OUT') {
  authLogger.info('User signed out, redirecting to /landing');
  window.location.href = '/landing';
}
```

---

### Change 2: Protected Route Redirect

**File:** `src/components/ProtectedRoute.tsx` (line 47)

**Current:**
```typescript
if (!user) {
  return <Navigate to="/auth" state={{ from: location }} replace />;
}
```

**Updated:**
```typescript
if (!user) {
  return <Navigate to="/landing" state={{ from: location }} replace />;
}
```

---

## Part 2: Demo Request Email Function

### Step 1: Create Edge Function

**New File:** `supabase/functions/demo-request/index.ts`

This function will:
- Accept demo request form data (name, email, company, subject, message)
- Send notification email to `contact@launchpulse.io` via Resend
- Send confirmation email to the requester
- Return success/error response

**Key features:**
- Uses existing `RESEND_API_KEY` secret (already configured)
- CORS headers for web access
- No JWT verification (public form)
- Proper error handling and logging

---

### Step 2: Update Config

**File:** `supabase/config.toml`

Add entry for the new function:
```toml
[functions.demo-request]
verify_jwt = false
```

---

### Step 3: Update Demo Request Form

**File:** `src/components/marketing/DemoRequestForm.tsx`

**Current:** Logs to console and simulates API call

**Updated:**
- Call the `demo-request` edge function via `supabase.functions.invoke`
- Handle success/error responses properly
- Show appropriate toast messages

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/use-auth.tsx` | Modify | Change sign-out redirect to `/landing` |
| `src/components/ProtectedRoute.tsx` | Modify | Change unauthenticated redirect to `/landing` |
| `supabase/functions/demo-request/index.ts` | Create | Edge function to send demo request emails |
| `supabase/config.toml` | Modify | Add demo-request function config |
| `src/components/marketing/DemoRequestForm.tsx` | Modify | Connect form to edge function |

---

## Email Content

### Notification Email (to contact@launchpulse.io)

**Subject:** New Demo Request from {name}

**Body:**
- Name
- Email
- Company (if provided)
- Subject (if provided)
- Message (if provided)
- Timestamp

### Confirmation Email (to requester)

**Subject:** Thanks for your interest in LaunchPulse!

**Body:**
- Acknowledgment of receipt
- Next steps (team will reach out within 24 hours)
- Contact email for questions

---

## User Flow After Implementation

| Scenario | Current | New |
|----------|---------|-----|
| Visit `/` logged out | Redirect to `/auth` | Redirect to `/landing` |
| Sign out | Redirect to `/auth` | Redirect to `/landing` |
| Submit demo form | Console log only | Email to contact@launchpulse.io + confirmation to user |
| Click "Sign In" in nav | Goes to `/auth` | Goes to `/auth` (unchanged) |

---

## Dependencies

- **RESEND_API_KEY** - Already configured
- **Verified domain in Resend** - Emails will be sent from `noreply@launchpulse.io` (you'll need to verify this domain in Resend if not already done)

---

## Implementation Order

1. Update redirect in `use-auth.tsx`
2. Update redirect in `ProtectedRoute.tsx`
3. Create `demo-request` edge function
4. Update `config.toml` with function entry
5. Update `DemoRequestForm.tsx` to call edge function
6. Test end-to-end flow

