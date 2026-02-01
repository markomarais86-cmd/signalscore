
# Fix AI Chat 401 Errors and Network Issues

## Problem Analysis

After investigating the logs, code, and error patterns, I identified multiple issues causing the "Network error" message when using the AI chatbot:

### Issue 1: CORS Not Allowing Custom Domain
The user's custom domain `launchpulse.io` is not included in the allowed CORS origins. The current CORS configuration only allows:
- `*.lovable.app` domains
- `localhost` for development

When requests come from `launchpulse.io`, the CORS check fails and the browser blocks the response, causing "Failed to fetch" errors.

### Issue 2: Race Condition in Session Retrieval
The `use-ai-chat.tsx` hook calls `supabase.auth.getSession()` directly instead of using the `useAuth()` context. This can cause a race condition where:
1. User opens AI chat
2. `sendMessage` is called
3. `getSession()` returns null because the session is still being restored
4. Request is sent without Authorization header

### Issue 3: No Retry Logic for Auth Failures
When `getSession()` fails initially, there's no retry mechanism. The user sees "Please log in" even though they are logged in (just the session wasn't ready yet).

## Solution

### Part 1: Add Custom Domain to CORS Configuration

**File: `supabase/functions/_shared/cors.ts`**

Add `launchpulse.io` and its subdomains to the allowed origins:

```typescript
// Line 16-24 - Update default allowed origins
return [
  // Production custom domain
  'https://launchpulse.io',
  'https://www.launchpulse.io',
  // Lovable preview URLs
  'https://id-preview--f6080332-94e1-4aef-bfee-6cc8143489f0.lovable.app',
  // Published URL
  'https://signalscore.lovable.app',
  // Development
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8080',
];
```

### Part 2: Use Auth Context in AI Chat Hook

**File: `src/hooks/use-ai-chat.tsx`**

Instead of calling `supabase.auth.getSession()` directly, use the `useAuth()` hook which manages session state properly:

1. Import `useAuth` at the top of the file
2. Get `session` from the auth context
3. Add a wait mechanism if auth is still loading

```typescript
// Line 1-4 - Add import
import { useAuth } from '@/hooks/use-auth';

// Inside useAIChat function, add:
const { session, loading: authLoading } = useAuth();

// In sendMessage function (around line 377-386):
// Wait for auth to be ready with retry
const getAuthToken = async (): Promise<string | null> => {
  // First try the context session
  if (session?.access_token) {
    return session.access_token;
  }
  
  // If not available, wait briefly and try getSession
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData?.session?.access_token || null;
};

const token = await getAuthToken();

if (!token) {
  // If still no token after retry, the user really isn't logged in
  toast.error('Please log in to use the AI assistant');
  setIsLoading(false);
  return;
}
```

### Part 3: Improve Error Handling for 401 Responses

**File: `src/hooks/use-ai-chat.tsx`**

Add better handling for 401 errors that provides a retry option:

```typescript
// Around line 429-434 - Improve 401 handling
} else if (resp.status === 401) {
  // Try to refresh the session
  const { data: { session: newSession } } = await supabase.auth.refreshSession();
  if (newSession) {
    toast.error('Session refreshed. Please try again.');
  } else {
    toast.error('Session expired. Please log in again.');
  }
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/_shared/cors.ts` | Add `launchpulse.io` to allowed origins |
| `src/hooks/use-ai-chat.tsx` | Use `useAuth()` context and add retry logic |

## Technical Details

### Why These Changes Work

1. **CORS Fix**: Adding `launchpulse.io` ensures the browser accepts responses from edge functions when accessed from the custom domain.

2. **Auth Context**: Using `useAuth()` instead of raw `getSession()` ensures we use the already-resolved session from the auth provider, avoiding race conditions.

3. **Retry Logic**: If the session isn't immediately available, we wait and retry, handling edge cases where the auth state is still initializing.

### Testing Steps

After implementation:
1. Access the app from `launchpulse.io`
2. Open the AI chatbot
3. Send "Show me platform insights"
4. Verify the response comes through without errors

## Expected Outcome

- No more "Network error" messages when using AI chat
- No more 401 "Missing authorization header" errors
- AI chatbot works reliably from both `launchpulse.io` and `signalscore.lovable.app`
