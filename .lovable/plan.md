

# Replace Confidence Score Badge with Visual Gauge

## What changes

Replace the plain text `Badge` showing "50% confidence" in the ICP Profile Summary Card header with the existing `ConfidenceMeter` circular gauge component already built at `src/components/discovery/ConfidenceMeter.tsx`.

## Single file change

**File:** `src/components/executive/ICPProfileSummaryCard.tsx`

1. Import `ConfidenceMeter` from `@/components/discovery/ConfidenceMeter`
2. Replace lines 105-108 (the `Badge` rendering `{confidenceScore}% confidence`) with:
   ```tsx
   <ConfidenceMeter confidence={confidenceScore} size="sm" reason="Based on ICP profile completeness and match data" />
   ```

This reuses the existing circular SVG gauge which already supports:
- Color coding (green >= 90, blue >= 70, yellow >= 50, orange < 50)
- Size variants (`sm` fits the card header)
- Tooltip with explanatory text on hover
- Smooth animation on the progress arc

No new components or dependencies needed.

