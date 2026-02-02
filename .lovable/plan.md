
# Fix Authentication Race Conditions & Page Refresh Issues

## Problem Analysis

Based on my investigation of the codebase, I've identified **two root causes** for the issues you're experiencing:

### Issue 1: Data Disappears and Reappears on Dashboard

**Root Cause**: Race condition between `initAuth()` and `onAuthStateChange` in `use-auth.tsx`

The current flow has a critical timing issue:
1. `initAuth()` runs and sets `loading = false` at line 203
2. `onAuthStateChange` fires AFTER this and also tries to set loading state
3. During this gap, `user` can briefly be `null` while profile is still loading
4. This causes `ProtectedRoute` to show skeleton → content → skeleton → content

**Code Evidence** (use-auth.tsx lines 170-203):
```typescript
// initAuth sets loading=false BEFORE onAuthStateChange might fire
const initAuth = async () => {
  // ... gets session
  setLoading(false);  // ← Sets loading false too early
};
```

### Issue 2: Page Refresh Redirects to Landing Page

**Root Cause**: `ProtectedRoute` checks `!user` before auth initialization completes

The current check at line 46:
```typescript
if (!user) {
  return <Navigate to="/landing" ... />;
}
```

This fires BEFORE `getSession()` has a chance to restore the session from localStorage, causing an immediate redirect.

---

## Solution Overview

Implement a **separate initial load phase** that distinguishes between:
- **Initial Auth Load**: Wait for session restoration + profile fetch
- **Ongoing Auth Changes**: Handle sign-in/out events without blocking UI

This follows the proven pattern from the Stack Overflow solution in the context.

---

## Implementation Details

### File 1: `src/hooks/use-auth.tsx`

**Changes:**
1. Add `initialLoadComplete` state to track first-time auth resolution
2. Only set `loading = false` AFTER both session AND profile are resolved
3. Keep `onAuthStateChange` for ongoing updates but don't let it control loading
4. Remove duplicate profile fetch in `initAuth()` - let `onAuthStateChange` handle it

**Key Logic Change:**
```typescript
// NEW: Track if initial load is complete
const [initialLoadComplete, setInitialLoadComplete] = useState(false);

useEffect(() => {
  let mounted = true;
  
  // Setup listener FIRST (for ongoing changes)
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      // Only handle ongoing changes if initial load is complete
      if (!initialLoadComplete && event !== 'INITIAL_SESSION') return;
      
      setSession(session);
      setUser(session?.user ?? null);
      // ... rest of handler
    }
  );

  // THEN do initial load
  const initializeAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      // Fetch profile BEFORE setting loading false
      if (session?.user) {
        await fetchAndCacheProfile(session.user.id);
      }
    } finally {
      if (mounted) {
        setInitialLoadComplete(true);
        setLoading(false);  // Only now is it safe
      }
    }
  };
  
  initializeAuth();
  return () => { mounted = false; subscription.unsubscribe(); };
}, []);
```

### File 2: `src/components/ProtectedRoute.tsx`

**Changes:**
1. Wait for `loading` to be false AND initial auth to complete before redirecting
2. Add explicit check for auth initialization state

**Updated Logic:**
```typescript
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, userProfile, loading } = useAuth();
  
  // Show skeleton while auth is initializing
  if (loading) {
    return <DashboardSkeleton />;
  }

  // Only redirect AFTER loading is complete and we know there's no user
  if (!user) {
    return <Navigate to="/landing" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
```

The key fix is removing the `loading && user === undefined` condition that was causing the race.

---

## Visual Flow Comparison

### Before (Broken)

```
Page Refresh
    │
    ▼
ProtectedRoute checks user
    │
    ▼
user = null (session not restored yet)
    │
    ▼
REDIRECT TO /landing ❌
```

### After (Fixed)

```
Page Refresh
    │
    ▼
ProtectedRoute checks loading
    │
    ▼
loading = true → Show Skeleton
    │
    ▼
getSession() restores session
    │
    ▼
fetchProfile() completes
    │
    ▼
loading = false, user = {...}
    │
    ▼
RENDER DASHBOARD ✓
```

---

## Additional Improvements

### Realtime Listener Debouncing
The `useDataChangeListener` hook already has good debouncing (30s between triggers), but I'll verify it's not causing extra re-renders by ensuring the dashboard's `refetch()` calls are properly throttled.

### Profile Cache Alignment
Ensure the cached profile is checked BEFORE any redirect logic runs by moving cache restoration earlier in the init flow.

---

## Files Changed

| File | Action |
|------|--------|
| `src/hooks/use-auth.tsx` | Update - Fix race condition with `initialLoadComplete` state |
| `src/components/ProtectedRoute.tsx` | Update - Simplify loading check to wait for full auth init |

---

## Testing Checklist

After implementation:
1. Refresh page while logged in → Should stay on current page
2. Navigate between tabs → Data should not flash/disappear
3. Wait on dashboard → No unexpected data reloads
4. Sign out → Should redirect to /landing
5. Sign in → Should redirect to dashboard
