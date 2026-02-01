

## Overview

This plan brings the About page closer to the original launchpulse.org design by fixing three key visual differences the user identified.

## Issues Identified

Based on comparing your screenshots with the original:

| Element | Original | Current Issue |
|---------|----------|---------------|
| Card decorations | Green gradient horizontal lines at top of each card | Missing entirely |
| Section title | "The LaunchPulse Difference" - all white text | "LaunchPulse" is green |
| "Built by GTM Operators" | Has specific styling | Needs verification |
| Bottom CTA images | Color-coded properly | May need adjustment |

---

## Changes to Make

### 1. Add Decorative Green Gradient Lines to Cards

Add a gradient line decoration at the top of each differentiator card matching the original:

```tsx
{/* Decorative gradient line at top of card */}
<div 
  className="absolute top-0 left-0 right-0 h-[2px]"
  style={{ 
    background: 'linear-gradient(90deg, transparent 0%, #3CF1AE 50%, transparent 100%)' 
  }}
/>
```

### 2. Fix Section Title Color

Change from:
```tsx
<h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
  The <span className="text-primary">LaunchPulse</span> Difference
</h2>
```

To match original (all white):
```tsx
<h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
  The LaunchPulse Difference
</h2>
```

### 3. Remove "Built by GTM Operators" Section

The original launchpulse.org/about page does NOT have a "Built by GTM Operators" section with paragraphs of text. This section should be removed to match the original.

### 4. Update Bottom CTA Section

The original has:
- Text: "A precise, explainable GTM intelligence layer" (italic)
- Different subtext about "persona coverage visibility"
- Images positioned correctly with proper opacity

---

## Technical Details

### File to Modify: `src/pages/About.tsx`

**1. Add gradient line to cards (update the card div around line 90-107):**

```tsx
<div
  key={index}
  className="relative p-8 rounded-xl border border-white/10 bg-white/5 overflow-hidden animate-fade-in"
  style={{ animationDelay: `${0.1 * index}s` }}
>
  {/* Decorative gradient line at top */}
  <div 
    className="absolute top-0 left-0 right-0 h-[2px]"
    style={{ 
      background: 'linear-gradient(90deg, transparent 0%, #3CF1AE 50%, transparent 100%)' 
    }}
  />
  <div className="relative z-10">
    {/* ... rest of card content ... */}
  </div>
</div>
```

**2. Fix section title (update line 78-80):**

```tsx
<h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
  The LaunchPulse Difference
</h2>
```

**3. Remove "Built by GTM Operators" section (delete lines 112-136):**

Remove the entire "Our Story Section" that contains "Built by GTM Operators" and the three paragraphs, as this does not exist on the original site.

**4. Update CTA subtext (update line 163-164):**

```tsx
<p className="text-lg text-black/70 mb-8">
  If you want targeting clarity, persona coverage visibility, and a practical path to fixing data-driven pipeline leakage, request a demo.
</p>
```

---

## Visual Result

After these changes:
- Each differentiator card will have a subtle green gradient line at the top
- "The LaunchPulse Difference" heading will be all white (matching original)
- Page structure will match original without the extra "Built by" section
- CTA text will match original wording

