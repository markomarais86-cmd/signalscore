
# SEO Improvement Plan for LaunchPulse

## Current State Analysis

After reviewing your codebase, I've identified several areas where SEO can be significantly improved:

**What's Already Good:**
- Basic meta tags in `index.html` (title, description, Open Graph, Twitter cards)
- `robots.txt` configured to allow crawling
- Semantic `<main>` tags on pages
- Good use of heading hierarchy (h1, h2, h3)

**Key Gaps Found:**
- No sitemap.xml for search engine discovery
- No per-page meta tags (all pages share the same title/description)
- No structured data (JSON-LD schema)
- Missing `og-image.png` file in public folder
- Images missing descriptive alt text in some places
- No favicon set locally (using external URL)

---

## Recommended Improvements

### 1. Add Dynamic Per-Page Meta Tags
Currently all pages share the same title/description from `index.html`. Each marketing page should have unique, keyword-optimized metadata.

**Solution:** Create a reusable `SEOHead` component using document.title and meta tag updates, or install `react-helmet-async` for proper SSR-ready meta management.

**Example pages needing unique meta:**
| Page | Suggested Title | Target Keywords |
|------|-----------------|-----------------|
| Landing | "LaunchPulse - AI-Driven ICP & TAM Intelligence" | ICP, TAM, GTM, sales intelligence |
| Product | "Product - ICP Builder & TAM Generator" | ICP builder, TAM generator, CRM analytics |
| Pricing | "Pricing - Simple, Transparent Plans" | pricing, plans, sales intelligence cost |
| About | "About LaunchPulse - GTM Intelligence" | about, company, mission |
| Contact | "Contact Us - Request a Demo" | contact, demo, sales |

### 2. Create sitemap.xml
Search engines use sitemaps to discover and prioritize pages. Your site currently has no sitemap.

**Solution:** Add a static `public/sitemap.xml` listing all public marketing pages with lastmod dates and priority levels.

**Pages to include:**
- /landing (priority: 1.0)
- /product (priority: 0.9)
- /pricing (priority: 0.9)
- /about (priority: 0.8)
- /contact (priority: 0.8)
- /privacy (priority: 0.3)
- /terms (priority: 0.3)

### 3. Add Structured Data (JSON-LD)
Add schema.org markup for better rich snippets in search results.

**Recommended schemas:**
- **Organization** - Company info, logo, contact
- **WebSite** - Site name and search action
- **FAQPage** - For pricing page FAQ section
- **SoftwareApplication** - For product description

### 4. Add Local og-image.png
The current `og:image` points to `/og-image.png` but the file doesn't exist in the public folder.

**Solution:** Create or add a 1200x630px branded social sharing image to `public/og-image.png`.

### 5. Add Local Favicon
Currently using an external URL for favicon. This can slow loading and may fail if the external source is unavailable.

**Solution:** Download and add favicon files locally:
- `public/favicon.svg` or `public/favicon.ico`
- `public/apple-touch-icon.png` (180x180)

### 6. Improve Image Alt Text
Some images have empty or generic alt attributes.

**Examples to fix:**
- Business_Man.webp: Currently `alt=""` - should describe the image
- Background images with `alt=""` are fine (decorative)

### 7. Update robots.txt with Sitemap Reference
Add sitemap location to help crawlers find it.

```text
Sitemap: https://launchpulse.io/sitemap.xml
```

### 8. Add Canonical URLs to Each Page
Each marketing page should have its own canonical URL to prevent duplicate content issues.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/SEOHead.tsx` | Create - Reusable component for page-specific meta tags |
| `public/sitemap.xml` | Create - XML sitemap with all public pages |
| `public/og-image.png` | Create - Social sharing image (1200x630) |
| `public/favicon.svg` | Create - Local favicon file |
| `public/robots.txt` | Modify - Add sitemap reference |
| `index.html` | Modify - Update favicon to local path, add JSON-LD |
| `src/pages/Landing.tsx` | Modify - Add SEOHead with unique meta |
| `src/pages/Product.tsx` | Modify - Add SEOHead with unique meta |
| `src/pages/Pricing.tsx` | Modify - Add SEOHead with unique meta |
| `src/pages/About.tsx` | Modify - Add SEOHead with unique meta |
| `src/pages/Contact.tsx` | Modify - Add SEOHead with unique meta |
| `src/pages/PrivacyPolicy.tsx` | Modify - Add SEOHead with unique meta |
| `src/pages/TermsOfService.tsx` | Modify - Add SEOHead with unique meta |

---

## Priority Order

1. **High Impact**: Per-page meta tags + sitemap.xml
2. **Medium Impact**: Structured data + og-image
3. **Low Impact**: Local favicon + alt text improvements

---

## Technical Details

### SEOHead Component Pattern

```tsx
// Sets document.title and meta tags on mount
useEffect(() => {
  document.title = title;
  
  // Update or create meta tags
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute('content', description);
  }
  
  // Update OG tags similarly...
}, [title, description]);
```

### JSON-LD Organization Schema

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "LaunchPulse",
  "url": "https://launchpulse.io",
  "logo": "https://launchpulse.io/brand/logo.svg",
  "contactPoint": {
    "@type": "ContactPoint",
    "email": "contact@launchpulse.io"
  }
}
```

---

## Expected Outcomes

- Improved search engine indexing and discovery
- Better click-through rates from unique page titles/descriptions
- Rich snippets in search results (FAQ, organization info)
- Proper social media previews when links are shared
- Faster favicon loading with local assets
