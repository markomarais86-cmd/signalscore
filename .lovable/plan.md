

## Overview

This plan improves the "Built for GTM Teams" section on the Product page by replacing external SVG icons with crisp Lucide React icons, and enhancing the card styling for a cleaner, more professional appearance.

## Issues Identified

1. **External SVG Icons**: Using CDN-hosted images that may render inconsistently
2. **Basic Card Styling**: Cards lack visual polish and depth
3. **Icon Container Size**: Could be refined for better proportions

## What We're Changing

### 1. Replace External SVG Icons with Lucide Icons

| Card | Current (External SVG) | New (Lucide Icon) |
|------|------------------------|-------------------|
| RevOps | graph.svg | `TrendingUp` (analytics/charts) |
| Sales Leadership | pipeline.svg | `Filter` (funnel/pipeline) |
| Executives | executives.svg | `UserCircle` (executive profile) |

### 2. Enhanced Card Styling

- Increase icon container size for better visual weight
- Add subtle hover effects for interactivity
- Improve spacing and typography hierarchy
- Make the icon background consistent with other sections

---

## Technical Details

### File to Modify: `src/pages/Product.tsx`

**1. Import additional Lucide icons (update line 4-13):**
```tsx
import {
  Target,
  BarChart3,
  Users,
  ShieldCheck,
  Zap,
  TrendingUp,
  Filter,
  UserCircle,
} from "lucide-react";
```

**2. Update the `useCases` array (lines 110-129) to use Lucide icons:**
```tsx
const useCases = [
  {
    icon: TrendingUp,
    title: "RevOps",
    description:
      "Validate ICP/TAM assumptions, identify leakage points in your funnel, and build data-backed business cases for leadership.",
  },
  {
    icon: Filter,
    title: "Sales Leadership",
    description:
      "See where your team's effort is misallocated, which segments have thin coverage, and where to focus for maximum impact.",
  },
  {
    icon: UserCircle,
    title: "Executives",
    description:
      "Get a clear diagnostic view of your market opportunity and where GTM execution is leaving revenue on the table.",
  },
];
```

**3. Update the card rendering (lines 278-292) with improved styling:**
```tsx
<div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
  {useCases.map((useCase, index) => {
    const Icon = useCase.icon;
    return (
      <div
        key={index}
        className="p-8 rounded-xl border border-white/10 bg-white/5 text-center animate-fade-in hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300"
        style={{ animationDelay: `${0.1 * index}s` }}
      >
        <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-6 bg-primary/10 border border-primary/20 mx-auto">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-3 text-white">{useCase.title}</h3>
        <p className="text-white/60 leading-relaxed">{useCase.description}</p>
      </div>
    );
  })}
</div>
```

---

## Visual Result

After these changes:
- Crisp, clean Lucide vector icons replace potentially pixelated external SVGs
- Slightly larger icon containers (16x16 instead of 14x14) for better visual impact
- Subtle hover effects add interactivity and polish
- Consistent styling with other sections on the page
- Faster loading with no external image dependencies
- Improved text contrast with explicit `text-white` on titles

