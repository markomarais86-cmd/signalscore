

# Board Report Overhaul: From Analytics Export to Strategic Intelligence Document

## The Problem

The current Board PDF is a data dump: it shows what data exists, not what to do with it. It lacks revenue framing, strategic narrative, decision logic, and time horizon. Every page needs to shift from "descriptive" to "prescriptive."

## The Fix: New 8-Page Structure

The entire report restructure follows this story arc:
1. Where we are (revenue-framed position)
2. Where we can go (monetized opportunity)
3. What is blocking us (quantified risk)
4. What we are doing about it (90-day action plan)

## Page-by-Page Redesign

### Page 1: Cover (Minor Update)
- Change subtitle from "ICP & Market Intelligence Board Report" to "Strategic Growth Intelligence Brief"
- Add a one-line strategic thesis below the date (e.g., "Revenue potential of $X across Y high-fit accounts")

### Page 2: Strategic Position (Replaces "Executive Summary")
- Title: "Strategic Position"
- Lead with a **revenue-framed narrative** instead of account counts:
  - "Your addressable pipeline contains $XXM in modelled revenue across X,XXX high-fit accounts. Of these, X,XXX are campaign-ready, representing $XXM in near-term pipeline at 15% conversion and $75K ACV."
- Replace raw metric cards with 4 **strategic KPIs**:
  1. Pipeline Potential: `campaignReadyAccounts * averageDealSize * conversionRate` (the SOM value)
  2. Revenue at Risk: `(unscoredAccounts + lowDataAccounts) * averageDealSize * conversionRate` (what's being lost to data gaps)
  3. Market Coverage: `scoredAccounts / totalAccounts` as a percentage
  4. Data Readiness: `dataCompleteness%`
- Keep score distribution bar but add dollar values to each segment

### Page 3: Revenue Model (NEW - Replaces ICP Profile Deep Dive)
- Title: "Revenue Model"
- **TAM/SAM/SOM funnel with dollar values** (not just account counts):
  - TAM: `totalAccounts * averageDealSize` = $X.XB
  - SAM: `(highFit + mediumFit) * averageDealSize` = $XXM
  - SOM: `campaignReady * averageDealSize * conversionRate` = $XXM
- Assumptions box showing ACV and conversion rate used
- This replaces the current broken TAM page where SOM=0

### Page 4: Segment ROI Ranking (Replaces Industry Breakdown)
- Title: "Segment Prioritization"
- Table with columns: Industry, Accounts, High-Fit %, Avg Score, Modelled Revenue, Penetration Rate, Recommended Action
- Modelled Revenue per industry = `highFitAccounts * avgDealSize * conversionRate`
- High-Fit % = industry's high-fit / total in that industry (shows concentration)
- Recommended Action derived from data: "Invest" (high fit% + high count), "Harvest" (high fit% + low count), "Deprioritize" (low fit%)
- Sort by modelled revenue descending

### Page 5: Geographic Strategy (Replaces Geographic Distribution)
- Title: "Geographic Strategy"
- Same bar chart but add strategic labels:
  - Tag each country as: "Core" (>10% share + high avg score), "Growth" (low share + high score), "Review" (high share + low score)
- Show modelled revenue per geography
- One-line strategic interpretation for top 3 markets

### Page 6: Priority Accounts (Enhanced)
- Title: "Top 10 Revenue Opportunities"
- Add columns: Estimated Deal Value (from revenue_range midpoint), Stage Readiness (based on intent score: "Ready" >= 60, "Warming" >= 40, "Nurture" < 40), Lead Density (lead count), Next Action
- Next Action derived from scores: intent >= 60 = "Engage Now", fit high + intent low = "Warm with Content", low lead count = "Source Contacts"

### Page 7: Risk & Leakage (Replaces AI Insights + Risks)
- Title: "Revenue Leakage & Risk"
- **Leakage Value** prominently displayed: `unscoredAccounts * avgDealSize * conversionRate`
- Quantified risk items with dollar impact
- Keep existing risk detector output but frame each risk with revenue impact
- AI Insights condensed to top 3, each rewritten as conclusions not suggestions:
  - Instead of "Analyze win rates by industry" say "Manufacturing converts at 2.4x the median -- reallocate SDR capacity"

### Page 8: 90-Day Action Plan (NEW - Replaces empty space)
- Title: "90-Day Execution Plan"
- 3 time-boxed phases:
  - **Days 1-30**: Score remaining X,XXX accounts, enrich top X,XXX high-fit accounts missing data
  - **Days 31-60**: Launch campaigns targeting X,XXX campaign-ready accounts ($XXM pipeline)
  - **Days 61-90**: Expand into underserved segments (named), source contacts for high-fit accounts with <2 leads
- Each phase shows: Action, Target Count, Revenue Impact, Owner placeholder

## Data Sources (Already Available)

All data needed is already in the database:
- **Revenue modeling**: 97% of accounts have `revenue_range` (38,730 of 39,928). Use midpoint of range as proxy for deal size.
- **Industry scoring**: Industry-level high-fit rates and avg scores already queryable
- **Geographic scoring**: Available via `get_geography_distribution` RPC
- **Pipeline math**: `SimpleTAMCard` already does TAM/SAM/SOM with `averageDealSize=75000` and `conversionRate=0.15` -- reuse this logic
- **Risk quantification**: `risk-detector.ts` already has severity and counts -- add dollar multiplier

## Revenue Range Midpoint Mapping

Used to convert `revenue_range` strings into dollar values for modeling:

| Range | Midpoint |
|-------|----------|
| <$1M | $500K |
| $1M-$5M | $3M |
| $5M-$10M | $7.5M |
| $10M-$25M | $17.5M |
| $25M-$50M | $37.5M |
| $50M-$100M | $75M |
| $100M-$250M | $175M |
| $250M-$500M | $375M |
| $500M-$1B | $750M |
| $1B-$10B | $5B |
| $10B+ | $15B |

Note: These are company revenue ranges, not deal sizes. The `averageDealSize` ($75K default) is the assumed contract value per account.

## Technical Changes

| File | Change |
|------|--------|
| `src/utils/branded-pdf-export.ts` | Complete rewrite of all 8 pages to strategic format |
| `src/hooks/use-branded-report.ts` | Add industry-level scoring data, revenue midpoint calculations, unscored account counts to `BrandedReportData` |

## What Does NOT Change

- Cover page branding/logo logic
- Footer logic
- Brand color system
- `ExportToPdf.tsx` component
- Existing helper functions (hexToRgb, normalizeCountryName, etc.)

## Key Modeling Defaults

- Average Deal Size (ACV): $75,000 (matches existing `SimpleTAMCard` default)
- Conversion Rate: 15% (matches existing default)
- These are clearly labeled as assumptions in the PDF

