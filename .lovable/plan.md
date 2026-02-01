

## Overview

This plan removes the pixelated background image from the "LaunchPulse Difference" cards and replaces it with a clean, solid dark background to match the original launchpulse.org design.

## Issue Identified

The cards currently use an external PNG background image (`about-card-2.png`) that renders as a pixelated/checkered pattern. The original site has clean, solid dark cards with no pattern.

## What We're Changing

Remove the external background image and add a subtle solid background color to match the original design.

---

## Technical Details

### File to Modify: `src/pages/About.tsx`

**1. Remove the background image (lines 95-99)**

Delete these lines:
```tsx
<img 
  src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/696a4cf6a9a77e800b6242c1_about-card-2.png"
  alt=""
  className="absolute inset-0 w-full h-full object-cover opacity-30"
/>
```

**2. Add a solid background color to the card container**

Update the card div (line 92) to include a dark background:
```tsx
className="relative p-8 rounded-xl border border-white/10 bg-white/5 overflow-hidden animate-fade-in"
```

**3. Simplify the content wrapper**

Since there's no longer a background image to layer above, we can keep the `relative z-10` for consistency but it's now cleaner.

---

## Visual Result

After these changes:
- Clean, solid dark cards matching the original launchpulse.org design
- No pixelated/checkered background pattern
- Subtle `bg-white/5` provides a gentle contrast from the page background
- Eliminates external image dependency and improves load time

