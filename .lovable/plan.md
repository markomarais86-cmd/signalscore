

# Dashboard Typography & Visual Quality Overhaul

## Problems Identified

1. **Text is too small across the board** — KPI labels at 11px, sub-text at 12px, widget content at 12-13px. Everything feels cramped and hard to read.
2. **Grey lines everywhere** — Every list row (geography, ICP breakdown, health bars, source rows) has individual `border border-border/70` creating a "spreadsheet" look instead of a clean dashboard.
3. **Low contrast text** — Aggressive opacity reduction (`text-muted-foreground/70`, `/55`, `/80`) makes text nearly invisible in dark mode.
4. **Font loading conflict** — Geist is imported twice (Google Fonts CSS import + Vercel CDN link tag) and Google Fonts doesn't actually serve Geist, causing fallback flicker.
5. **Inconsistent type scale** — metric values jump between `1.4rem`, `1.65rem`, `1.9rem`, `2.1rem`, `2.65rem`, `3rem` with no clear hierarchy.

## Plan

### 1. Fix font loading (index.css + index.html)
- Remove the `@import` for Geist from `index.css` (Google Fonts doesn't serve it — keep only the Vercel CDN `<link>` in `index.html`)
- Keep DM Sans from Google Fonts

### 2. Bump all text sizes up one tier (all dashboard components)
- KPI labels: `11px` → `13px`, remove uppercase tracking
- KPI values: `1.9rem/2.1rem` → `2.2rem/2.5rem`
- KPI sub-text: `12px` → `13px`
- Widget eyebrow: `10px` → `11px`
- Widget title: `1rem` → `1.15rem`
- Section kicker: stays `11px` (it's a label)
- Section title: `1.25rem` → `1.5rem`
- All row text (geography, ICP, health): `12-13px` → `14px`
- Metric panel labels: `11px` → `12px`
- Metric panel values: `1.65rem` → `1.85rem`

### 3. Remove individual row borders — use spacing instead (index.css + components)
- Remove `border border-border/70` from geography rows, ICP breakdown rows, health bars, and source rows
- Use `gap` spacing and subtle `hover:bg` instead of bordered cards-within-cards
- Keep the outer `.widget-card` border — remove inner row borders
- Simplify `.source-row` and `.metric-panel` to borderless with only hover background

### 4. Fix text contrast (all components)
- Replace `text-muted-foreground/70` → `text-muted-foreground`
- Replace `text-muted-foreground/80` → `text-muted-foreground`
- Replace `text-foreground/88` → `text-foreground`
- Replace `text-muted-foreground/55` → `text-muted-foreground/80`
- Ensure all body text meets WCAG AA on dark backgrounds

### 5. Standardize type scale (index.css)
- Define 4 clear tiers: Hero metric (`2.5rem`), Card metric (`1.85rem`), Body (`14px`), Label (`12px`)
- Update `.metric-panel__value`, `.hero-stat__value`, KPI value classes to use these tiers consistently

### Files Changed
- `src/index.css` — font import fix, type scale, remove row borders from `.source-row` and `.metric-panel`
- `src/components/executive/GrowthCommandKPIs.tsx` — bump label/value/sub sizes, fix contrast
- `src/components/executive/ICPCoveragePanel.tsx` — remove row borders, bump text sizes, fix contrast
- `src/components/executive/DataHealthWidget.tsx` — remove row borders, bump text sizes
- `src/components/executive/SimpleGeographyCard.tsx` — remove row borders, bump text sizes
- `src/components/executive/SimpleICPTable.tsx` — bump text sizes, fix contrast
- `src/components/executive/SimpleTAMCard.tsx` — bump text sizes
- `src/components/executive/DashboardContent.tsx` — update section header sizes
- `src/components/executive/DashboardHeroBanner.tsx` — bump stat text sizes

