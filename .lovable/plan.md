
# Fix Light Mode Background in Authenticated App

## The Problem

The authenticated dashboard (Layout) uses the `GradientBackground` component which was designed for marketing pages. This component applies `bg-black` in dark mode and `bg-white` in light mode, but the visual result shows a dark background even when the sidebar is in light mode.

The issue is that `GradientBackground` is inappropriate for the authenticated app - it's designed for marketing pages with a specific dark aesthetic.

---

## The Solution

Remove `GradientBackground` from the authenticated Layout and use the standard theme-aware background color (`bg-background`) instead. This will ensure the app respects the user's light/dark mode preference correctly.

---

## Changes Required

### File: `src/components/Layout.tsx`

**Current code (lines 23-68):**
```tsx
return (
  <SidebarProvider>
    <GradientBackground variant="hero" showOrbs={true} className="!min-h-screen">
      <div className="min-h-screen flex w-full">
        {/* ... content ... */}
      </div>
    </GradientBackground>
  </SidebarProvider>
);
```

**New code:**
```tsx
return (
  <SidebarProvider>
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <main className="flex-1 flex flex-col">
        {/* ... existing content unchanged ... */}
      </main>
      <AIChat />
      <GlobalCommandPalette />
      <CampaignBuilderV2 ... />
    </div>
  </SidebarProvider>
);
```

**Key changes:**
1. Remove the `GradientBackground` wrapper component
2. Remove the import for `GradientBackground`
3. Add `bg-background` to the main container div - this uses the theme-aware CSS variable that's white in light mode and black in dark mode

---

## Visual Result

| Mode | Before | After |
|------|--------|-------|
| Light | Black background (incorrect) | White background (correct) |
| Dark | Black background | Black background |

The sidebar and main content area will now both respect the user's theme preference correctly.

---

## Technical Note

The `bg-background` class uses the CSS variable `--background` defined in `index.css`:
- Light mode: `--background: 0 0% 100%` (white)
- Dark mode: `--background: 0 0% 0%` (black)

This is the standard Tailwind/shadcn approach for theme-aware backgrounds.
