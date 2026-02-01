

# Website Animation Enhancement Plan

## Overview

Add professional scroll-triggered animations and floating effects across all marketing pages to create a more dynamic, engaging experience. This includes fade-in animations on scroll, floating images, staggered element reveals, and subtle parallax effects.

---

## Current State

The codebase already has animation foundations:
- `animate-fade-in` (opacity + translateY)
- `animate-float` (continuous floating motion)
- `animate-float-delayed` (offset floating)
- `animate-scale-in` (scale + opacity)

**What's missing**: Scroll-triggered animations (elements only animate when they enter viewport)

---

## Implementation Approach

### Phase 1: Create Scroll Animation Infrastructure

**Create a reusable animation component: `src/components/ui/ScrollReveal.tsx`**

A wrapper component that uses Intersection Observer to trigger animations when elements scroll into view:
- Supports multiple animation types: fade-up, fade-down, fade-left, fade-right, scale, blur
- Configurable delay for staggered effects
- Configurable threshold for when animation triggers
- Once-only animation (doesn't re-animate on scroll back)

### Phase 2: Add New Keyframe Animations

**Update `tailwind.config.ts`** with additional animations:
- `slide-up` - slide from bottom with fade
- `slide-down` - slide from top with fade  
- `slide-left` - slide from right with fade
- `slide-right` - slide from left with fade
- `blur-in` - blur to clear with fade
- `float-gentle` - subtle continuous float for images

### Phase 3: Apply Animations to Marketing Pages

#### Landing Page (`Landing.tsx`)
| Element | Animation |
|---------|-----------|
| Hero headline | Staggered fade-up (already exists) |
| Dashboard mockup | Scale-in on load |
| Floating TAM/ICP graphics | Continuous gentle float |
| Pain points section heading | Fade-up on scroll |
| Pain point cards | Staggered slide-right |
| ICP/Revenue images | Float animation + fade-in on scroll |
| Feature cards | Staggered fade-up on scroll |
| CTA section content | Fade-up on scroll |

#### Product Page (`Product.tsx`)
| Element | Animation |
|---------|-----------|
| Feature cards (4 core capabilities) | Staggered fade-up |
| Enrichment comparison table | Slide-left |
| Use case cards (RevOps, Sales, Executives) | Staggered scale-in |
| CTA section | Fade-up |

#### About Page (`About.tsx`)
| Element | Animation |
|---------|-----------|
| Differentiator cards | Staggered fade-up |
| Green CTA banner | Scale-in |
| Floating ICP/TAM images on banner | Continuous float |

#### Pricing Page (`Pricing.tsx`)
| Element | Animation |
|---------|-----------|
| Platform plan cards | Staggered fade-up |
| Credit pack cards | Staggered fade-up |
| Feature comparison table rows | Staggered fade-in |
| FAQ accordion items | Staggered slide-up |
| CTA section | Fade-up |

#### Contact Page (`Contact.tsx`)
| Element | Animation |
|---------|-----------|
| Contact info section | Fade-left |
| Form card | Fade-right |
| "What happens next" steps | Staggered slide-up |

### Phase 4: Enhanced Floating Images

**Update `HeroDashboardMockup.tsx`**:
- Add gentle continuous floating to TAM and ICP indicator images
- Stagger the float timing for visual interest

**Landing page pain points section images**:
- Add float animation to ICP chart and Revenue stats

---

## Technical Details

### ScrollReveal Component Props
```typescript
interface ScrollRevealProps {
  children: React.ReactNode;
  animation?: 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right' | 'scale' | 'blur';
  delay?: number; // seconds
  duration?: number; // seconds  
  threshold?: number; // 0-1, when to trigger
  className?: string;
}
```

### New Tailwind Keyframes
```javascript
// Slide animations with opacity
'slide-up': {
  '0%': { opacity: '0', transform: 'translateY(40px)' },
  '100%': { opacity: '1', transform: 'translateY(0)' }
},
'slide-down': {
  '0%': { opacity: '0', transform: 'translateY(-40px)' },
  '100%': { opacity: '1', transform: 'translateY(0)' }
},
'slide-left': {
  '0%': { opacity: '0', transform: 'translateX(40px)' },
  '100%': { opacity: '1', transform: 'translateX(0)' }
},
'slide-right': {
  '0%': { opacity: '0', transform: 'translateX(-40px)' },
  '100%': { opacity: '1', transform: 'translateX(0)' }
},
// Blur reveal
'blur-in': {
  '0%': { opacity: '0', filter: 'blur(10px)' },
  '100%': { opacity: '1', filter: 'blur(0)' }
},
// Gentle float (less movement than current)
'float-gentle': {
  '0%, 100%': { transform: 'translateY(0px)' },
  '50%': { transform: 'translateY(-10px)' }
}
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/ui/ScrollReveal.tsx` | Create |
| `tailwind.config.ts` | Add new keyframes/animations |
| `src/pages/Landing.tsx` | Add ScrollReveal wrappers, float classes |
| `src/pages/Product.tsx` | Add ScrollReveal wrappers |
| `src/pages/About.tsx` | Add ScrollReveal wrappers, float classes |
| `src/pages/Pricing.tsx` | Add ScrollReveal wrappers |
| `src/pages/Contact.tsx` | Add ScrollReveal wrappers |
| `src/components/marketing/HeroDashboardMockup.tsx` | Add float classes |
| `src/components/marketing/index.ts` | Export ScrollReveal (optional) |

---

## Expected Outcome

- Professional scroll-triggered animations that reveal content as users scroll
- Floating dashboard graphics that add depth and movement
- Staggered reveals that guide the eye through content
- Performance-optimized using Intersection Observer (not scroll listeners)
- Respects reduced-motion preferences for accessibility

