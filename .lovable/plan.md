
# Complete LaunchPulse.org Replication Plan

## Summary of ALL Changes Required

This plan consolidates ALL items from the previous approved plans plus the new requirements. It covers:
1. Matching the exact content and styling from launchpulse.org
2. Removing all gray text (`text-muted-foreground`) and replacing with white opacity
3. Removing elements not on the original (badges, secondary CTAs, footnotes)
4. Updating exact content to match original wording
5. Keeping Login and Pricing functionality (as requested)

---

## File-by-File Implementation

### File 1: `src/pages/Landing.tsx`

**Hero Section Changes:**
- Remove `badge` prop (line 48) - original has no badge
- Remove `secondaryCta` prop (line 59) - original has only one button
- Remove `footnote` prop (line 60) - original has no footnote

**Pain Points Section Changes (lines 65-80):**
- Change header from "Why GTM Teams Stall" to: "Why GTM Teams performance stalls even when activity is high:"
- Remove the subheading paragraph ("Most go-to-market teams...")
- Change grid from 4-column to 2-column layout

**Features Section Changes:**
- Remove subheading paragraph (line 88-90)
- Update feature descriptions to match original exactly:
  - AI ICP Builder: "Define and validate your ICP using real conversion patterns from your CRM—so targeting is based on evidence, not internal opinion."
  - TAM Generator: "Generate a dynamic, segmentable TAM that stays aligned to your ICP and can be operationalised by territory, industry, size band, region, and buyer persona."
  - CRM Insight Layer: "Diagnose pipeline misalignment by surfacing data quality risk, persona coverage gaps, segment leakage, and where GTM effort is being misallocated."

**CTA Section Changes:**
- Change header from "Ready to Transform Your GTM Strategy?" to: "Request Early Access"
- Change description to: "Get a fast, explainable view of: who converts, who you should target next, and what's blocking yield today. Request early access to see LaunchPulse mapped against your CRM reality."
- Remove footnote (line 131-133)

---

### File 2: `src/pages/About.tsx`

**Hero Section Changes:**
- Remove `badge` prop (line 43)
- Change headline styling from `gradient-text` to `text-primary` for simpler look

**Color Fixes:**
- Line 60: Change `text-white/60` (already correct)
- Line 79: Already `text-white/70` (correct)
- Line 94: Already `text-white/70` (correct)
- Line 128: Already `text-white/60` (correct)

---

### File 3: `src/pages/Product.tsx`

**Hero Section Changes:**
- Remove `badge` prop (line 122)
- Remove `secondaryCta` prop (line 132)
- Change headline styling from `gradient-text` to `text-primary`

**Color Fixes - Replace all `text-muted-foreground` with white opacity:**
- Line 141: `text-muted-foreground` → `text-white/60`
- Line 161: `text-muted-foreground` → `text-white/60`
- Line 191: `text-muted-foreground` → `text-white/60`
- Line 198: `text-muted-foreground` → `text-white/60`
- Line 235: `text-muted-foreground` → `text-white/50`
- Line 262: `text-muted-foreground` → `text-white/60`
- Line 281: `text-muted-foreground` → `text-white/60`
- Line 302: `text-muted-foreground` → `text-white/60`

**Styling Fixes:**
- Change all `gradient-text` to `text-primary`

---

### File 4: `src/pages/Pricing.tsx`

**KEEP:** Full Pricing functionality (as requested)

**Hero Section Changes:**
- Remove `badge` prop (line 160)
- Change headline styling from `gradient-text` to `text-primary`

**Color Fixes - Replace all `text-muted-foreground` with white opacity:**
- Line 178: `text-muted-foreground` → `text-white/60`
- Line 198: `text-muted-foreground` → `text-white/60`
- Line 201: `text-muted-foreground` → `text-white/60`
- Line 240: `text-muted-foreground` → `text-white/60`
- Line 263: `text-muted-foreground` → `text-white/50`
- Line 265: `text-muted-foreground` → `text-white/50`
- Line 277: `text-muted-foreground` → `text-white/50`
- Line 373: `text-muted-foreground` → `text-white/60`
- Line 396: `text-muted-foreground` → `text-white/60`

**Styling Fixes:**
- Change all `gradient-text` to `text-primary`

---

### File 5: `src/components/marketing/MarketingNav.tsx`

**KEEP:** Pricing link in navigation (as requested)

**Color Fixes - Replace `text-muted-foreground` with white opacity:**
- Line 36: `text-muted-foreground` → `text-white/60`
- Line 47: `text-muted-foreground hover:text-foreground` → `text-white/60 hover:text-white`
- Line 58: `text-muted-foreground hover:text-foreground` → `text-white/60 hover:text-white`
- Line 78: `text-muted-foreground` → `text-white/60`

---

### File 6: `src/components/marketing/MarketingFooter.tsx`

**Color Fixes - Replace all `text-muted-foreground` with white opacity:**
- Line 31: `text-muted-foreground` → `text-white/60`
- Line 39: `text-muted-foreground` → `text-white/50`
- Line 48: `text-muted-foreground` → `text-white/50`
- Line 64: `text-muted-foreground` → `text-white/60`
- Line 81: `text-muted-foreground` → `text-white/60`
- Line 98: `text-muted-foreground` → `text-white/60`
- Line 110: `text-muted-foreground` → `text-white/50`
- Line 113: `text-muted-foreground` → `text-white/50`

---

### File 7: `src/components/AuthSystem.tsx`

**KEEP:** Full Login functionality (as requested)

**Color Fixes - Replace `text-muted-foreground` with white opacity:**
- Line 240: `text-muted-foreground` → `text-white/60`
- Line 272, 287: Input placeholder icons - keep as `text-muted-foreground` for form inputs (acceptable)
- Line 321: `text-muted-foreground hover:text-primary` → `text-white/50 hover:text-primary`
- Line 405: `text-muted-foreground` → `text-white/50`

---

## Summary Table

| File | Badge Removal | SecondaryCta Removal | Footnote Removal | Gray→White Fix | Content Update |
|------|---------------|---------------------|------------------|----------------|----------------|
| Landing.tsx | Yes | Yes | Yes | Yes | Yes |
| About.tsx | Yes | N/A | N/A | Already done | Gradient→Primary |
| Product.tsx | Yes | Yes | N/A | Yes | Gradient→Primary |
| Pricing.tsx | Yes | N/A | N/A | Yes | Gradient→Primary |
| MarketingNav.tsx | N/A | N/A | N/A | Yes | Keep Pricing link |
| MarketingFooter.tsx | N/A | N/A | N/A | Yes | N/A |
| AuthSystem.tsx | N/A | N/A | N/A | Yes | N/A |

---

## Exact Content Updates for Landing Page

**Hero:**
```
Headline: "AI-Driven ICP and TAM Intelligence for High-Performance GTM Teams"
Subheadline: "LaunchPulse pinpoints your highest-converting customer profile..."
CTA: "Request Demo" (single button only)
No badge, no footnote
```

**Pain Points Section:**
```
Header: "Why GTM Teams performance stalls even when activity is high:"
(No subheading)
- ICP is built on assumptions, not conversion evidence
- TAM is static, poorly segmented, and rarely tied to ICP reality
- CRM data obscures persona coverage, segment gaps, and lead quality risk
- Leadership lacks a clear diagnostic view of what's blocking yield
```

**Features Section:**
```
Header: "What LaunchPulse Delivers"
(No subheading)

AI ICP Builder: "Define and validate your ICP using real conversion patterns from your CRM—so targeting is based on evidence, not internal opinion."

TAM Generator: "Generate a dynamic, segmentable TAM that stays aligned to your ICP and can be operationalised by territory, industry, size band, region, and buyer persona."

CRM Insight Layer: "Diagnose pipeline misalignment by surfacing data quality risk, persona coverage gaps, segment leakage, and where GTM effort is being misallocated."
```

**CTA Section:**
```
Header: "Request Early Access"
Description: "Get a fast, explainable view of: who converts, who you should target next, and what's blocking yield today. Request early access to see LaunchPulse mapped against your CRM reality."
Button: "Request Demo"
(No footnote)
```

---

## Visual Result After Implementation

1. **Landing page** matches launchpulse.org exactly:
   - No badge in hero
   - Single "Request Demo" button
   - Correct headline styling (faded prefix + bold emphasis)
   - Pain points with exact original header
   - 3 feature cards with original descriptions
   - "Request Early Access" CTA with original text
   - No footnotes anywhere

2. **All marketing pages** will have:
   - White text with opacity (no gray `text-muted-foreground`)
   - True black background
   - Lime green (#3CF1AE) accents via `text-primary`
   - No gradient-text (replaced with text-primary for consistency)
   - Clean, minimal design matching original

3. **Login and Pricing pages** will:
   - Keep full functionality
   - Use consistent white-with-opacity text styling
   - Match the brand aesthetic
   - Pricing link stays in navigation
