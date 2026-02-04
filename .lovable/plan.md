
# Fix: LaunchPulse Logo Text Invisible on Mobile (and Desktop Dark Mode)

## Problem

The "Pulse" portion of the logo is invisible on the marketing site because of a color logic bug. The logo shows "Launch" in green/teal, but "Pulse" appears as black text on a black background.

## Root Cause

In `BrandLogo.tsx`, when `variant="dark"` is passed (indicating the logo is on a dark background), the code incorrectly applies `text-background` to the "Pulse" text.

In your theme:
- `--background` = pure black (#000000)
- `--foreground` = white

So `text-background` renders as **black text on the black marketing header** = invisible.

## Solution

Swap the color logic so that:
- `variant="light"` (light backgrounds) → use dark text colors
- `variant="dark"` (dark backgrounds) → use light text colors

## Code Change

**File:** `src/components/BrandLogo.tsx`

**Before (lines 65-76):**
```tsx
<div className={cn(
  "text-2xl font-bold font-heading tracking-tight",
  variant === "light" ? "text-foreground" : "text-background"
)}>
  <span className={cn(
    "font-heading font-semibold",
    variant === "light" ? "text-primary" : "text-primary"
  )}>Launch</span>
  <span className={cn(
    variant === "light" ? "text-foreground" : "text-background"
  )}>Pulse</span>
</div>
```

**After:**
```tsx
<div className={cn(
  "text-2xl font-bold font-heading tracking-tight",
  variant === "light" ? "text-foreground" : "text-foreground"
)}>
  <span className={cn(
    "font-heading font-semibold",
    "text-primary"
  )}>Launch</span>
  <span className={cn(
    variant === "light" ? "text-foreground" : "text-white"
  )}>Pulse</span>
</div>
```

The key fix is changing `text-background` to `text-white` for the dark variant, ensuring "Pulse" is visible on the black marketing header.

## Visual Result

| Before | After |
|--------|-------|
| Logo shows: **Launch** | Logo shows: **LaunchPulse** |
| "Pulse" = black on black | "Pulse" = white on black |

## Verification

After the fix, verify on:
- Mobile marketing homepage header
- Desktop marketing homepage header  
- Dashboard sidebar (should still work correctly in light mode)
