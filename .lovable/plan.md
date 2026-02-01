
# Replicate LaunchPulse.org Website Exactly

## Problem

The current implementation creates fake mockup components using code instead of using the actual images from launchpulse.org. The reference website uses real hosted images from Webflow's CDN that show the actual dashboard interface.

## Solution: Use Actual Images from LaunchPulse.org

Replace the generated mockup components with the actual images used on the reference site.

---

## Image Assets to Use (from launchpulse.org CDN)

| Image | URL | Purpose |
|-------|-----|---------|
| Hero Dashboard | `https://cdn.prod.website-files.com/694961d117761a0a17d0744b/695056603a61a746b7ebbe31_light.svg` | Main hero section showing dashboard stats |
| TAM Indicator | `https://cdn.prod.website-files.com/694961d117761a0a17d0744b/695060479ce89b8d2ce475be_TAM-01.svg` | Floating TAM $5.9B card |
| ICP Chart | `https://cdn.prod.website-files.com/694961d117761a0a17d0744b/69505f8e81701ec89798c0a8_icp-01.svg` | ICP donut chart overlay |
| ICP Section | `https://cdn.prod.website-files.com/694961d117761a0a17d0744b/695055dccf22527a26df6e62_icp-01.svg` | "Why GTM Teams Stall" section |
| Revenue Stats | `https://cdn.prod.website-files.com/694961d117761a0a17d0744b/694e6fd27d17f86e6ce24884_total-01.svg` | Additional stats visual |
| AI ICP Builder | `https://cdn.prod.website-files.com/694961d117761a0a17d0744b/69696639d97eebd4bc9bcd01_build-01.svg` | Feature icon |
| TAM Generator | `https://cdn.prod.website-files.com/694961d117761a0a17d0744b/696964446c7c72967b3789de_Tam%20Generator.svg` | Feature icon |
| CRM Insight | `https://cdn.prod.website-files.com/694961d117761a0a17d0744b/696a48e374f363cbe28776a0_persona.svg` | Feature icon |
| Logo | `https://cdn.prod.website-files.com/694961d117761a0a17d0744b/69497386bcff6817bd62fe29_light-01.svg` | Navigation logo |

---

## Implementation Plan

### Step 1: Replace HeroDashboardMockup Component

**File:** `src/components/marketing/HeroDashboardMockup.tsx`

**Current:** Generates fake dashboard cards with code

**New:** Use actual images from launchpulse.org with proper positioning

```typescript
export function HeroDashboardMockup({ className }: HeroDashboardMockupProps) {
  return (
    <div className={cn("relative max-w-5xl mx-auto", className)}>
      {/* Main dashboard image */}
      <img 
        src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/695056603a61a746b7ebbe31_light.svg"
        alt="LaunchPulse Dashboard"
        className="w-full"
      />
      
      {/* Floating TAM indicator */}
      <img 
        src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/695060479ce89b8d2ce475be_TAM-01.svg"
        alt="TAM Indicator"
        className="absolute -left-10 bottom-20 w-40 animate-float"
      />
      
      {/* Floating ICP chart */}
      <img 
        src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/69505f8e81701ec89798c0a8_icp-01.svg"
        alt="ICP Coverage"
        className="absolute -right-10 top-20 w-36 animate-float-delayed"
      />
    </div>
  );
}
```

---

### Step 2: Update Landing Page Pain Points Section

**File:** `src/pages/Landing.tsx`

Add the floating dashboard images to the pain points section, matching the layout on launchpulse.org where images appear alongside the bullet points.

---

### Step 3: Update Feature Cards with Actual Icons

**File:** `src/components/marketing/FeatureCard.tsx` or `src/pages/Landing.tsx`

Replace Lucide icons with actual SVG images from the reference site for each feature:
- AI ICP Builder: Use `build-01.svg`
- TAM Generator: Use `Tam Generator.svg`
- CRM Insight Layer: Use `persona.svg`

---

### Step 4: Match Exact Layout Structure

The reference site has this exact structure:

```text
[Navigation Bar]
   Logo                    Home  About  Product    [Request Demo]

[Hero Section]
   AI-Driven ICP and TAM (gray gradient text)
   Intelligence for High-Performance GTM Teams (white bold text)
   
   [Subheadline paragraph]
   
   [Request Demo Button]
   
   [FLOATING DASHBOARD IMAGES]
   - Main dashboard showing Total Accounts, Total Leads, Campaign Ready
   - ICP Coverage Overview with bar chart
   - TAM $5.9B indicator floating left
   - ICP donut chart floating right

[Pain Points Section]
   Why GTM Teams performance stalls...
   [Checkmark bullet points with floating images]

[Features Section]
   What LaunchPulse Delivers
   [3 feature cards with SVG icons]

[CTA Section]
   Request Early Access
```

---

### Step 5: Fix Hero Headline Styling

Match the exact gradient styling from launchpulse.org:
- "AI-Driven ICP and TAM Intelligence for" - Gray/muted gradient text
- "High-Performance GTM Teams" - Solid white bold text

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/marketing/HeroDashboardMockup.tsx` | Replace with actual CDN images |
| `src/pages/Landing.tsx` | Update headline styling, add pain points images, adjust layout |
| `src/components/marketing/FeatureCard.tsx` | Support image URLs for icons instead of Lucide components |
| `src/components/marketing/PainPointCard.tsx` | Update to use checkmark style from reference |

---

## Visual Comparison

**Current State:**
- Generated code mockups that don't match the reference
- Wrong visual style
- Missing floating images

**After Implementation:**
- Exact same images as launchpulse.org
- Matching layout and positioning
- Floating animations on dashboard elements
- Correct gradient text styling
- Authentic premium look

---

## Notes

- Images are hosted on Webflow CDN and publicly accessible
- The images are SVGs so they scale perfectly at any resolution
- Floating animations will use existing `animate-float` and `animate-float-delayed` utilities
- Dark theme is already correctly implemented with `forceDark`
