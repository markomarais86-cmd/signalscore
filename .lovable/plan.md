
# Add Legal Page Links to Footer & Match Marketing Theme

## Overview
Enhance the marketing footer to include Privacy Policy and Terms of Service links, and update both legal pages to use the consistent dark marketing theme with proper navigation.

---

## Changes

### 1. Update Marketing Footer
Add legal links to the footer for better accessibility and compliance.

**File: `src/components/marketing/MarketingFooter.tsx`**

Add a row of links:
- Privacy Policy (`/privacy`)
- Terms of Service (`/terms`)

### 2. Update Privacy Policy Page
Match the marketing site theme for visual consistency.

**File: `src/pages/PrivacyPolicy.tsx`**

Changes:
- Wrap in `GradientBackground` with dark theme
- Add `MarketingNav` at top
- Add `MarketingFooter` at bottom
- Update "Back" link to go to `/landing` instead of `/auth`
- Style content for dark theme (white text, proper contrast)

### 3. Update Terms of Service Page
Same treatment as Privacy Policy.

**File: `src/pages/TermsOfService.tsx`**

Changes:
- Wrap in `GradientBackground` with dark theme
- Add `MarketingNav` at top
- Add `MarketingFooter` at bottom
- Update "Back" link to go to `/landing` instead of `/auth`
- Style content for dark theme

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/marketing/MarketingFooter.tsx` | Add Privacy/Terms links |
| `src/pages/PrivacyPolicy.tsx` | Add marketing nav/footer, dark theme |
| `src/pages/TermsOfService.tsx` | Add marketing nav/footer, dark theme |

---

## Expected Result
- Legal pages accessible from every marketing page footer
- Consistent dark theme across all public pages
- Professional appearance matching competitor standards
