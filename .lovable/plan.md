
# Fix LaunchPulse AI 401 Unauthorized Errors

## Problem Summary

Multiple AI-related edge functions are returning **401 Unauthorized** errors:
- `ai-memory/index.ts` → "Unauthorized"
- `generate-icp-insights/index.ts` → "Invalid or expired token"

This is breaking the AI chatbot and all AI features in LaunchPulse.

## Root Cause Analysis

The issue stems from two problems:

1. **`verify_jwt = true` in config.toml doesn't work with Lovable Cloud**: This project uses ES256 token signing (Lovable Cloud), but the Supabase gateway's JWT verification doesn't properly handle ES256 tokens. When `verify_jwt = true`, valid tokens get rejected at the gateway level **before the code even runs**.

2. **Using `getClaims()` instead of `getUser()`**: The shared auth module and `ai-memory` function use `supabase.auth.getClaims(token)` which can fail in certain edge cases. The more reliable method is `supabase.auth.getUser(token)` which performs server-side JWT validation.

### Functions Affected

The following AI functions have `verify_jwt = true` and will fail:

| Function | Line in config.toml |
|----------|---------------------|
| `ai-chat` | 190 |
| `ai-actions-router` | 193 |
| `ai-actions-search` | 196 |
| `ai-actions-analytics` | 199 |
| `ai-actions-icp` | 202 |
| `ai-actions-agents` | 205 |
| `ai-orchestrator` | 208 |
| `generate-icp-insights` | 55 |
| `generate-proactive-insights` | 220 |
| `generate-account-insights` | 226 |
| `ask-account-ai` | 307 |

The `ai-memory` function already has `verify_jwt = false` (line 211) but uses `getClaims()` which is failing.

## Solution

### Part 1: Update `supabase/config.toml`

Set `verify_jwt = false` for all AI-related functions that are called from the frontend. This disables gateway-level verification, allowing the code's own authentication logic to run.

**Functions to change from `verify_jwt = true` to `verify_jwt = false`:**
- `ai-chat`
- `ai-actions-router`
- `ai-actions-search`
- `ai-actions-analytics`
- `ai-actions-icp`
- `ai-actions-agents`
- `ai-orchestrator`
- `generate-icp-insights`
- `generate-proactive-insights`
- `generate-account-insights`
- `ask-account-ai`

### Part 2: Update `supabase/functions/_shared/auth.ts`

Replace `getClaims(token)` with `getUser(token)` for more reliable JWT validation.

**Before (lines 57-80):**
```typescript
// Validate JWT token using getClaims (recommended approach)
const token = authHeader.replace('Bearer ', '');
const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);

if (claimsError || !claimsData?.claims) {
  console.error('[Auth] Token validation failed:', claimsError?.message);
  return {
    success: false,
    error: 'Invalid or expired token',
  };
}

const claims = claimsData.claims;

return {
  success: true,
  user: {
    id: claims.sub as string,
    email: claims.email as string | undefined,
    role: claims.role as string | undefined,
  },
  supabaseClient,
};
```

**After:**
```typescript
// Validate JWT token using getUser for reliable server-side validation
// CRITICAL: Must pass token explicitly when verify_jwt=false
const token = authHeader.replace('Bearer ', '');
const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

if (authError || !user) {
  console.error('[Auth] Token validation failed:', authError?.message);
  return {
    success: false,
    error: 'Invalid or expired token',
  };
}

return {
  success: true,
  user: {
    id: user.id,
    email: user.email,
    role: user.role,
  },
  supabaseClient,
};
```

### Part 3: Update `supabase/functions/ai-memory/index.ts`

Replace `getClaims(token)` with `getUser(token)`.

**Before (lines 41-51):**
```typescript
const token = authHeader.replace('Bearer ', '');
const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);

if (claimsError || !claimsData?.claims) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const userId = claimsData.claims.sub as string;
```

**After:**
```typescript
const token = authHeader.replace('Bearer ', '');
const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

if (authError || !user) {
  console.error('[ai-memory] Auth error:', authError?.message);
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const userId = user.id;
```

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/config.toml` | Set `verify_jwt = false` for 11 AI functions |
| `supabase/functions/_shared/auth.ts` | Replace `getClaims()` with `getUser()` |
| `supabase/functions/ai-memory/index.ts` | Replace `getClaims()` with `getUser()` |

## Why This Works

- **`verify_jwt = false`**: Disables gateway-level JWT verification that doesn't support ES256 tokens (used by Lovable Cloud)
- **`getUser(token)`**: Performs proper server-side JWT validation that handles all token types correctly
- **Explicit token parameter**: Critical when `verify_jwt = false` — without passing the token explicitly, the auth check won't validate anything

## Expected Outcome

After these changes:
- All AI features will authenticate correctly
- No more 401 "Unauthorized" or "Invalid or expired token" errors
- The LaunchPulse AI chatbot will work as expected
- Authentication will work reliably across all environments

## Testing

After implementation, test by:
1. Opening the LaunchPulse AI chatbot
2. Asking a question
3. Verifying the response comes through without 401 errors
