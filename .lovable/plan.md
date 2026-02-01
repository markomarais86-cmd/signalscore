
## Overview

The Pricing page cards are already using `bg-[#1F2227]` (solid dark grey), which matches the About and Product pages. However, the **Landing page** uses a different style (`bg-white/5` - transparent) for its feature cards.

## Current State

| Page | Card Background |
|------|-----------------|
| Landing (FeatureCard) | `bg-white/5` (transparent/lighter) |
| About | `bg-[#1F2227]` (solid dark grey) |
| Product | `bg-[#1F2227]` (solid dark grey) |
| Pricing | `bg-[#1F2227]` (solid dark grey) |

## Solution

Update the **FeatureCard** component used on the Landing page to use the same `bg-[#1F2227]` background as the rest of the marketing pages, ensuring visual consistency across the entire website.

---

## Technical Details

### File: `src/components/marketing/FeatureCard.tsx`

**Update card background (line 19):**

```tsx
// BEFORE:
className="p-6 rounded-xl border border-white/10 bg-white/5 animate-fade-in"

// AFTER:
className="p-6 rounded-xl border border-white/10 bg-[#1F2227] animate-fade-in"
```

---

## Visual Result

After this change, all marketing page cards will use the same solid dark grey (`#1F2227`) background:
- Landing page ✓
- About page ✓
- Product page ✓
- Pricing page ✓

This matches the brand style guide which specifies Dark Grey (#1F2227) for cards.
