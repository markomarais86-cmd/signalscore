
# SEO Optimization Plan: Match launchpulse.org Quality

## Problem Analysis

Based on your Google search comparison screenshots, launchpulse.org performs better in search results due to several SEO factors:

### Current Issues with launchpulse.io

| Issue | launchpulse.io (Current) | launchpulse.org (Target) |
|-------|--------------------------|--------------------------|
| **Page Title** | "AI-Driven ICP & TAM Intelligence Platform - launchpulse.io" (60+ chars) | "LaunchPulse" (clean, 11 chars) |
| **URL in Search** | Shows `/landing` subpage | Shows root domain |
| **Description** | Generic marketing copy | Matches hero text exactly |
| **Favicon Display** | May not render properly in all contexts | Clean branded icon |

---

## Implementation Plan

### 1. Simplify Page Titles (Brand-First Strategy)

**Current format**: `[Long Description] - launchpulse.io`  
**New format**: `LaunchPulse | [Short Descriptor]`

| Page | Current Title | New Title |
|------|---------------|-----------|
| Landing | "LaunchPulse - AI-Driven ICP & TAM Intelligence Platform" | "LaunchPulse" |
| Product | (similar long format) | "LaunchPulse | Product" |
| Pricing | (similar long format) | "LaunchPulse | Pricing" |
| Terms | "Terms of Service - LaunchPulse" | "LaunchPulse | Terms" |
| Privacy | "Privacy Policy - LaunchPulse" | "LaunchPulse | Privacy" |

The key insight: Google is picking up the full verbose title. launchpulse.org uses just "LaunchPulse" which displays cleanly.

### 2. Align Meta Description with Hero Text

The launchpulse.org search result shows this exact description:
> "LaunchPulse pinpoints your highest-converting customer profile, validates ICP alignment inside your CRM, and exposes where pipeline yield is being..."

This matches the hero subheadline. We should use the same for consistency.

**Files to update:**
- `src/lib/seo-variants.ts` - Update the control variant
- `src/pages/Landing.tsx` - Ensure SEOHead uses matching description
- `index.html` - Update default meta description

### 3. Make Root URL the Primary Marketing Page

Currently, the sitemap shows `/landing` as priority 1.0 but the root `/` redirects to the dashboard (authenticated route). This causes:
- Google indexes `/landing` instead of `/`
- Looks less professional in search results

**Options:**
1. **Redirect Strategy**: Keep auth on `/` but add a marketing-first experience
2. **Route Change**: Make `/` serve the landing page for unauthenticated users

**Recommended approach**: Update the router to show Landing page at `/` for unauthenticated visitors, redirect to dashboard for authenticated users. Update canonical URLs accordingly.

### 4. Add Favicon Variants for Better Search Display

Current: Only SVG favicon
Needed: Multiple formats for broader compatibility

**Add to `public/`:**
- `favicon.ico` (16x16, 32x32 multi-resolution)
- `favicon-32x32.png`
- `favicon-16x16.png`  
- `apple-touch-icon.png` (180x180)

### 5. Update Sitemap Structure

Current sitemap has `/landing` as the main URL. Update to prioritize the root if we change routing:

```xml
<url>
  <loc>https://launchpulse.io/</loc>
  <priority>1.0</priority>
</url>
```

---

## Technical Changes Summary

### Files to Modify

| File | Change |
|------|--------|
| `index.html` | Simplify title to "LaunchPulse", update meta description to match .org |
| `src/pages/Landing.tsx` | Update SEOHead title to "LaunchPulse" |
| `src/pages/Product.tsx` | Update SEOHead title to "LaunchPulse \| Product" |
| `src/pages/Pricing.tsx` | Update SEOHead title to "LaunchPulse \| Pricing" |
| `src/pages/TermsOfService.tsx` | Update title to "LaunchPulse \| Terms" |
| `src/pages/PrivacyPolicy.tsx` | Update title to "LaunchPulse \| Privacy" |
| `src/lib/seo-variants.ts` | Update control description to match .org |
| `public/sitemap.xml` | Consider adding root URL if routing changes |
| `src/App.tsx` | Update routing to serve Landing at `/` for guests |

### New Files to Create

| File | Purpose |
|------|---------|
| `public/favicon.ico` | Multi-resolution ICO for legacy browsers |
| `public/favicon-32x32.png` | PNG favicon |
| `public/favicon-16x16.png` | Small PNG favicon |

---

## Expected Outcome

After implementation, Google search results for "launchpulse.io" should display:

```text
launchpulse.io
https://launchpulse.io

LaunchPulse
LaunchPulse pinpoints your highest-converting customer profile, 
validates ICP alignment inside your CRM, and exposes where pipeline 
yield is being...
```

This matches the clean, professional presentation of launchpulse.org while maintaining consistent branding across both properties.

---

## Timeline Note

Google re-crawls and re-indexes pages on its own schedule (days to weeks). After making these changes:
1. Submit updated sitemap via Google Search Console
2. Request re-indexing of key pages
3. Allow 1-2 weeks for changes to fully propagate in search results
