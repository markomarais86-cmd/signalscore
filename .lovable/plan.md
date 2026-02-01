

## Overview

This plan aligns the Pricing page styling with the rest of the marketing site (Landing, About, Product pages) by fixing card backgrounds, title colors, and the bottom CTA section.

## Issues Identified

| Element | Other Pages | Pricing (Current) |
|---------|-------------|------------------|
| Section titles | All white text | Green spans (e.g., "Platform Plans") |
| Card backgrounds | Solid dark grey `bg-[#1F2227]` | Glass/transparent variants |
| Bottom CTA | Image-based with business man OR green gradient banner | Gradient card with radial glow |
| Feature comparison title | Should be white | Missing `text-white` class |

---

## Changes to Make

### 1. Fix Section Title Colors

Change all section titles to be all white (no green spans), matching the About page pattern:

- "Platform Plans" - remove green span
- "Enrichment Credit Packs" - remove green span  
- "Feature Comparison" - remove green span, add text-white
- "Frequently Asked Questions" - remove green span

### 2. Fix Card Backgrounds

Replace the glass/gradient card variants with solid dark grey backgrounds matching the rest of the site:

- Platform plan cards: Change from `variant="glass"` / `variant="gradient"` to explicit `bg-[#1F2227] border-white/10`
- Credit pack cards: Same treatment
- Feature comparison table: Same treatment
- FAQ accordion items: Update to use `bg-[#1F2227]`

### 3. Replace Bottom CTA Section

Replace the current gradient card CTA with the image-based CTA pattern used on Landing and Product pages (business man background with left-aligned text).

---

## Technical Details

### File to Modify: `src/pages/Pricing.tsx`

**1. Update Platform Plans section title (lines 174-176):**

```tsx
// BEFORE:
<h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
  Platform <span className="text-primary">Plans</span>
</h2>

// AFTER:
<h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
  Platform Plans
</h2>
```

**2. Update Platform Plan cards (lines 184-225):**

```tsx
// BEFORE:
<Card
  key={index}
  variant={plan.popular ? "gradient" : "glass"}
  hover="lift"
  className={`relative ${plan.popular ? "md:scale-105 shadow-glow z-10" : ""}`}
>

// AFTER:
<div
  key={index}
  className={`relative p-0 rounded-xl border border-white/10 bg-[#1F2227] transition-all duration-300 hover:-translate-y-1 ${plan.popular ? "md:scale-105 border-primary/30 z-10" : ""}`}
>
```

**3. Update Enrichment Credits section title (lines 236-238):**

```tsx
// BEFORE:
<h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
  Enrichment <span className="text-primary">Credit Packs</span>
</h2>

// AFTER:
<h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
  Enrichment Credit Packs
</h2>
```

**4. Update Credit Pack cards (lines 245-272):**

```tsx
// BEFORE:
<Card
  key={index}
  variant="glass"
  hover="lift"
  className={`relative ${pack.popular ? "border-primary/50" : ""}`}
>

// AFTER:
<div
  key={index}
  className={`relative rounded-xl border border-white/10 bg-[#1F2227] transition-all duration-300 hover:-translate-y-1 ${pack.popular ? "border-primary/50" : ""}`}
>
```

**5. Update Feature Comparison title (lines 286-288):**

```tsx
// BEFORE:
<h2 className="text-3xl md:text-4xl font-bold mb-4">
  Feature <span className="text-primary">Comparison</span>
</h2>

// AFTER:
<h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
  Feature Comparison
</h2>
```

**6. Update Feature Comparison table card (line 291):**

```tsx
// BEFORE:
<Card variant="glass" className="max-w-4xl mx-auto overflow-hidden">

// AFTER:
<div className="max-w-4xl mx-auto overflow-hidden rounded-xl border border-white/10 bg-[#1F2227]">
```

**7. Update FAQ title (lines 356-358):**

```tsx
// BEFORE:
<h2 className="text-3xl md:text-4xl font-bold mb-4">
  Frequently Asked <span className="text-primary">Questions</span>
</h2>

// AFTER:
<h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
  Frequently Asked Questions
</h2>
```

**8. Update FAQ accordion items (lines 364-376):**

```tsx
// BEFORE:
<AccordionItem
  key={index}
  value={`item-${index}`}
  className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-lg px-6"
>

// AFTER:
<AccordionItem
  key={index}
  value={`item-${index}`}
  className="bg-[#1F2227] border border-white/10 rounded-lg px-6"
>
```

**9. Replace CTA Section (lines 381-406):**

Replace the gradient card with the business man image CTA pattern:

```tsx
// BEFORE:
<section className="container mx-auto px-6 py-24">
  <Card variant="gradient" className="overflow-hidden relative">
    ...
  </Card>
</section>

// AFTER:
<section className="relative w-full overflow-hidden">
  <img 
    src="/images/Business_Man.webp"
    alt=""
    className="absolute inset-0 w-full h-full object-cover"
  />
  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
  <div className="relative container mx-auto px-6 py-32">
    <div className="max-w-xl">
      <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
        Ready to Get<br />Started?
      </h2>
      <p className="text-lg text-white/80 mb-8">
        Schedule a demo and see how LaunchPulse can transform your GTM strategy.
      </p>
      <Link to="/contact">
        <Button size="xl" variant="default" className="text-lg gap-2">
          Request Demo
          <DiagonalArrow />
        </Button>
      </Link>
    </div>
  </div>
</section>
```

---

## Additional Changes

Add the DiagonalArrow component at the top of the file (after imports) since it's used in the new CTA:

```tsx
function DiagonalArrow({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="18" 
      height="18" 
      viewBox="0 0 18 18" 
      fill="none"
      className={className}
    >
      <path 
        d="M4.38237 12.4016L10.5268 6.25717L5.7538 6.25717L5.7538 4.7574L13.0872 4.7574L13.0872 12.0908L11.5874 12.0908V7.31783L5.44303 13.4622L4.38237 12.4016Z" 
        fill="currentColor"
      />
    </svg>
  );
}
```

---

## Visual Result

After these changes:
- All section headings will be white (no green spans), matching About page
- All cards will have solid dark grey backgrounds (#1F2227), matching the rest of the site
- Bottom CTA will use the business man image pattern, consistent with Landing and Product pages
- Overall visual consistency across all marketing pages

