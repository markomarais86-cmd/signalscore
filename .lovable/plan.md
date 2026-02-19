

## Remove "Other (Non-ICP)" from Industry Slide

### Problem

The Segment Prioritization slide (page 8) shows an "Other (Non-ICP)" row with 919 accounts that are irrelevant to 91.Life's healthcare ICP. The user wants the industry slide to show ONLY ICP-relevant industries -- no "Other" bucket.

Additionally, the report was generated before the server-side RPC fix deployed, so all numbers are still capped at ~1,000 rows. Re-generating after this fix will show the correct counts (e.g., 1,113 for "Hospitals & Physicians Clinics" instead of 33).

### What Will Change

The "Other (Non-ICP)" aggregation row will be completely removed from the industry breakdown. After re-generating, the slide will show:

| Industry | Accounts | Hi-Fit |
|---|---|---|
| Hospitals & Physicians Clinics | 1,113 | 675 |
| Hospitals & Healthcare | 273 | 148 |
| Healthcare Services | 223 | 131 |
| Hospitals and Health Care | 100 | 1 |
| Healthcare | 6 | 5 |

No "Other (Non-ICP)" row at all.

### Technical Change

**File: `supabase/functions/generate-board-report/index.ts`** (lines 279-298)

Remove the code that aggregates non-ICP industries into an "Other (Non-ICP)" bucket. Instead, simply filter the breakdown to only include ICP-matching industries and discard everything else.

Current code builds an "Other (Non-ICP)" entry from all non-matching industries and appends it. The fix removes that aggregation entirely -- `industryBreakdown` will contain only the ICP-matched rows.

### No Frontend Changes

The `IndustrySlide` component already renders whatever data is in `industryBreakdown`. Removing the "Other" row from the data is sufficient.

