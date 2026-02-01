

## Overview

The Product page cards use `bg-white/5` (nearly transparent) while the Pricing page cards use `bg-[#1F2227]` (solid dark grey). They should match.

## Issue

| Page | Card Background | Result |
|------|-----------------|--------|
| Product | `bg-white/5` | Nearly transparent, lighter |
| Pricing | `bg-[#1F2227]` | Solid dark grey |

## Solution

Update the **Product page** cards to use the same `bg-[#1F2227]` background as Pricing and About pages.

---

## Technical Details

### File: `src/pages/Product.tsx`

**1. Core Features cards (around line 138):**

```tsx
// BEFORE:
className="p-8 rounded-xl border border-white/10 bg-white/5 animate-fade-in"

// AFTER:
className="p-8 rounded-xl border border-white/10 bg-[#1F2227] animate-fade-in"
```

**2. Enrichment comparison card (around line 197):**

```tsx
// BEFORE:
className="p-6 rounded-xl border border-white/10 bg-white/5"

// AFTER:
className="p-6 rounded-xl border border-white/10 bg-[#1F2227]"
```

**3. Use Cases cards (around line 220):**

```tsx
// BEFORE:
className="p-8 rounded-xl border border-white/10 bg-white/5 text-center animate-fade-in hover:bg-white/[0.08] ..."

// AFTER:
className="p-8 rounded-xl border border-white/10 bg-[#1F2227] text-center animate-fade-in hover:bg-[#262a30] ..."
```

---

## Visual Result

After this change, all marketing page cards will have consistent solid dark grey (`#1F2227`) backgrounds matching the brand style guide.

