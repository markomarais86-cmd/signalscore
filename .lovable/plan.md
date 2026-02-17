

# Fix: Bulk Score Edge Function Never Reached

## Root Cause

Two issues prevent the browser from reaching the `bulk-score-accounts` edge function:

### 1. `verify_jwt = true` kills the CORS preflight

When the browser calls an edge function, it first sends an `OPTIONS` preflight request (no auth headers). With `verify_jwt = true` in `config.toml`, the Supabase gateway rejects this preflight with 401 before the function code ever runs. The browser sees the failed preflight and never sends the actual `POST`. This is why there are **zero logs** -- the function code never executes.

### 2. Missing CORS allowed headers

The shared `cors.ts` only allows `authorization, x-client-info, apikey, content-type`, but the Supabase JS client also sends `x-supabase-client-platform`, `x-supabase-client-platform-version`, `x-supabase-client-runtime`, and `x-supabase-client-runtime-version`. Even if the preflight got through, these extra headers would cause a CORS rejection.

## Fix Plan

### Step 1: Set `verify_jwt = false` for bulk-score-accounts

In `supabase/config.toml`, change:

```text
[functions.bulk-score-accounts]
verify_jwt = false
```

The function already performs its own JWT validation in code (lines 141-153 of `index.ts`), so security is maintained. This just lets the gateway pass through the OPTIONS preflight.

### Step 2: Update CORS allowed headers

In `supabase/functions/_shared/cors.ts`, update `Access-Control-Allow-Headers` to include the Supabase client headers:

```text
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'
```

This applies to both the `getCorsHeaders()` function and the legacy `corsHeaders` export.

### Step 3: Redeploy the edge function

Deploy `bulk-score-accounts` to pick up the config and CORS changes.

## Files to Change

1. `supabase/config.toml` -- Set `verify_jwt = false` for `bulk-score-accounts`
2. `supabase/functions/_shared/cors.ts` -- Add missing Supabase client headers to the allow list
3. Redeploy `bulk-score-accounts`

## Expected Outcome

- The OPTIONS preflight passes through the gateway
- The function code handles its own auth check
- CORS headers match what the browser sends
- Logs will appear and scoring will begin
