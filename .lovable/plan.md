
# Fix Floating Dashboard Elements on Mobile

## Problem

The TAM indicator and ICP donut chart are positioned with negative offsets (`-left-4`, `-right-4` on mobile) which causes them to extend outside the container boundaries. On mobile devices with `overflow-hidden` on parent elements, these get clipped.

## Solution

Reposition the floating elements so they stay within the visible area on mobile while maintaining the attractive overlapping effect on larger screens.

## Changes

**File: `src/components/marketing/HeroDashboardMockup.tsx`**

### 1. Add horizontal padding to container
Add padding to the container that creates space for the floating elements on mobile:
```tsx
className="relative max-w-5xl mx-auto px-8 md:px-0"
```

### 2. Adjust TAM indicator positioning
Change from negative to positive offset on mobile:
```tsx
// Before
className="absolute -left-4 md:-left-16 bottom-10 md:bottom-20 ..."

// After  
className="absolute left-0 md:-left-16 bottom-4 md:bottom-20 ..."
```

### 3. Adjust ICP chart positioning
Change from negative to positive offset on mobile:
```tsx
// Before
className="absolute -right-4 md:-right-16 top-10 md:top-20 ..."

// After
className="absolute right-0 md:-right-16 top-4 md:top-20 ..."
```

### 4. Reduce mobile sizes slightly (optional polish)
The current `w-28` and `w-24` can feel large on small screens. Consider:
```tsx
// TAM: w-24 sm:w-28 md:w-60
// ICP: w-20 sm:w-24 md:w-60
```

## Visual Result

| Screen | Before | After |
|--------|--------|-------|
| Mobile (390px) | Elements clipped on edges | Elements visible, tucked at edges |
| Tablet (768px+) | Elements extend outside | Same attractive overlap effect |

## Technical Notes

- The `md:` breakpoint (768px) maintains the desktop overlap effect
- Using `left-0` and `right-0` on mobile keeps elements flush with container edge
- The padding approach ensures no content is lost to overflow clipping
