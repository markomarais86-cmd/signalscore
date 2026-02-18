

## Lovable Slides: In-App Pitch Deck (Replacing PowerPoint Export)

### Overview

Replace the "PowerPoint (Soon)" placeholder in the Export Report dropdown with a **"Pitch Deck"** option that opens a fullscreen, in-app slide presentation built from dashboard data. This uses the same data pipeline as the Board PDF Report but renders it as interactive slides instead of a static file.

### What You'll Get

- A "Pitch Deck" menu item replaces "PowerPoint (Soon)" in the Export dropdown
- Clicking it navigates to `/presentations` -- a fullscreen slide deck auto-generated from your org's data
- Slides include: Title/Cover, ICP Summary, Fit Distribution, TAM/SAM/SOM, Geography, Top Prospects, Risks, and a Call-to-Action
- Fullscreen presentation mode (F5 or "Present" button) with keyboard navigation
- Slide thumbnails sidebar for quick navigation
- Branded with your org logo and colors (same brand config as PDF report)

### Slide Content (auto-generated from dashboard data)

1. **Cover Slide** -- Company logo, name, date, "Market Intelligence Report"
2. **Executive Summary** -- AI-generated narrative (reuses `generate-board-report` edge function)
3. **ICP Fit Distribution** -- Donut chart with High/Medium/Low counts
4. **TAM / SAM / SOM** -- Revenue opportunity funnel
5. **Industry Breakdown** -- Bar chart of top industries
6. **Geography Distribution** -- Top countries/regions table
7. **Top 10 Prospects** -- Table with fit scores and estimated value
8. **Risks and Actions** -- Key risks with mitigations
9. **Next Steps / CTA** -- Strategic recommendations

---

### Technical Plan

#### New Files

| File | Purpose |
|------|---------|
| `src/pages/Presentations.tsx` | Page component, fetches data via `generate-board-report` edge function, builds slide array |
| `src/components/slides/SlideLayout.tsx` | 1920x1080 scaled wrapper (the core scaling logic) |
| `src/components/slides/SlideRenderer.tsx` | Renders a single slide by type (cover, chart, table, etc.) |
| `src/components/slides/SlideDeck.tsx` | Main deck controller: sidebar thumbnails, canvas, toolbar, keyboard nav |
| `src/components/slides/FullscreenPresenter.tsx` | Fullscreen API wrapper with black background, hidden cursor |
| `src/components/slides/slides/*.tsx` | Individual slide templates (CoverSlide, ICPFitSlide, TAMSlide, etc.) |
| `src/components/slides/slide-styles.css` | Scoped font scaling for `.slide-content` |
| `src/hooks/use-slide-deck.ts` | Hook to fetch report data and transform it into slide definitions |

#### Modified Files

| File | Change |
|------|--------|
| `src/components/executive/ExportToPdf.tsx` | Replace "PowerPoint (Soon)" with "Pitch Deck" that navigates to `/presentations` |
| `src/App.tsx` | Add `/presentations` route |

#### Architecture

```text
ExportToPdf dropdown
  |
  +--> "Board PDF Report" (existing, unchanged)
  +--> "Pitch Deck" --> navigate('/presentations')
  +--> "Raw Data CSV (Soon)" (unchanged)

/presentations page
  |
  +--> useSlideDeck(orgId)
  |      |
  |      +--> supabase.functions.invoke('generate-board-report')
  |      +--> transforms response into Slide[] array
  |
  +--> SlideDeck component
         |
         +--> Toolbar (back button, present, slide count)
         +--> Sidebar (thumbnails via SlideLayout at small scale)
         +--> Canvas (SlideLayout at fit-to-viewport scale)
         +--> FullscreenPresenter (on "Present" click)
```

#### Scaling Approach

All slides render at a fixed 1920x1080 resolution and scale to fit the container using CSS transforms:

```text
Container size (e.g. 1200x675)
  --> scaleX = 1200/1920 = 0.625
  --> scaleY = 675/1080 = 0.625
  --> scale = min(scaleX, scaleY)
  --> slide is centered with transform-origin: center
```

#### Data Reuse

The pitch deck reuses the **same `generate-board-report` edge function** that powers the Board PDF. No new backend work needed. The hook transforms `BrandedReportData` into slide definitions:

```text
BrandedReportData --> useSlideDeck() --> Slide[]
  where Slide = { type: 'cover' | 'icp' | 'tam' | ... , data: {...} }
```

#### Keyboard Navigation

- Arrow keys / Space: next/previous slide
- Escape: exit fullscreen
- F5: enter fullscreen presentation
- G: toggle grid/overview mode

### Implementation Order

1. Create `SlideLayout` scaling component and CSS
2. Build individual slide templates (cover, ICP, TAM, geography, prospects, risks)
3. Create `SlideDeck` controller with sidebar + canvas
4. Create `useSlideDeck` hook (calls existing edge function, maps to slides)
5. Create `Presentations` page
6. Add route to `App.tsx`
7. Update `ExportToPdf` dropdown to link to pitch deck
8. Add fullscreen presentation mode

