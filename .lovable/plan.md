
# Fix Marketing Navigation to Stay Fixed on Scroll

## The Problem

The marketing navigation bar has `sticky top-0` but it's not staying fixed when scrolling. This is because the parent `GradientBackground` component has `overflow-hidden`, which breaks sticky positioning behavior in CSS.

## The Solution

Change the navigation from `sticky` to `fixed` positioning, which works independently of parent overflow settings.

## Changes Required

### File: `src/components/marketing/MarketingNav.tsx`

**Current (line 22):**
```tsx
<header className="border-b border-white/10 bg-black sticky top-0 z-50">
```

**Change to:**
```tsx
<header className="border-b border-white/10 bg-black fixed top-0 left-0 right-0 z-50">
```

- `sticky` → `fixed` - Positions relative to viewport, not scroll container
- Added `left-0 right-0` - Ensures full-width coverage

### File: `src/components/marketing/MarketingNav.tsx`

**Add a spacer div after the header to prevent content from being hidden behind the fixed nav:**

```tsx
return (
  <>
    <header className="border-b border-white/10 bg-black fixed top-0 left-0 right-0 z-50">
      {/* ... existing nav content ... */}
    </header>
    {/* Spacer to account for fixed header height */}
    <div className="h-16" />
  </>
);
```

The `h-16` spacer matches the `h-16` height of the header, so content flows naturally below the fixed navigation.

## Result

The navigation bar will remain locked at the top of the screen on all marketing pages (Landing, About, Product, Pricing) as users scroll up and down. The logo, navigation links (Home, About, Product, Pricing), Sign In button, and Request Demo button will always be visible.

## Technical Note

- `fixed` positioning is relative to the viewport, ignoring parent `overflow` properties
- `sticky` positioning depends on scroll context and can be broken by ancestor `overflow` rules
- No changes needed to individual pages - the fix is contained within the shared nav component
