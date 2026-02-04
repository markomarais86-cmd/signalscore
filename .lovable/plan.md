

# Optimize Hero Text Sizing for Mobile Readability

## Current State

The hero section has these text sizing issues on mobile (390px):

| Element | Current Mobile Size | Issue |
|---------|---------------------|-------|
| Headline (h1) | `text-4xl` (36px) | Too large for 3-line headline, causes awkward wrapping |
| Subheadline | `text-lg` (18px) | Acceptable but could be slightly smaller on tiny screens |
| Section padding | `pt-24` (96px) | Pushes content down, less room for headline |

## Proposed Changes

### 1. Reduce headline size on mobile

**File: `src/components/marketing/MarketingHero.tsx`**

Change the headline sizing from:
```tsx
className="text-4xl sm:text-5xl md:text-7xl ..."
```

To:
```tsx
className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl ..."
```

This creates a smoother scale:
- Mobile (< 640px): 30px (text-3xl)
- Small tablets (640px+): 36px (text-4xl)  
- Medium tablets (768px+): 48px (text-5xl)
- Desktop (1024px+): 72px (text-7xl)

### 2. Optimize subheadline for small screens

Change from:
```tsx
className="text-lg md:text-xl ..."
```

To:
```tsx
className="text-base sm:text-lg md:text-xl ..."
```

This gives slightly more breathing room on the smallest screens (16px vs 18px).

### 3. Reduce top padding on mobile

Change from:
```tsx
className="container mx-auto px-6 pt-24 pb-20 ..."
```

To:
```tsx
className="container mx-auto px-6 pt-16 sm:pt-20 md:pt-24 pb-16 sm:pb-20 ..."
```

This reclaims vertical space on mobile so the headline doesn't feel cramped.

### 4. Tighten line height on mobile headline

Add `leading-tight` to the headline for better mobile density:
```tsx
className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold font-heading mb-6 leading-tight animate-fade-in"
```

## Visual Result

| Screen | Before | After |
|--------|--------|-------|
| Mobile (390px) | Large 36px headline, cramped | Comfortable 30px, better spacing |
| Tablet (768px) | 72px headline (too big) | 48px headline (balanced) |
| Desktop (1024px+) | 72px headline | Same 72px headline |

## Files to Modify

- `src/components/marketing/MarketingHero.tsx` (all changes in one file)

