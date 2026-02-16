
# Major Report Overhaul: Brand Colors, ICP Profile Page, and Visual Charts

## Problems Identified from the Current PDF

1. **Brand colors not applied**: The org has `brand_primary_color: #6366f1` (indigo) and `brand_secondary_color: #818cf8`, but the PDF defaults to teal (#3CF1AE). The edge function does NOT fetch branding config -- it only gets `companyName` from the `organizations` table. The client-side `use-branded-report.ts` passes `brandConfig` to the PDF but it may be null because the hook depends on the org having data.

2. **No ICP Profile page**: The report has zero information about the ICP profile itself -- its target industries, personas (CIO, CTO, etc.), tech stack, buying signals, pain points, company sizes, geographies. This is a rich dataset (50+ job titles, 14 industries, 10 tech stack items, 8 buying signals, 8 pain points) that should have its own page.

3. **No visual charts/graphs**: The PDF only uses primitive jsPDF shapes (colored bars, rounded rectangles). None of the dashboard's Recharts visualizations (donut chart, scatter plot, bar charts, area charts) are captured for the PDF.

4. **AI prompt missing ICP detail**: The edge function only sends ICP names + top 3 industries/personas/pain points to the AI. The full richness (tech stack, buying signals, seniority levels, departments, all 50+ job titles) is not in the prompt, so the AI cannot produce ICP-specific insights.

5. **Cover page says "Launchpulse" not "LaunchPulse"**: The casing correction only happens client-side in `use-branded-report.ts`, but the branding config stores `company_name: 'Launchpulse'`.

## Changes

### 1. Edge Function: Fetch brand config + send full ICP data to AI

**File: `supabase/functions/generate-board-report/index.ts`**

- Add a query to fetch brand config from `org_onboarding_config` table (same data the RPC returns: primary/secondary colors, company name, logo URL, value proposition)
- Expand ICP profile data sent to include ALL fields: `industries`, `company_sizes`, `geographies`, `persona_job_titles`, `persona_seniority_levels`, `persona_departments`, `tech_stack`, `buying_signals`, `pain_points`, `description`, `confidence_score`
- Return brand config in the response alongside data and AI narratives
- Expand the AI prompt to include full ICP detail: all personas, tech stack, buying signals, pain points, description
- Add a new AI tool-call output field: `icp_analysis` -- a structured analysis of ICP strengths, gaps, and persona targeting strategy

### 2. PDF Generator: New "ICP Profile" page

**File: `src/utils/branded-pdf-export.ts`**

Add a new page (inserted as Page 2 or 3) titled "Ideal Customer Profile" that renders:
- Profile name and description
- Target industries as tags/pills
- Company sizes and revenue ranges
- Geographic targets
- Persona breakdown: seniority levels, departments, key job titles
- Tech stack requirements
- Buying signals and pain points
- Confidence score gauge (drawn as arc with percentage)
- AI-generated ICP analysis narrative (if available)

Update the `BrandedReportData` interface to include:
```typescript
icpProfileDetail?: {
  name: string;
  description: string;
  industries: string[];
  companySizes: string[];
  geographies: string[];
  personaJobTitles: string[];
  personaSeniorityLevels: string[];
  personaDepartments: string[];
  techStack: string[];
  buyingSignals: string[];
  painPoints: string[];
  confidenceScore: number;
};
```

Add `icpAnalysis: string` to `AIReportNarratives`.

### 3. Brand colors applied correctly throughout

**File: `src/utils/branded-pdf-export.ts`**

The `getBrandColors()` function already reads from `BrandConfig`, but the brand config needs to actually be populated. Currently, `use-branded-report.ts` fetches it via `useBrandedConfig` hook -- this should work. The issue may be timing or the edge function returning a different company name.

- In the edge function, include brand colors in the response so the client doesn't need to separately fetch them
- In `use-branded-report.ts`, prefer edge function's brand data, fallback to the hook's data
- Ensure the `companyName` casing correction handles "Launchpulse" -> "LaunchPulse"

### 4. Chart screenshots via html2canvas

**File: `src/utils/branded-pdf-export.ts`** and **`src/hooks/use-branded-report.ts`**

Since Recharts components render as SVG in the browser, we can capture chart snapshots using `html2canvas` (already installed) before generating the PDF:

- Before calling the PDF generator, render hidden chart components (ICP Donut, Score Distribution Bar, TAM Funnel) off-screen
- Capture them as base64 images using `html2canvas`
- Pass the image data into `BrandedReportData` as `chartImages?: { icpDonut?: string; scoreBar?: string; tamFunnel?: string }`
- In the PDF, embed these as `doc.addImage()` on the relevant pages

This is a significant change but leverages the existing `html2canvas` dependency. The charts will render in a hidden container, get captured, then removed from DOM.

### 5. Hook updates

**File: `src/hooks/use-branded-report.ts`**

- Extract brand config from edge function response (new `brandConfig` field in response)
- Extract full ICP profile detail from edge function response
- Pass chart images (captured client-side) into the PDF data
- Pass ICP detail into the PDF data

## Technical Summary

| File | Change Type |
|------|-------------|
| `supabase/functions/generate-board-report/index.ts` | Fetch brand config, expand ICP data to AI, add `icp_analysis` tool output |
| `src/hooks/use-branded-report.ts` | Extract brand/ICP from response, add chart capture pipeline |
| `src/utils/branded-pdf-export.ts` | New ICP Profile page, embed chart images, ensure brand colors apply |

## What the AI Will Now See (Enhanced Prompt)

```
ICP PROFILE: "Enterprise Technology & Data Infrastructure"
Description: Enterprise companies with 500+ employees in technology-intensive industries...
Target Industries: Technology, Software, Financial Services, Healthcare, Manufacturing, Education, ...
Company Sizes: 500-10,000 employees
Personas: C-Level (CIO, CTO, CDO), VP (VP Engineering, VP Cloud), Director/Manager
Departments: Engineering, IT Infrastructure, Data Science, Operations, Security, Cloud, DevOps
Tech Stack: Salesforce, HubSpot, Snowflake, AWS, Azure, Google Cloud, Kubernetes, Terraform, Databricks, Tableau
Buying Signals: Recent funding round, Leadership change, Hiring surge, Technology migration, ...
Pain Points: High cloud storage costs, Data management complexity, Slow backup/recovery, ...
Confidence: 50%
```

This gives the AI full context to produce ICP-specific recommendations like "Your ICP targets CIOs/CTOs but your top prospects are in Education and Business Services -- verify persona alignment."
