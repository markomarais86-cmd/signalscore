

## Fix Missing Slide Data + Add Slide Export

### Two Issues to Address

**Issue 1: Slides showing no data for Industry, Geography, Top Prospects, Risks, and Next Steps**

The console logs show `FunctionsFetchError: Failed to send a request to the Edge Function` -- the `generate-board-report` edge function call is failing entirely, so the deck never loads any data. The slide components themselves are correctly wired to display the data when present.

However, the slides also lack empty-state handling -- if any data array happens to be empty (e.g., no risks detected, no geography data), the slides show a blank white area with just a title. We should add graceful empty states to each slide.

**Issue 2: No way to export/download the slides**

Currently the slide deck only supports in-app viewing and fullscreen presentation. There's no download/export option. We'll add a **"Download PDF"** button to the toolbar that captures each slide as an image and compiles them into a multi-page PDF.

---

### Changes

#### 1. Add empty states to slides that may have no data

Update these 5 slide components to show a helpful message when their data arrays are empty:

- **IndustrySlide** -- "No industry data available yet. Score accounts to see industry breakdown."
- **GeographySlide** -- "No geography data available yet."
- **ProspectsSlide** -- "No scored accounts yet. Run scoring to see top prospects."
- **RisksSlide** -- "No risks identified -- your data quality looks good!"
- **CTASlide** -- Already has a fallback (the "Ready to accelerate" message), no change needed.

#### 2. Add PDF export to the SlideDeck toolbar

Add a "Download PDF" button next to the "Present" button in the toolbar. This will:

- Iterate through all 9 slides
- Render each at 1920x1080 using `html2canvas` (already installed)
- Compile into a landscape PDF using `jsPDF` (already installed)
- Download as `{companyName}-pitch-deck.pdf`

**Files to create:**
| File | Purpose |
|------|---------|
| `src/utils/slide-pdf-export.ts` | Utility function that takes a container ref, renders each slide to canvas, and builds the PDF |

**Files to modify:**
| File | Change |
|------|--------|
| `src/components/slides/slides/IndustrySlide.tsx` | Add empty state when `industryBreakdown` is empty |
| `src/components/slides/slides/GeographySlide.tsx` | Add empty state when `geographyDistribution` is empty |
| `src/components/slides/slides/ProspectsSlide.tsx` | Add empty state when `topProspects` is empty |
| `src/components/slides/slides/RisksSlide.tsx` | Add empty state when no risks exist |
| `src/components/slides/SlideDeck.tsx` | Add "Download PDF" button to toolbar, implement export logic |

### Technical Approach for PDF Export

The export will temporarily render each slide off-screen at full 1920x1080 resolution, capture it with `html2canvas`, then add each capture as a page in a landscape jsPDF document. This reuses the existing `html2canvas` and `jspdf` dependencies already in the project.

```text
User clicks "Download PDF"
  --> Show loading spinner on button
  --> For each slide in SLIDE_ORDER:
       --> Render SlideRenderer into a hidden div (1920x1080)
       --> html2canvas captures it as a canvas
       --> Add canvas as JPEG page to jsPDF
  --> Save PDF as "{companyName}-pitch-deck.pdf"
  --> Remove loading spinner
```

### Edge Function Error

The `FunctionsFetchError` in console is a separate issue -- the `generate-board-report` edge function may need redeployment or the user may need to be logged in. The empty states will at least ensure the slides degrade gracefully when data is missing, rather than showing blank content.

