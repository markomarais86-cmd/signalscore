

# Fix: Blank Screen Caused by Function Hoisting Error

## Problem

The last edit placed `mapNextActionToLabel` and `mapNextActionToRoute` at line 448, but they are called at line 387 inside the `unifiedItems` computation. JavaScript `const` declarations are not hoisted, so the functions don't exist when they're first called. This causes a `ReferenceError` that crashes the entire component and produces a blank screen.

## Fix

Move `mapNextActionToLabel` and `mapNextActionToRoute` (lines 448-471) to **before** the `unifiedItems` computation (before line 355). No other changes needed -- the functions themselves are correct, they're just in the wrong position.

## File Changed

| File | Change |
|------|--------|
| `src/components/executive/UnifiedInsightsPanel.tsx` | Move `mapNextActionToLabel` and `mapNextActionToRoute` from lines 448-471 to before line 355 (before the `unifiedItems` array is built) |

