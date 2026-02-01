

# A/B Testing Meta Descriptions Plan

## Overview

Implement a client-side A/B testing system for meta descriptions that:
1. Randomly assigns visitors to variant groups (persisted in localStorage)
2. Tracks which variant was shown via Google Analytics 4
3. Allows you to analyze CTR differences in GA4 or Search Console

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     New Files                               │
├─────────────────────────────────────────────────────────────┤
│  src/lib/ab-testing.ts        - Core A/B logic              │
│  src/lib/seo-variants.ts      - Meta description variants   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Modified Files                              │
├─────────────────────────────────────────────────────────────┤
│  src/components/SEOHead.tsx   - Accept variants, pick one   │
│  src/lib/analytics.ts         - Track variant events        │
│  src/pages/Landing.tsx        - Pass description variants   │
│  src/pages/Product.tsx        - Pass description variants   │
│  src/pages/Pricing.tsx        - Pass description variants   │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: Create A/B Testing Utility

**New File:** `src/lib/ab-testing.ts`

This utility will:
- Generate a consistent user ID stored in localStorage
- Assign users to variants deterministically (same user always sees same variant)
- Support multiple concurrent experiments

```typescript
// Key functions:
// - getUserId(): string - Get or create persistent user ID
// - getVariant(experimentId: string, variants: string[]): string - Deterministic variant selection
// - hashString(str: string): number - Simple hash for consistent assignment
```

---

## Step 2: Create SEO Variants Configuration

**New File:** `src/lib/seo-variants.ts`

Centralized configuration for all meta description experiments:

| Page | Variant A (Control) | Variant B (Power Words) | Variant C (Social Proof) |
|------|---------------------|-------------------------|--------------------------|
| Landing | "Stop guessing which accounts convert..." | "14,000+ accounts scored with 99% accuracy..." | "RevOps teams close 2x faster with AI-powered ICP..." |
| Product | "See exactly why deals close..." | "AI reveals your hidden ICP patterns..." | "Join teams who increased win rates 40%..." |
| Pricing | "Simple, transparent pricing..." | "Start free. Scale when ready..." | "Most popular: Pro plan at $X/month..." |

The file will export:
```typescript
export const SEO_EXPERIMENTS = {
  landing: {
    experimentId: 'landing_meta_v1',
    variants: {
      control: "Stop guessing which accounts convert...",
      power_words: "14,000+ accounts scored...",
      social_proof: "RevOps teams close 2x faster..."
    }
  },
  // ... other pages
}
```

---

## Step 3: Add Analytics Tracking

**File:** `src/lib/analytics.ts`

Add new tracking function:

```typescript
/**
 * Track which A/B variant was shown to the user
 */
export const trackABVariant = (
  experimentId: string,
  variantId: string,
  pagePath: string
): void => {
  if (!isGAAvailable()) return;
  
  window.gtag?.('event', 'ab_experiment_view', {
    experiment_id: experimentId,
    variant_id: variantId,
    page_path: pagePath,
  });
};
```

---

## Step 4: Update SEOHead Component

**File:** `src/components/SEOHead.tsx`

Add support for description variants:

```typescript
interface SEOHeadProps {
  title: string;
  description: string;
  descriptionVariants?: {
    experimentId: string;
    variants: Record<string, string>;
  };
  canonicalPath?: string;
  ogImage?: string;
}
```

The component will:
1. If `descriptionVariants` is provided, use `getVariant()` to pick one
2. Track the variant shown via `trackABVariant()`
3. Use the selected description for all meta tags

---

## Step 5: Update Page Components

**Files:** `Landing.tsx`, `Product.tsx`, `Pricing.tsx`

Example for Landing.tsx:
```typescript
import { SEO_EXPERIMENTS } from "@/lib/seo-variants";

<SEOHead
  title="LaunchPulse - AI-Driven ICP & TAM Intelligence Platform"
  description={SEO_EXPERIMENTS.landing.variants.control}
  descriptionVariants={SEO_EXPERIMENTS.landing}
  canonicalPath="/landing"
  ogImage="/og/og-landing.png"
/>
```

---

## How to Analyze Results

### Option 1: Google Analytics 4

1. Go to GA4 → Reports → Engagement → Events
2. Filter by event name: `ab_experiment_view`
3. Create custom dimension for `experiment_id` and `variant_id`
4. Compare conversion rates between variants

### Option 2: Google Search Console

1. Note which date ranges had which variants
2. Compare CTR for the same pages across date ranges
3. Use the Performance report filtered by page

### Option 3: Export to Spreadsheet

Track variant assignments in GA4 and correlate with:
- Sign-up events
- Demo requests
- Time on page

---

## Important Considerations

### SEO Note
Since meta descriptions are set client-side after JavaScript loads, search engines (Google) will:
- See the initial `index.html` fallback during first crawl
- May eventually index the client-rendered description
- For true SEO A/B testing, server-side rendering would be ideal

**Recommendation:** This approach is best for testing social media sharing previews and measuring user engagement *after* they land on the page. For pure SERP CTR testing, consider running sequential tests (Variant A for 2 weeks, then Variant B for 2 weeks).

### Statistical Significance
- Run tests for at least 2-4 weeks
- Aim for 1,000+ impressions per variant
- Use a significance calculator before declaring a winner

---

## File Summary

| File | Action |
|------|--------|
| `src/lib/ab-testing.ts` | Create - Core A/B logic with localStorage persistence |
| `src/lib/seo-variants.ts` | Create - Centralized variant configurations |
| `src/lib/analytics.ts` | Update - Add `trackABVariant()` function |
| `src/components/SEOHead.tsx` | Update - Accept variants prop, select & track |
| `src/pages/Landing.tsx` | Update - Pass variants to SEOHead |
| `src/pages/Product.tsx` | Update - Pass variants to SEOHead |
| `src/pages/Pricing.tsx` | Update - Pass variants to SEOHead |

