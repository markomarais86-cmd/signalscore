

## Overview

This plan fixes the "pixelated icons" issue on the About page's "LaunchPulse Difference" section by replacing external SVG image URLs with crisp Lucide React vector icons, and updates the subtitle text to match the original launchpulse.org site.

## Issues Identified

1. **Pixelated Icons**: The current external SVG URLs are rendering poorly and appear pixelated
2. **Wrong Subtitle**: Current text says "Built for revenue teams who demand precision and transparency" but original says "What makes LaunchPulse different in practice"
3. **External Image Dependencies**: Using CDN-hosted images introduces loading delays and quality issues

## What We're Changing

### 1. Replace External SVG Icons with Lucide Icons

The original launchpulse.org uses clean vector icons in rounded green boxes. We'll replace the external URLs with matching Lucide React icons:

| Card | Current (External SVG) | New (Lucide Icon) |
|------|------------------------|-------------------|
| Evidence-Based ICP | icp-01.svg | `Search` (magnifying glass) |
| Explainable Diagnostics | insight-01.svg | `BarChart3` (bar chart) |
| Stack-Enhancing by Design | up-01.svg | `ArrowUpCircle` (up arrow) |
| Fast Time-to-Value | launch.svg | `Rocket` (rocket icon) |

### 2. Fix the Subtitle Text

Change from:
> "Built for revenue teams who demand precision and transparency"

To match original:
> "What makes LaunchPulse different in practice"

---

## Technical Details

### File to Modify: `src/pages/About.tsx`

**1. Import Lucide icons at the top:**
```tsx
import { Search, BarChart3, ArrowUpCircle, Rocket } from "lucide-react";
```

**2. Update the `differentiators` array to use Lucide icons:**
```tsx
const differentiators = [
  {
    icon: Search,
    title: "Evidence-Based ICP",
    subtitle: "(not opinion-based targeting)",
    description:
      "LaunchPulse derives ICP from actual CRM conversion patterns, highlighting the attributes and personas that consistently produce pipeline yield.",
  },
  {
    icon: BarChart3,
    title: "Explainable Diagnostics",
    subtitle: "(not opaque scoring)",
    description:
      "Every output is traceable—so RevOps and Sales Leadership can understand why accounts rank, where leakage occurs, and what to fix.",
  },
  {
    icon: ArrowUpCircle,
    title: "Stack-Enhancing by Design",
    subtitle: "(not a rip-and-replace platform)",
    description:
      "LaunchPulse plugs into Salesforce/HubSpot and enrichment sources to make the systems you already pay for materially smarter.",
  },
  {
    icon: Rocket,
    title: "Fast Time-to-Value",
    subtitle: "(without heavy implementation)",
    description:
      "Deploy quickly, get clarity fast, and operationalise insights immediately—without months of integration work or reporting rebuilds.",
  },
];
```

**3. Update the card rendering to use Lucide icons:**
```tsx
{differentiators.map((item, index) => {
  const Icon = item.icon;
  return (
    <div key={index} className="...">
      {/* ... background image ... */}
      <div className="relative z-10">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 bg-primary/10 border border-primary/20">
          <Icon className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-1">
          {item.title} <span className="text-white/50 font-normal">{item.subtitle}</span>
        </h3>
        <p className="text-white/70 leading-relaxed">
          {item.description}
        </p>
      </div>
    </div>
  );
})}
```

**4. Update the subtitle text (line 76-77):**
```tsx
<p className="text-xl text-white/60 max-w-2xl mx-auto">
  What makes LaunchPulse different in practice
</p>
```

---

## Visual Result

After these changes:
- Crisp, clean Lucide vector icons replace pixelated external SVGs
- Icons render as proper React components with no loading delays
- Subtitle text matches the original launchpulse.org
- Each card title includes the parenthetical subtitle matching the original format (e.g., "Evidence-Based ICP (not opinion-based targeting)")
- Consistent styling with the primary green color for icons

