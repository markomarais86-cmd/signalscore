

# Add Table of Contents Page to Strategic Brief PDF

## Overview
Insert a new page immediately after the cover page (Page 1) that lists all report sections with their page numbers, styled consistently with the LaunchPulse brand.

## Page Structure (Current -> New)

| Current | New (with TOC) |
|---------|---------------|
| Page 1: Cover | Page 1: Cover |
| Page 2: ICP Profile | **Page 2: Table of Contents** |
| Page 3: Strategic Position | Page 3: ICP Profile |
| Page 4: Revenue Model | Page 4: Strategic Position |
| Page 5: Segment Prioritization | Page 5: Revenue Model |
| Page 6: Geographic Strategy | Page 6: Segment Prioritization |
| Page 7: Top 10 Revenue Opportunities | Page 7: Geographic Strategy |
| Page 8: Revenue Leakage and Risk | Page 8: Top 10 Revenue Opportunities |
| Page 9: Strategic Recommendations | Page 9: Revenue Leakage and Risk |
| Page 10: 90-Day Execution Plan | Page 10: Strategic Recommendations |
| | Page 11: 90-Day Execution Plan |

## Implementation

### File: `src/utils/branded-pdf-export.ts`

**What changes:**

1. After the cover page block (line ~441), insert a new TOC page with:
   - Black header bar with brand accent (matching `addHeader` style)
   - "Table of Contents" section title
   - A list of section names with dotted leader lines and page numbers
   - Sections listed conditionally (e.g., ICP Profile only if `data.icpProfileDetail` exists, Strategic Recommendations only if AI narratives exist)

2. The TOC entries will be built dynamically as an array of `{ title, page }` objects, calculated based on which conditional sections are present. Since jsPDF builds pages sequentially and some sections are conditional (ICP Profile, Strategic Recommendations), we need to pre-calculate page numbers based on which data is available.

3. Styling: Each TOC row will have the section name on the left, a dotted line leader, and the page number on the right -- all in the brand font/color scheme. Alternating light background rows for readability.

### Technical Detail

The TOC entries array will be built like this:
```text
let tocPage = 3;  // starts after cover + TOC
entries = []

if (icpProfileDetail) -> add "Ideal Customer Profile" at tocPage, tocPage++
add "Strategic Position" at tocPage, tocPage++
add "Revenue Model" at tocPage, tocPage++
add "Segment Prioritization" at tocPage, tocPage++
add "Geographic Strategy" at tocPage, tocPage++
add "Top 10 Revenue Opportunities" at tocPage, tocPage++
add "Revenue Leakage & Risk Assessment" at tocPage, tocPage++
if (strategicRecommendations) -> add "Strategic Recommendations" at tocPage, tocPage++
add "90-Day Execution Plan" at tocPage, tocPage++
```

Each entry rendered as a row with:
- Section title (left-aligned, dark text)
- Dotted leader line (light gray dots filling the gap)
- Page number (right-aligned, brand primary color)
- Alternating row backgrounds for readability

No other files need to change -- this is a self-contained addition to the PDF generator.

