
# Fix AI Chat Connection Error

## Problem

The "Failed to connect to AI assistant" error occurs because the frontend sends the wrong authentication token to the AI chat edge function.

## Root Cause

In `src/hooks/use-ai-chat.tsx`, the code uses a **hardcoded Supabase anon key** instead of the user's **session access token**:

```typescript
// Current (broken) - line 395
Authorization: `Bearer eyJhbGciOiJI...` // This is the anon key
```

However, the edge function `ai-chat` requires a valid user session to:
1. Authenticate the request (`validateAuth(req)`)  
2. Look up the user's `org_id` from `user_profiles`

Without the user's session token, the edge function returns a 401 Unauthorized error, which the frontend catches and displays as "Failed to connect to AI assistant."

## Comparison with Working Code

Another streaming AI hook (`src/hooks/useAccountAI.ts`) works correctly because it properly gets the session token:

```typescript
// Working pattern from useAccountAI.ts (lines 25-38)
const { data: sessionData } = await supabase.auth.getSession();
const token = sessionData?.session?.access_token;

if (!token) {
  throw new Error('Not authenticated');
}

const response = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`,  // User's session token
  },
});
```

## Solution

Update `src/hooks/use-ai-chat.tsx` to:

1. Get the user's session token before making the request
2. Handle the case where the user is not authenticated
3. Use the dynamic session token instead of the hardcoded anon key

## Technical Changes

### File: `src/hooks/use-ai-chat.tsx`

**Before (lines 377-402):**
```typescript
try {
  const enhancedContext = {
    ...options.context,
    ...
  };

  const CHAT_URL = `https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/ai-chat`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer eyJhbGciOi...`, // Hardcoded anon key
    },
    body: JSON.stringify({ ... }),
    signal: controller.signal,
  });
```

**After:**
```typescript
try {
  // Get user's session token for authentication
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  
  if (!token) {
    toast.error('Please log in to use the AI assistant');
    setIsLoading(false);
    return;
  }

  const enhancedContext = {
    ...options.context,
    ...
  };

  const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,  // Use session token
    },
    body: JSON.stringify({ ... }),
    signal: controller.signal,
  });
```

## Additional Improvements

1. **Use environment variable for URL**: Replace hardcoded Supabase URL with `import.meta.env.VITE_SUPABASE_URL`
2. **Better error handling**: Show specific error message when not authenticated
3. **Follow existing pattern**: Match the working pattern from `useAccountAI.ts`

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/use-ai-chat.tsx` | Get session token before fetch, use dynamic URL, update Authorization header |

## Expected Outcome

After this fix:
- AI chat will authenticate properly with the user's session
- The edge function will successfully look up the user's org_id
- AI responses will stream correctly to the chat interface
