
# Replace External Logo with Local BrandLogo Component

## The Issue

The marketing navigation bar currently uses an external CDN image for the logo that may not be loading:
```tsx
<img 
  src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/69497386bcff6817bd62fe29_light-01.svg" 
  alt="LaunchPulse" 
  className="h-8"
/>
```

## The Solution

Replace the external image with the existing `BrandLogo` component that's already used throughout the app. This component:
- Contains the LaunchPulse SVG mark (geometric icon)
- Shows "LaunchPulse" text with proper styling
- Works reliably without external dependencies

## Changes Required

### File: `src/components/marketing/MarketingNav.tsx`

1. Import the `BrandLogo` component
2. Replace the external `<img>` tag with `<BrandLogo>`
3. Use the "dark" variant for the black navbar background

```tsx
// Add import
import { BrandLogo } from "@/components/BrandLogo";

// Replace the img tag (line 24-29) with:
<Link to="/landing">
  <BrandLogo variant="dark" collapsed={false} />
</Link>
```

## Visual Result

Before: External image that may fail to load
After: Local SVG logo with "LaunchPulse" text in primary green + white

The sticky behavior is already working (`sticky top-0 z-50`), so the logo will stay visible as you scroll once this fix is applied.

---

## Technical Note

The `BrandLogo` component uses:
- `LaunchPulseMark`: SVG icon in primary color
- Text: "Launch" (primary) + "Pulse" (white for dark variant)
- The `variant="dark"` prop ensures text is visible on black backgrounds
