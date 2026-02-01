
# Fix React Error #310 - Hook Ordering Issue

## Problem Identified

The error "Rendered more hooks than during the previous render" (React error #310) occurs in `ResetPassword.tsx` because the `useActionState` hook is called **after** conditional early returns.

### Current Code Flow (Broken)

```text
Line 18-23:  useState hooks (3 hooks)
Line 25-82:  useEffect hook
Line 85-87:  if (user && !isPasswordRecovery) → EARLY RETURN ❌
Line 90-98:  if (checkingSession) → EARLY RETURN ❌
Line 101-143: if (noSession) → EARLY RETURN ❌
Line 189:    useActionState hook ← Only called if ALL above conditions are false
```

When a user is logged in, the component returns at line 85-87, and `useActionState` never gets called. But when the state changes (e.g., `isPasswordRecovery` becomes true), the early return is skipped and `useActionState` is called - causing the hooks count to differ between renders.

### React Rules of Hooks

Hooks must be called:
- At the top level of the component
- In the same order on every render
- Never inside conditions, loops, or early returns

## Solution

Move the `useActionState` hook declaration to the top of the component, **before** all conditional early returns.

### File: `src/pages/ResetPassword.tsx`

**Move this line:**
```typescript
// FROM Line 189 (after conditional returns)
const [state, formAction, isPending] = useActionState(resetAction, initialFormState);
```

**TO right after the other hooks (around line 24):**
```typescript
const { user } = useAuth();
const navigate = useNavigate();
const { toast } = useToast();
const [noSession, setNoSession] = useState(false);
const [checkingSession, setCheckingSession] = useState(true);
const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

// Move useActionState here - before any conditional returns
const [state, formAction, isPending] = useActionState(resetAction, initialFormState);
```

However, there's a complication: `resetAction` is defined **after** the early returns. We need to also move `resetAction` definition before its usage.

### Complete Fix

1. Define `resetAction` as a callback function before the hook call
2. Move `useActionState` to the top of the component with other hooks
3. Keep the early returns as they are (they only affect rendering, not hook calls)

### Updated Code Structure

```typescript
export default function ResetPassword() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [noSession, setNoSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  // Define the reset action (moved up)
  const resetAction = async (prevState: FormState, formData: FormData): Promise<FormState> => {
    // ... action implementation
  };

  // All hooks declared before any returns
  const [state, formAction, isPending] = useActionState(resetAction, initialFormState);

  useEffect(() => {
    // ... auth state listener
  }, []);

  // NOW conditional early returns are safe
  if (user && !isPasswordRecovery) {
    return <Navigate to="/" replace />;
  }

  if (checkingSession) {
    return <Loader />;
  }

  if (noSession) {
    return <NoSessionView />;
  }

  // Main form render
  return <ResetForm />;
}
```

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/ResetPassword.tsx` | Move `resetAction` and `useActionState` before conditional returns |

## Why This Fixes the Issue

- Hooks are always called in the same order on every render
- Early returns only affect what JSX is rendered, not hook execution
- React can track hooks properly because the count never changes
