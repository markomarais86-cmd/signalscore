
# Website Improvement Plan (No Blog/Testimonials/Pricing Changes)

## Overview
Focused improvements to technical quality, accessibility, performance, and code organization - keeping your existing "14,000+ Accounts Scored" social proof stat.

---

## 1. Accessibility Fixes

### Password Toggle Buttons - Missing ARIA Labels
**File:** `src/components/AuthSystem.tsx`
**Issue:** Password visibility toggle buttons lack accessible labels for screen readers

**Current (lines 296-302):**
```tsx
<button
  type="button"
  onClick={() => setShowPassword(!showPassword)}
  className="absolute right-3 top-3..."
>
  {showPassword ? <EyeOff /> : <Eye />}
</button>
```

**Fix:** Add `aria-label` attribute:
```tsx
<button
  type="button"
  onClick={() => setShowPassword(!showPassword)}
  className="absolute right-3 top-3..."
  aria-label={showPassword ? 'Hide password' : 'Show password'}
>
```

### Business Man Image - Missing Alt Text
**File:** `src/pages/Pricing.tsx` (line 484-486)
**Issue:** Key CTA section image has empty alt text

**Current:**
```tsx
<img src="/images/Business_Man.webp" alt="" ... />
```

**Fix:**
```tsx
<img 
  src="/images/Business_Man.webp" 
  alt="Business professional reviewing GTM analytics dashboard" 
  ...
/>
```

---

## 2. SEO Fixes

### NotFound Page - Missing SEOHead
**File:** `src/pages/NotFound.tsx`
**Issue:** 404 page lacks proper meta tags

**Fix:** Add SEOHead component:
```tsx
import { SEOHead } from "@/components/SEOHead";

// Inside component:
<SEOHead
  title="Page Not Found - LaunchPulse"
  description="The page you're looking for doesn't exist or has been moved."
  canonicalPath="/404"
/>
```

### Pricing FAQ - Add Structured Data
**File:** `src/pages/Pricing.tsx`
**Issue:** FAQ section could enable rich snippets in Google search

**Fix:** Add JSON-LD FAQPage schema that dynamically generates from the existing `faqs` array:
```tsx
useEffect(() => {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
  // Inject into document head
}, []);
```

---

## 3. Technical Debt - Shared DiagonalArrow Component

### Current State
The `DiagonalArrow` SVG is duplicated in **6 files**:
- `src/pages/Landing.tsx`
- `src/pages/Product.tsx`
- `src/pages/Pricing.tsx`
- `src/pages/About.tsx`
- `src/components/marketing/MarketingNav.tsx`
- `src/components/marketing/MarketingHero.tsx`

### Solution
Create a single shared component:

**New file:** `src/components/ui/DiagonalArrow.tsx`
```tsx
export function DiagonalArrow({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="18" 
      height="18" 
      viewBox="0 0 18 18" 
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path 
        d="M4.38237 12.4016L10.5268 6.25717L5.7538 6.25717L5.7538 4.7574L13.0872 4.7574L13.0872 12.0908L11.5874 12.0908V7.31783L5.44303 13.4622L4.38237 12.4016Z" 
        fill="currentColor"
      />
    </svg>
  );
}
```

Then update all 6 files to import from the shared location.

---

## 4. Performance Optimizations

### Hero Image Preloading
**File:** `index.html`
**Issue:** Hero section images could load faster with preloading hints

**Fix:** Add preload link for critical above-the-fold image:
```html
<link rel="preload" as="image" href="/images/Business_Man.webp" fetchpriority="high" />
```

### Localize CDN Assets (Optional)
**Files:** `src/pages/Landing.tsx`, `src/pages/Product.tsx`
**Issue:** Some images load from external CDN (cdn.prod.website-files.com) which adds latency and external dependency

**Current:**
```tsx
src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/695055dccf22527a26df6e62_icp-01.svg"
```

**Recommendation:** Download and host locally in `/public/images/` for:
- Faster loading (same-origin)
- No external dependencies
- Better reliability

---

## Summary of Changes

| Category | File(s) | Change |
|----------|---------|--------|
| Accessibility | `AuthSystem.tsx` | Add ARIA labels to password toggles |
| Accessibility | `Pricing.tsx` | Add descriptive alt text to Business_Man.webp |
| SEO | `NotFound.tsx` | Add SEOHead component |
| SEO | `Pricing.tsx` | Add FAQPage JSON-LD structured data |
| Code Quality | Create `DiagonalArrow.tsx` | Shared component |
| Code Quality | 6 marketing files | Update imports to use shared component |
| Performance | `index.html` | Add image preload hints |

---

## Files to Create
1. `src/components/ui/DiagonalArrow.tsx`

## Files to Modify
1. `src/components/AuthSystem.tsx` - ARIA labels
2. `src/pages/NotFound.tsx` - SEOHead
3. `src/pages/Pricing.tsx` - Alt text + FAQ schema
4. `src/pages/Landing.tsx` - Import shared DiagonalArrow
5. `src/pages/Product.tsx` - Import shared DiagonalArrow
6. `src/pages/About.tsx` - Import shared DiagonalArrow
7. `src/components/marketing/MarketingNav.tsx` - Import shared DiagonalArrow
8. `src/components/marketing/MarketingHero.tsx` - Import shared DiagonalArrow
9. `index.html` - Add preload hint

---

## Expected Impact
- Better accessibility scores (WCAG compliance)
- Improved SEO with FAQ rich snippets in search results
- Cleaner codebase with no duplicate SVG definitions
- Faster page loads with preloaded critical images
