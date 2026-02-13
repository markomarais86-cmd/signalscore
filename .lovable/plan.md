
# Redesign the Board PDF Report: Branded, Insightful, Story-Driven

## The Problem
The current PDF export is a bare-bones data dump with serious issues:
- **No real branding** -- just "Organization" as the company name, generic LaunchPulse colors
- **NaN values** in industry/size breakdowns (data formatting bugs)
- **No AI insights or recommendations** -- the most valuable part of the dashboard is missing
- **No storytelling** -- just raw tables with no narrative or executive summary
- **No risks/actions** -- the risk detection and AI insights that power the dashboard are absent
- **Poor visual design** -- plain tables, no charts or visual hierarchy

## What the New Report Will Include

The redesigned PDF will be an 8-page executive board report that tells a data-driven story:

### Page 1: Cover Page (improved)
- Customer's logo (properly sized) and company name from brand config
- Report title with date
- Branded color scheme from org's brand_primary_color/brand_secondary_color

### Page 2: Executive Summary with Narrative
- Key metrics cards (same as now, but with bug fixes)
- **NEW: AI-generated narrative paragraph** summarizing the state of the pipeline ("Your ICP analysis covers 14,360 accounts. 62% are high-fit, indicating strong market alignment. Key opportunity: 8,972 accounts match your ideal profile...")
- Score distribution bar (existing, improved)

### Page 3: ICP Profile Deep Dive
- Profile table (fix confidence display -- currently shows "5000%" instead of "50%")
- **NEW: Per-profile insight** -- target industries, geographies, and match quality narrative

### Page 4: TAM/SAM/SOM with Visual Funnel
- Fix NaN bug in industry/size breakdowns (account values stored as strings in JSONB)
- **NEW: Visual funnel diagram** showing TAM > SAM > SOM progression
- Industry and size tables (with NaN fix)

### Page 5: Geographic Analysis
- Fix 0-count geography display (country codes like "Gb", "Es" need normalization)
- Top markets with percentage bars

### Page 6: Top Prospects (fix empty state)
- The data fetch uses `overall_score` column but the scores table may use `overall` -- will verify and fix
- Show actual scored accounts with fit/intent/overall scores

### Page 7: AI Insights and Recommendations (NEW)
- Pull insights from the `generate-icp-insights` edge function (same data as UnifiedInsightsPanel)
- Group by priority: Critical, High, Medium
- Each insight shows: title, description, impact, recommended action
- Risk items from `detectRisks()` included with severity badges

### Page 8: Strategic Next Steps (NEW)
- Data quality summary with completeness score
- Actionable recommendations based on risks detected
- "Prepared by [Company Name] using LaunchPulse" footer branding

## Technical Changes

### File 1: `src/utils/branded-pdf-export.ts` (major rewrite)
- Add `insights` and `risks` fields to `BrandedReportData` interface
- Fix NaN bug: parse JSONB breakdown values with `Number()` fallback to 0
- Fix confidence display: values are 0-1 decimals, not percentages (remove extra *100)
- Add Page 7 (AI Insights) and Page 8 (Next Steps) rendering
- Add executive narrative generator function that creates a plain-English summary from the metrics
- Improve visual design: better spacing, colored score badges, section dividers
- Add visual funnel for TAM/SAM/SOM using colored rectangles

### File 2: `src/hooks/use-branded-report.ts` (add insight fetching)
- Fetch AI insights by invoking `generate-icp-insights` edge function during report generation
- Fetch risks using `detectRisks()` utility
- Pass insights and risks data into `BrandedReportData`
- Fix score column reference (verify `overall_score` vs `overall`)

### File 3: `src/components/executive/ExportToPdf.tsx` (minor)
- No structural changes needed, but will pass insights loading state if needed

## Data Bug Fixes
- **NaN in industry/size**: The JSONB `industry_breakdown` stores values that need explicit `Number()` conversion -- already done in the hook but the values themselves may be objects not numbers
- **Confidence 5000%**: `p.confidence_score` is likely stored as a raw number (e.g., 50) not a 0-1 decimal, so `Math.round(p.confidence * 100)` produces 5000. Fix: cap at 100 or detect scale
- **Empty geography**: The RPC `get_geography_distribution` with `p_source_filter: 'crm'` may return 0 counts if data is in the 'database' source -- will use the same source filter logic as the dashboard
- **Empty top prospects**: The `overall_score` column name needs verification against the actual scores table schema
