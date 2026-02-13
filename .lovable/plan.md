

# Branded PDF Report Exports

## Overview

Create a comprehensive, client-branded PDF report generator that produces professional consulting deliverables. The report will pull data from the currently selected organization (via the org-switcher) and apply that organization's branding (logo, colors, company name) to every page. This replaces the existing hardcoded "LaunchPulse navy/green" styling in the current PDF generators.

## What Exists Today

- **Two PDF generators** (`src/utils/pdf-export.ts` and `src/utils/icp10-pdf-export.ts`) using jsPDF, both hardcoded with LaunchPulse brand colors
- **Brand config system** (`useBrandedConfig` hook) that fetches `brand_primary_color`, `brand_secondary_color`, `logo_url`, and `company_name` per org
- **Dashboard data hooks** that provide all the raw data: metrics, ICP profiles, TAM data, geography distribution, scores
- **Export dropdown** (`ExportToPdf.tsx`) in the executive dashboard header with PDF/PPTX/CSV options (PPTX and CSV marked "Soon")

## Report Structure (6-page PDF)

```text
Page 1 - Cover Page
  Client logo (fetched from logo_url) + company name
  "ICP & Market Intelligence Report"
  Prepared by LaunchPulse | Date
  Branded header bar using client's primary color

Page 2 - Executive Summary
  Key metrics grid: Total Accounts, Scored Accounts, High-Fit %
  ICP profile count + active profiles listed
  Data completeness score
  Quick-view score distribution (high/medium/low fit)

Page 3 - ICP Profile Summary
  Table of all active ICP profiles with:
    Name, target industries, company sizes, geographies
    Match count, TAM estimate, confidence score

Page 4 - TAM / SAM / SOM Analysis
  TAM: Total external database accounts (from external_data_sources)
  SAM: Accounts matching active ICP criteria (high + medium fit)
  SOM: High-fit accounts with qualified leads (campaign-ready)
  Industry breakdown table (top 10)
  Company size breakdown table

Page 5 - Geographic Analysis
  Country distribution table (top 15)
  Concentration metrics (top 3 country %)
  Regional summary

Page 6 - Top Prospects
  Top 20 accounts ranked by overall score
  Columns: Name, Industry, Size, Country, Fit Score, Intent, Overall
```

## New Files

### 1. `src/utils/branded-pdf-export.ts`

The main PDF generation engine. Key design decisions:

- **Accepts a `BrandConfig` parameter** to dynamically set header color, footer text, and cover logo
- **Accepts all data as a single typed interface** (`BrandedReportData`) so the caller gathers data, not the PDF util
- **Reuses `jsPDF`** (already installed) -- no new dependencies
- **Logo handling**: Fetches the `logo_url` as an image, converts to base64 via canvas, and embeds in the PDF cover page. Falls back to text-only if logo fails to load
- **Color system**: Parses `brand_primary_color` (hex string) into RGB for jsPDF fill/draw calls. Falls back to LaunchPulse navy if no brand color
- **TAM/SAM/SOM calculation**: TAM = total external DB accounts, SAM = high + medium fit accounts, SOM = campaign-ready accounts. These are derived from the dashboard metrics already available

### 2. `src/hooks/use-branded-report.ts`

A hook that orchestrates data gathering and PDF generation:

- Uses `useEffectiveOrg()` to get the current org ID
- Uses `useBrandedConfig({ orgId })` to get brand colors/logo
- Fetches dashboard data, geography data, ICP profiles, and top accounts (by score)
- Exposes a `generateReport()` async function and `isGenerating` loading state
- Handles the logo-to-base64 conversion
- Calls the `generateBrandedPDF()` util with all assembled data

## Modified Files

### 3. `src/components/executive/ExportToPdf.tsx`

- Wire the `'pdf'` menu item to call the new `use-branded-report` hook's `generateReport()` function
- Show a loading spinner on the button while generating
- Remove "(Soon)" from PDF option if present, keep it on PPTX/CSV

### 4. `src/utils/pdf-export.ts` (minor)

- Refactor to accept optional brand colors parameter instead of hardcoded LaunchPulse colors
- This way the existing TAM report also gets branded when called from the new flow

### 5. `src/utils/icp10-pdf-export.ts` (minor)

- Same brand-color parameterization as above

## Technical Details

### Brand Color Parsing
```text
Input:  "#3B82F6" (from brand_primary_color)
Output: [59, 130, 246] (RGB array for jsPDF)
Fallback: [8, 51, 105] (LaunchPulse navy)
```

### Logo Embedding
```text
1. Fetch logo_url via Image() with crossOrigin="anonymous"
2. Draw to offscreen canvas
3. Convert to base64 PNG via canvas.toDataURL()
4. Embed in jsPDF via doc.addImage()
5. Fallback: render company_name as large text if logo fails
```

### Data Flow
```text
User clicks "Export Report" > "Board PDF Report"
  -> useEffectiveOrg() provides orgId
  -> useBrandedConfig({ orgId }) provides brand colors + logo
  -> Parallel fetch: dashboard metrics, geography, top accounts by score
  -> Assemble BrandedReportData object
  -> generateBrandedPDF(data, brandConfig) creates the jsPDF doc
  -> doc.save() triggers browser download
```

### TAM/SAM/SOM Derivation (from existing dashboard metrics)
```text
TAM = tamData.totalAccounts (external database size)
SAM = metrics.high_fit_accounts + metrics.medium_fit_accounts
SOM = metrics.campaign_ready_accounts
```

## Implementation Order

1. Create `src/utils/branded-pdf-export.ts` with the 6-page branded PDF generator
2. Create `src/hooks/use-branded-report.ts` to orchestrate data fetching and generation
3. Update `ExportToPdf.tsx` to wire the PDF button to the new hook
4. Optionally refactor the two existing PDF utils to accept brand colors (can be done later)

