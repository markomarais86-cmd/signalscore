
# Fix Light Mode Background on Executive Dashboard

## The Problem

The Executive Dashboard (`/`) page has a hardcoded dark background that doesn't respect light mode. This is caused by the `hero-gradient` class applied directly to the dashboard component:

**In `src/pages/ExecutiveDashboard.tsx` (line 401):**
```tsx
<div className="w-full ... hero-gradient bg-grid-pattern min-h-screen ...">
```

**In `src/index.css` (lines 258-260):**
```css
.hero-gradient {
  @apply relative overflow-hidden;
  background: #000000; /* True black base - HARDCODED! */
}
```

The `hero-gradient` class forces `background: #000000` regardless of the active theme.

---

## The Solution

Remove the `hero-gradient` class from the Executive Dashboard and rely on the theme-aware `bg-background` that the parent `Layout` component now provides.

---

## Changes Required

### File: `src/pages/ExecutiveDashboard.tsx`

**Current (line 401):**
```tsx
<div className="w-full px-2 sm:px-4 lg:px-6 xl:px-8 space-y-6 lg:space-y-8 hero-gradient bg-grid-pattern min-h-screen pb-8">
```

**Change to:**
```tsx
<div className="w-full px-2 sm:px-4 lg:px-6 xl:px-8 space-y-6 lg:space-y-8 min-h-screen pb-8">
```

Simply remove `hero-gradient bg-grid-pattern` from the className - the Layout component already sets `bg-background` which correctly switches between white (light mode) and black (dark mode).

---

## Visual Result

| Mode | Before | After |
|------|--------|-------|
| Light | Black background (incorrect) | White background (correct) |
| Dark | Black background | Black background |

The Executive Dashboard will now properly switch between white and black backgrounds based on the user's theme preference, matching the sidebar and other components.

---

## Technical Note

- The `hero-gradient` class is designed for marketing pages with a fixed dark aesthetic
- Authenticated app pages should use `bg-background` for theme awareness
- The Layout wrapper already provides `bg-background`, so child pages don't need their own background classes
