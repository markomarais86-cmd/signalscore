

# AI-Powered Board Report Generation via Lovable AI

## Current State

The board PDF report is generated entirely client-side using jsPDF (842 lines of manual coordinate math in `branded-pdf-export.ts`). The hook `use-branded-report.ts` fetches ~11 data sources in parallel from the browser, assembles them into a `BrandedReportData` object, then passes it to `generateBrandedPDF()` which manually draws every pixel.

**Problems with this approach:**
- The narrative/summary is static or rule-based -- no real AI intelligence
- Layout is brittle (manual x/y coordinates in jsPDF)
- Adding new sections requires significant coordinate math
- No ability for the AI to reason about patterns, anomalies, or strategic recommendations

## New Approach: AI-Generated Report via Edge Function

Move the entire report generation server-side into a new edge function that:
1. Fetches all data from Supabase (same queries, but server-side with service role key)
2. Sends the assembled data to Lovable AI (Gemini) to generate a rich, structured report narrative
3. Uses jsPDF server-side (or returns structured JSON for client-side PDF rendering)

Since jsPDF doesn't run well in Deno, the best approach is: **AI generates structured report content server-side, client renders the PDF.**

## Architecture

**Edge Function: `generate-board-report`**
- Receives `{ org_id }` from the client
- Fetches all data server-side (accounts, scores, ICP profiles, signals, leads, industry breakdown, geo distribution, etc.)
- Calls Lovable AI Gateway with tool calling to produce structured output:
  - Executive summary (2-3 paragraphs)
  - Key findings (prioritized list)
  - Strategic recommendations
  - Risk assessment with severity
  - TAM/SAM/SOM narrative interpretation
  - Industry and geo insights
- Returns the full data bundle + AI-generated narratives as JSON

**Client-side changes:**
- `use-branded-report.ts` calls the edge function instead of fetching data directly
- `branded-pdf-export.ts` receives the AI narratives and renders them into the PDF alongside the data visualizations
- The AI summary replaces the static/rule-based text currently used

## Changes

### 1. New file: `supabase/functions/generate-board-report/index.ts`

- Fetch all 11 data sources server-side (migrating queries from `use-branded-report.ts`)
- Call Lovable AI Gateway with structured tool calling:
  - Tool: `generate_board_report` with properties for `executive_summary`, `key_findings[]`, `strategic_recommendations[]`, `risk_assessment[]`, `industry_insights`, `geo_insights`, `tam_narrative`
- Model: `google/gemini-3-flash-preview`
- System prompt guides the AI to act as a board-level strategic analyst
- Handle 429/402 errors gracefully
- Return combined `{ data: BrandedReportData, ai_narratives: {...} }` JSON

### 2. Modified file: `src/hooks/use-branded-report.ts`

- Remove all direct Supabase queries (the ~200 lines of data fetching)
- Replace with a single `supabase.functions.invoke('generate-board-report', { body: { org_id } })`
- Pass the response to the PDF generator
- Keep logo-to-base64 conversion client-side (needs DOM canvas)

### 3. Modified file: `src/utils/branded-pdf-export.ts`

- Add `aiNarratives` field to `BrandedReportData` interface:
  - `executiveSummary: string`
  - `keyFindings: Array<{ title: string; detail: string; impact: string }>`
  - `strategicRecommendations: Array<{ action: string; rationale: string; priority: string }>`
  - `riskAssessment: Array<{ risk: string; severity: string; mitigation: string }>`
  - `industryInsights: string`
  - `geoInsights: string`
  - `tamNarrative: string`
- Replace hardcoded summary text with `data.aiNarratives.executiveSummary`
- Replace static risk section with AI-generated risk assessment
- Add a "Strategic Recommendations" page using AI output
- Keep all visual elements (charts, tables, funnel) data-driven as-is

### 4. New file: `supabase/functions/generate-board-report/config` entry

- Add to `config.toml` with `verify_jwt = true`

## What the AI Will See (Prompt Context)

The edge function will feed the AI a structured data summary like:

```
You are a board-level strategic analyst for {companyName}.
Analyze this data and produce a board report:

- Total Accounts: 1,247 | Scored: 892 | High-Fit: 234
- TAM: $12.4M | SAM: $5.1M | SOM: $1.8M
- Top Industries: Technology (34%, avg score 72), Healthcare (18%, avg score 65)
- Top Geographies: US (45%), UK (12%), Germany (8%)
- Data Completeness: 78%
- 156 unscored accounts, 43 with low data quality
- ICP Profile: "Enterprise SaaS" targeting Technology, Healthcare...
- Top Prospect: Acme Corp (score 94, fit 88, intent 91)
- Signals: 12 critical, 28 high priority this period
```

The AI will reason over this to produce insights like concentration risk, geographic expansion opportunities, data quality impact on pipeline, etc.

## No Breaking Changes

- The ExportToPdf dropdown component stays the same
- The PDF visual format stays the same (same jsPDF rendering)
- The AI just provides better, contextual narrative content instead of static text

