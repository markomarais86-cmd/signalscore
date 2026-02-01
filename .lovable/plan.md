

# SEO Fix Plan: Remove Protected Route from Sitemap

## Issue

**File:** `public/sitemap.xml`

**Problem:** The sitemap includes `https://launchpulse.io/` (root URL) with `priority="1.0"`. However, the root route `/` is a **protected route** that requires authentication (renders `ExecutiveDashboard`). This causes:
- Wasted crawl budget on non-indexable pages
- Potential "soft 404" or "blocked" errors in Google Search Console
- Indexing confusion for search engines

---

## Solution

Remove the root URL entry from the sitemap. The `/landing` page remains as the highest priority public entry point.

**Entry to remove:**
```xml
<url>
  <loc>https://launchpulse.io/</loc>
  <lastmod>2026-02-01</lastmod>
  <changefreq>weekly</changefreq>
  <priority>1.0</priority>
</url>
```

---

## File Change

| File | Action |
|------|--------|
| `public/sitemap.xml` | Remove lines 3-8 (the root URL entry) |

---

## Result

After the fix, the sitemap will contain only publicly accessible pages:
- `/landing` (priority 1.0)
- `/product` (priority 0.9)
- `/pricing` (priority 0.9)
- `/about` (priority 0.8)
- `/contact` (priority 0.8)
- `/privacy` (priority 0.3)
- `/terms` (priority 0.3)

