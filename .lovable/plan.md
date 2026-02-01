
# Fix AI Chat Connection Error - Improved Error Handling

## Problem Analysis

The user sees "Failed to connect to AI assistant. Please try again" when using the AI Chat. Based on my investigation:

### Current State
1. **Authentication fix was applied** - `use-ai-chat.tsx` correctly retrieves the session token using `supabase.auth.getSession()`
2. **Edge function is deployed** - `ai-chat` function is deployed and returns 401 for unauthorized requests (expected)
3. **CORS works** - OPTIONS preflight requests return 204

### Possible Causes
The generic error message hides the actual cause. Possible scenarios:
- **Not logged in**: Token check should show "Please log in" toast
- **401 Unauthorized**: Session token is invalid/expired  
- **500 Server Error**: Edge function crash
- **Network failure**: Connection issues
- **Edge function timeout**: Takes too long to respond

## Solution

Improve error handling in `src/hooks/use-ai-chat.tsx` to:

1. **Log the actual error** for debugging
2. **Show specific error messages** based on error type
3. **Include the HTTP status code** in the error for non-ok responses
4. **Handle edge cases** like network failures vs. server errors

## Technical Changes

### File: `src/hooks/use-ai-chat.tsx`

**Change 1: Better response error handling (lines 416-427)**

Current code only parses specific status codes (429, 402). Enhance to:
- Log the full response for debugging
- Show the actual error message from the server if available
- Include status code in error message for unexpected errors

```typescript
if (!resp.ok) {
  const errorText = await resp.text();
  console.error(`[AI Chat] Error ${resp.status}:`, errorText);
  
  let errorData: any = {};
  try {
    errorData = JSON.parse(errorText);
  } catch {}
  
  if (resp.status === 429) {
    toast.error('Rate limit exceeded. Please wait a moment.');
  } else if (resp.status === 402) {
    toast.error('AI credits exhausted. Please contact support.');
  } else if (resp.status === 401) {
    toast.error('Session expired. Please log in again.');
  } else if (resp.status === 500) {
    toast.error('AI service error. Please try again in a moment.');
  } else {
    toast.error(errorData.error || `Request failed (${resp.status})`);
  }
  setIsLoading(false);
  return;
}
```

**Change 2: Better catch block error handling (lines 500-509)**

Add more context to error logging:
```typescript
} catch (error) {
  cleanup();
  
  // Enhanced error logging
  console.error('[AI Chat] Request failed:', {
    error,
    errorMessage: error instanceof Error ? error.message : 'Unknown error',
    errorName: error instanceof Error ? error.name : 'Unknown',
  });
  
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      toast.error('Request timed out. Please try again.');
    } else if (error.message.includes('Failed to fetch')) {
      toast.error('Network error. Check your connection and try again.');
    } else {
      toast.error(`AI error: ${error.message}`);
    }
  } else {
    toast.error('Failed to connect to AI assistant. Please try again.');
  }
```

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/use-ai-chat.tsx` | Improve error handling with specific error messages and better logging |

## Expected Outcome

After this fix:
- Users will see more specific error messages (e.g., "Session expired" instead of generic "Failed to connect")
- Console logs will show the actual error for debugging
- Network failures will be identified separately from server errors
- The root cause of the issue will be visible in the browser console

## Debugging Next Steps

Once deployed, if the error persists:
1. Check browser console for the `[AI Chat]` log entries
2. The logged error will show whether it's a network issue, auth issue, or server error
3. This information will help identify the exact problem
