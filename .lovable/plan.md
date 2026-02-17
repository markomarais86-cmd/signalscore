

# Fix Lead Details Panel Layout

## Problem
The lead details slide-out panel is too cramped. The 2-column grid causes text overlap (email bleeds into phone), and fields like company name get squeezed. This happens because the panel renders narrower than the `w-[600px]` on smaller viewports.

## Changes

**File: `src/pages/Leads.tsx`**

1. **Make the SheetContent width responsive** -- Change `w-[600px] sm:w-[700px]` to `w-full sm:w-[540px] md:w-[640px]` so on mobile it takes full width gracefully, and on desktop it has comfortable sizing.

2. **Add `truncate` to overflowing text fields** -- The email and company fields can be long. Add `truncate` class to `<p>` elements in the Lead Information and Company Overview grids so text doesn't overflow into adjacent columns.

3. **Make grid columns responsive** -- Change `grid-cols-2` to `grid-cols-1 sm:grid-cols-2` on the Lead Information and Company Overview grids (lines 835, 874) so on very narrow screens the fields stack vertically.

4. **Add `break-all` or `break-words`** -- For the email field specifically, add `break-all` so long email addresses wrap instead of overlapping.

## Specific line changes

- **Line 811**: `w-full sm:w-[540px] md:w-[640px] overflow-y-auto`
- **Line 835**: `grid grid-cols-1 sm:grid-cols-2 gap-4`
- **Line 838**: Add `truncate` or `break-all` to email `<p>`
- **Line 874**: `grid grid-cols-1 sm:grid-cols-2 gap-4`
- **Line 877**: Add `truncate` to company name `<p>`
- **Lines 948, 976**: Same responsive grid treatment for enrichment data grids

No new dependencies. Single file change.

