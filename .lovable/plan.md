

## Overview

This plan fixes two visual issues to match the original launchpulse.org/about design:
1. Remove the full-page grid pattern (grid should only appear in hero area or be removed entirely)
2. Change card backgrounds from transparent to solid dark grey (#1F2227)

## Issues Identified

| Element | Original | Current (Wrong) |
|---------|----------|-----------------|
| Page background | Pure black, grid only in hero/top area | Grid pattern covers entire page |
| Card backgrounds | Solid dark grey (#1F2227) | Nearly transparent (bg-white/5) |
| Card top line | Subtle/dark gradient | Bright green gradient |

---

## Changes to Make

### 1. Remove Full-Page Grid Pattern

The `GradientBackground` component currently shows a white grid pattern across the entire page. The original launchpulse.org only has this grid visible in the hero section at the top, and it fades out. For a cleaner match, we should either:
- Option A: Remove the grid entirely (simplest)
- Option B: Add a gradient fade so it only shows at the top

Recommended: Remove the grid pattern from GradientBackground to match the cleaner look of the original outside the hero area.

### 2. Fix Card Backgrounds

Change from transparent to solid dark grey:
- Current: `bg-white/5 border-white/10`
- Fixed: `bg-[#1F2227] border-white/10`

### 3. Fix Card Decorative Line

Change from bright green to a subtle dark gradient matching the card:
- Current: `linear-gradient(90deg, transparent 0%, #3CF1AE 50%, transparent 100%)`
- Fixed: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)`

---

## Technical Details

### File 1: `src/components/ui/GradientBackground.tsx`

Remove the grid pattern overlay (lines 35-45):

```tsx
// BEFORE (lines 35-45):
{/* Grid Pattern Only - Matching original launchpulse.org */}
{isDark && (
  <div 
    className="absolute inset-0 pointer-events-none"
    style={{
      backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                       linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
      backgroundSize: '60px 60px'
    }}
  />
)}

// AFTER:
{/* Pure black background - no grid pattern outside hero */}
```

### File 2: `src/pages/About.tsx`

**Update card styling (line 92):**

```tsx
// BEFORE:
className="relative p-8 rounded-xl border border-white/10 bg-white/5 overflow-hidden animate-fade-in"

// AFTER:
className="relative p-8 rounded-xl border border-white/10 bg-[#1F2227] overflow-hidden animate-fade-in"
```

**Update card decorative line (lines 96-101):**

```tsx
// BEFORE:
<div 
  className="absolute top-0 left-0 right-0 h-[2px]"
  style={{ 
    background: 'linear-gradient(90deg, transparent 0%, #3CF1AE 50%, transparent 100%)' 
  }}
/>

// AFTER:
<div 
  className="absolute top-0 left-0 right-0 h-[1px]"
  style={{ 
    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)' 
  }}
/>
```

---

## Visual Result

After these changes:
- Page will have a clean pure black background without distracting grid lines
- Cards will have solid dark grey backgrounds (#1F2227) matching the original
- Card top decoration will be a subtle light grey line instead of bright green
- Overall appearance will match the original launchpulse.org design

