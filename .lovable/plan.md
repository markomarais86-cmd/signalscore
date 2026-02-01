

# Google Analytics Setup Plan for launchpulse.io

## Overview
This plan adds Google Analytics 4 (GA4) tracking to your LaunchPulse website, enabling you to track page views, user behavior, and conversions across both marketing pages and the authenticated app.

---

## Prerequisites (You'll Need to Do This First)

Before I can implement the code, you need to:

1. **Go to** [Google Analytics](https://analytics.google.com/)
2. **Create a new GA4 property** for launchpulse.io
3. **Get your Measurement ID** (looks like `G-XXXXXXXXXX`)

---

## Implementation Steps

### Step 1: Add Google Analytics Script to index.html

Add the GA4 tracking script to the `<head>` section of your index.html file. This loads Google's gtag.js library and initializes tracking with your Measurement ID.

**Location:** `index.html` (in the `<head>` section, before the closing `</head>` tag)

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### Step 2: Create Analytics Utility (Optional but Recommended)

Create a reusable analytics helper for tracking custom events like signups, form submissions, and feature usage.

**Location:** `src/lib/analytics.ts` (new file)

This utility will:
- Provide type-safe event tracking functions
- Handle cases where GA isn't loaded (dev environment)
- Track key conversion events like signups, pricing clicks, and feature engagement

### Step 3: Add Route Change Tracking

Since LaunchPulse is a Single Page Application (SPA), we need to track page views when users navigate between routes. This will be added to your App.tsx using React Router's location changes.

**Location:** `src/App.tsx`

This ensures every page navigation is tracked, not just the initial page load.

---

## Events to Track (Recommended)

| Event Name | Trigger | Purpose |
|------------|---------|---------|
| `page_view` | Route change | Track which pages users visit |
| `sign_up` | User creates account | Conversion tracking |
| `login` | User logs in | User engagement |
| `cta_click` | "Get Started" buttons | Marketing funnel |
| `pricing_view` | Visit pricing page | Purchase intent |
| `contact_form_submit` | Contact form submission | Lead generation |

---

## Privacy Considerations

The implementation will:
- Only load GA on the production site (not in development)
- Respect any cookie consent preferences (if you add a consent banner later)
- Anonymize IP addresses for GDPR compliance

---

## Technical Notes

- **No environment variable needed** for the Measurement ID since it's a public identifier
- **Works with your existing SEOHead component** - no conflicts
- **Minimal performance impact** - gtag.js loads asynchronously

---

## After Implementation

Once I add the code, you'll need to:

1. **Replace** `G-XXXXXXXXXX` with your actual Measurement ID
2. **Publish** the changes to make them live
3. **Verify** in Google Analytics Real-Time view by visiting your site

---

## Summary of Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `index.html` | Modify | Add GA4 script tags |
| `src/lib/analytics.ts` | Create | Analytics utility for custom events |
| `src/App.tsx` | Modify | Add SPA page view tracking |

