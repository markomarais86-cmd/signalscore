
# Page-Specific Open Graph Images Plan

## Current State

**What's working:**
- The `SEOHead` component already supports an `ogImage` prop (line 7, defaults to `/og-image.png`)
- A generic `og-image.png` exists in `/public/`
- index.html uses an external image from Google Storage for OG/Twitter

**The problem:**
- None of the 8 pages pass a custom `ogImage` prop to `SEOHead`
- All pages fall back to the generic `/og-image.png`
- When shared on social media, every page looks identical—missing an opportunity to customize messaging per page

---

## Solution: Page-Specific OG Images

### Step 1: Create OG Image Assets

You'll need to create 6 distinct OG images (1200x630px recommended) for your key pages. I recommend using a tool like Canva, Figma, or an OG image generator.

**Suggested images to create:**

| Page | Filename | Suggested Content |
|------|----------|-------------------|
| Landing/Home | `og-landing.png` | Logo + "AI-Powered ICP Intelligence" + dashboard preview |
| Product | `og-product.png` | Logo + "See Why Deals Close" + feature icons |
| Pricing | `og-pricing.png` | Logo + "Plans That Scale With You" + price tiers visual |
| About | `og-about.png` | Logo + "Built for RevOps Leaders" + team/mission visual |
| Contact | `og-contact.png` | Logo + "Let's Talk GTM" + contact illustration |
| Generic | `og-default.png` | Logo + tagline (for legal pages, 404, etc.) |

**Upload location:** `public/og/` (new folder)

---

### Step 2: Update SEOHead Component

Enhance the component to construct full absolute URLs for OG images (social platforms require absolute URLs):

**File:** `src/components/SEOHead.tsx`

```typescript
// Add base URL constant and construct absolute OG image URL
const baseUrl = "https://launchpulse.io";
const absoluteOgImage = ogImage.startsWith("http") 
  ? ogImage 
  : `${baseUrl}${ogImage}`;
```

---

### Step 3: Add ogImage Prop to Each Page

**Files to modify:**

| File | ogImage Value |
|------|---------------|
| `src/pages/Landing.tsx` | `ogImage="/og/og-landing.png"` |
| `src/pages/Product.tsx` | `ogImage="/og/og-product.png"` |
| `src/pages/Pricing.tsx` | `ogImage="/og/og-pricing.png"` |
| `src/pages/About.tsx` | `ogImage="/og/og-about.png"` |
| `src/pages/Contact.tsx` | `ogImage="/og/og-contact.png"` |
| `src/pages/PrivacyPolicy.tsx` | `ogImage="/og/og-default.png"` |
| `src/pages/TermsOfService.tsx` | `ogImage="/og/og-default.png"` |
| `src/pages/NotFound.tsx` | `ogImage="/og/og-default.png"` |

---

### Step 4: Update index.html Default

Update the fallback OG image in `index.html` to use the landing page image as the default for initial page loads:

**File:** `index.html`

```html
<meta property="og:image" content="https://launchpulse.io/og/og-landing.png">
<meta name="twitter:image" content="https://launchpulse.io/og/og-landing.png">
```

---

## OG Image Best Practices

For maximum social media impact, each image should:

1. **Dimensions:** 1200x630px (optimal for LinkedIn, Facebook, Twitter)
2. **File size:** Under 300KB for fast loading
3. **Format:** PNG for graphics/text, JPG for photos
4. **Safe zone:** Keep important content within center 60% (some platforms crop edges)
5. **Brand consistency:** Use LaunchPulse colors, fonts, and logo
6. **Text:** Large, readable headlines (max 5-6 words)
7. **Contrast:** Dark background works well with your brand

---

## Summary of Changes

| File | Action |
|------|--------|
| `public/og/` | Create new folder for OG images |
| `public/og/*.png` | Upload 6 custom OG images (you create these) |
| `src/components/SEOHead.tsx` | Construct absolute URLs for OG images |
| `src/pages/Landing.tsx` | Add `ogImage` prop |
| `src/pages/Product.tsx` | Add `ogImage` prop |
| `src/pages/Pricing.tsx` | Add `ogImage` prop |
| `src/pages/About.tsx` | Add `ogImage` prop |
| `src/pages/Contact.tsx` | Add `ogImage` prop |
| `src/pages/PrivacyPolicy.tsx` | Add `ogImage` prop |
| `src/pages/TermsOfService.tsx` | Add `ogImage` prop |
| `src/pages/NotFound.tsx` | Add `ogImage` prop |
| `index.html` | Update default OG image URLs |

---

## Expected Impact

- **Better social CTR:** Page-specific images grab attention in feeds
- **Clearer messaging:** Each share preview communicates page-specific value
- **Professional appearance:** Consistent branded assets across all shares
- **SEO benefit:** Proper OG tags improve social signal quality

---

## Next Steps After Approval

1. I'll implement the code changes (SEOHead enhancement + page updates)
2. You'll need to create and upload the 6 OG images to `public/og/`
3. Test with Facebook Sharing Debugger and Twitter Card Validator
