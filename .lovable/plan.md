
# Fix AI Memory Race Condition - Auth Not Ready on Mount

## Problem Analysis

After deploying the JWT validation fixes, 401 errors are still occurring intermittently. Investigation reveals:

- **Timestamp analysis**: The original errors (8:30 PM) were before deployment, but new 401s are happening after (8:43 PM)
- **Log evidence**: `"[ai-chat] Auth failed: Missing authorization header"` - the frontend isn't sending the auth token
- **Root cause**: The `useAIMemory` hook calls the edge function immediately on component mount, before the Supabase auth session is initialized

The race condition occurs because:
```typescript
// In use-ai-memory.tsx, lines 61-64
useEffect(() => {
  loadPreferences();  // Calls edge function IMMEDIATELY
  loadTemplates();    // Auth session may not be ready yet!
}, []);
```

## Solution

Update `useAIMemory` to wait for authentication before making API calls.

### File: `src/hooks/use-ai-memory.tsx`

**Changes:**

1. Import `useAuth` hook to get current auth state
2. Only call edge functions when user is authenticated
3. Add the `user` dependency to the useEffect

**Current code (lines 60-64):**
```typescript
// Load preferences on mount
useEffect(() => {
  loadPreferences();
  loadTemplates();
}, []);
```

**New code:**
```typescript
import { useAuth } from '@/hooks/use-auth';

// Inside useAIMemory function:
const { user, loading: authLoading } = useAuth();

// Load preferences only when authenticated
useEffect(() => {
  if (user && !authLoading) {
    loadPreferences();
    loadTemplates();
  }
}, [user, authLoading, loadPreferences, loadTemplates]);
```

**Also update `callMemoryFunction` to check auth:**
```typescript
const callMemoryFunction = useCallback(async (action: string, params: Record<string, any> = {}) => {
  // Get fresh session token
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    console.warn('[ai-memory] No auth session available');
    return { error: 'Not authenticated' };
  }

  const { data, error } = await supabase.functions.invoke('ai-memory', {
    body: { action, ...params },
  });

  if (error) throw error;
  return data;
}, []);
```

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/use-ai-memory.tsx` | Add auth check before API calls |

## Why This Works

- **Prevents race condition**: API calls only happen after auth is confirmed
- **Uses existing pattern**: Leverages the `useAuth` hook already in the codebase
- **Graceful degradation**: If not authenticated, the hook simply doesn't load data (no errors)

## Expected Outcome

After this fix:
- No more 401 errors on page load
- AI memory loads successfully once user is authenticated
- AI chatbot works reliably when selected

## Testing

1. Open the AI chatbot immediately after page load
2. Verify no 401 errors in console or edge function logs
3. Confirm preferences and templates load after a moment (once auth is ready)
