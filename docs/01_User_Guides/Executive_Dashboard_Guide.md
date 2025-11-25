# Executive Dashboard Guide

**Version:** 1.0  
**Last Updated:** 2025-11-25  
**Author:** LaunchPulse Product Team

## Overview

The Executive Dashboard provides a high-level view of your account universe, scoring performance, and data quality. It's designed for weekly reviews, board presentations, and strategic planning.

**Access**: Navigate to **Executive Dashboard** from the main navigation.

## Dashboard Sections

### 1. Hero Metrics (Top Row)

**Total Accounts**
- Count of all accounts in your database
- Trend: Change vs last week
- Click to navigate to Accounts page

**Scored Accounts**
- Accounts with ICP fit scores
- Percentage of total accounts scored
- Click to see scoring job history

**Average Score**
- Mean ICP fit score across all accounts
- Indicates overall portfolio quality
- Higher = better ICP alignment

**Campaign Ready**
- Accounts eligible for campaigns (A/B band + contact data)
- Click to open Campaign Builder pre-filtered

### 2. Score Distribution (Hero Chart)

**What it shows**: Breakdown of accounts by score band (A/B/C/D)

**Interpretation**:
- **Healthy distribution**: 15-20% A-band, 35-45% B-band, 30-40% C-band, <10% D-band
- **Too many A-bands**: Your ICP may be too broad
- **Too few A-bands**: Your ICP may be too narrow or data needs enrichment

**Actions**:
- Click any band to filter accounts by that band
- Hover to see exact counts and percentages

**Bands**:
- **A (80-100)**: Perfect fit - immediate outreach
- **B (60-79)**: Good fit - nurture campaigns
- **C (40-59)**: Potential fit - long-term nurture
- **D (0-39)**: Poor fit - exclude from campaigns

### 3. Data Quality Card

**Overall Completeness**: Percentage of accounts with complete firmographic data

**Field Coverage**:
- **Industry**: % of accounts with industry data
- **Geography**: % of accounts with country data
- **Company Size**: % of accounts with employee count
- **Revenue**: % of accounts with revenue range
- **Tech Stack**: % of accounts with technology data
- **Contacts**: % of accounts with linked contacts

**Color Coding**:
- 🟢 Green (>80%): Excellent
- 🟡 Yellow (60-80%): Good, room to improve
- 🔴 Red (<60%): Needs attention

**Actions**:
- Click "Enrich Accounts" to start bulk enrichment
- Click specific field to see accounts missing that field

### 4. TAM/SAM/SOM Card

**Total Addressable Market (TAM)**:
- Universe of all accounts matching your ICP criteria
- Includes both your database and external data sources

**Serviceable Addressable Market (SAM)**:
- Subset of TAM that you can realistically reach
- Filtered by geography, company size, reachability

**Serviceable Obtainable Market (SOM)**:
- Accounts you can win in the next 12 months
- Based on sales capacity, conversion rates, competitive positioning

**Calculation**:
```
TAM = All accounts matching ICP
SAM = TAM × Geographic reach × Contact availability
SOM = SAM × Conversion rate × Time horizon
```

**Example**:
- **TAM**: 50,000 accounts (Software, 100-1000 employees, US)
- **SAM**: 15,000 accounts (filtered by contact availability)
- **SOM**: 2,250 accounts (15% conversion × 12 months)

**Actions**:
- Click "View Details" to see TAM breakdown
- Click "Calculate Custom TAM" to adjust parameters

### 5. Geography Breakdown

**What it shows**: Distribution of accounts by country/region

**Chart types**:
- **Map view**: Interactive world map with account density
- **Bar chart**: Top 10 countries by account count
- **Table view**: All countries with counts and percentages

**Actions**:
- Click country to filter dashboard by that geography
- Hover to see account count and average score
- Toggle between "All Accounts" and "Scored Accounts Only"

**Use cases**:
- Identify geo expansion opportunities
- Plan regional campaigns
- Allocate sales territories

### 6. Industry Breakdown

**What it shows**: Distribution of accounts by normalized industry

**Visualization**:
- Horizontal bar chart showing top 15 industries
- Percentage and count for each industry
- Average ICP score per industry

**Insights**:
- Which industries dominate your database
- Which industries have highest fit scores
- Industry concentration risk

**Actions**:
- Click industry to filter accounts
- Click "View All Industries" for complete list
- Export industry analysis to CSV

### 7. Company Size Distribution

**What it shows**: Accounts grouped by employee count tiers

**Tiers**:
- Tier 1: 1-10 employees (Startup)
- Tier 2: 11-50 employees (Small)
- Tier 3: 51-200 employees (Mid-Market)
- Tier 4: 201-1000 employees (Enterprise)
- Tier 5: 1000-5000 employees (Large Enterprise)
- Tier 6: 5000+ employees (Mega-Corp)

**Use cases**:
- Identify sweet spot company size
- Segment campaigns by size
- Align with sales team structure

### 8. Recent Insights

**What it shows**: AI-generated insights and recommendations

**Insight types**:
- **Data Quality Alerts**: "350 accounts missing industry data"
- **Score Anomalies**: "15% increase in A-band accounts this week"
- **Campaign Opportunities**: "1,200 new A-band accounts ready for outreach"
- **ICP Drift**: "Your closed-won accounts skew smaller than your ICP"

**Actions**:
- Click insight to see details
- Dismiss insight if not relevant
- Set up alerts for specific insight types

### 9. Accounts Needing Attention

**What it shows**: Accounts requiring action

**Categories**:
- **High-fit, no contacts**: A/B-band accounts missing contact data
- **Recently funded**: New funding events in last 30 days
- **Score dropped**: Accounts whose score decreased >15 points
- **Enrichment failed**: Accounts where enrichment errors occurred

**Actions**:
- Click category to see full list
- Click account to open detail drawer
- Bulk actions (enrich, score, add to campaign)

## Filters & Views

### Global Filters (Top Right)

**Date Range**: Filter by account creation date, last activity, etc.
- Last 7 days
- Last 30 days
- Last 90 days
- Custom range

**ICP Filter**: Show only accounts scored against specific ICP
- All ICPs (default)
- Primary ICP
- Select specific ICP

**Source Filter**: Filter by data source
- All sources (default)
- CRM only
- External only
- Enriched only

**Score Band Filter**: Filter by score band
- All bands (default)
- A-band only
- B-band and above
- Custom range (e.g., 70-100)

### Saved Views

**Save Current View**: Save your current filter configuration
1. Apply desired filters
2. Click "Save View"
3. Name your view (e.g., "A-band SaaS Accounts")
4. View appears in sidebar for quick access

**Default Views**:
- **All Accounts**: No filters applied
- **High-Priority**: A-band accounts with contacts
- **Needs Enrichment**: Accounts with <60% data completeness
- **Recent Additions**: Accounts added in last 7 days

## Exporting Data

### Export Options

**Export to PDF**: Generate executive report
- Includes all charts and metrics
- Formatted for presentation
- Customizable logo and branding

**Export to CSV**: Download raw data
- All accounts with scores and firmographics
- Filterable and sortable in Excel
- Includes custom fields

**Schedule Report**: Automated weekly/monthly reports
- Email PDF to stakeholders
- Slack channel notifications
- Custom frequency and format

### Export Process

1. Click **"Export"** button (top right)
2. Select format (PDF, CSV, Excel)
3. Choose data scope (all accounts, filtered accounts)
4. Select fields to include
5. Click "Generate Export"
6. Download link sent via email

## Best Practices

### Weekly Executive Review (15 minutes)

**Monday morning routine**:
1. Check "Total Accounts" trend (growing?)
2. Review "Average Score" trend (improving?)
3. Check "Campaign Ready" count (enough for this week's outreach?)
4. Review "Data Quality" (any red flags?)
5. Check "Recent Insights" (any urgent actions?)
6. Export top 50 A-band accounts for SDR team

### Monthly Board Presentation

**Metrics to highlight**:
- TAM/SAM/SOM progression
- Score distribution trend (month-over-month)
- Geography expansion progress
- Data quality improvement
- Campaign performance (if integrated with CRM reporting)

**Pro tip**: Use the "Export to PDF" feature to generate board-ready slides.

### Quarterly ICP Review

**Strategic analysis**:
1. Upload closed-won deals from last quarter
2. Navigate to ICP Manager → "Analyze Wins"
3. Compare winning profiles to current ICP
4. Adjust ICP criteria based on findings
5. Return to Executive Dashboard
6. Compare "Before" vs "After" score distributions
7. Document changes and rationale

## Troubleshooting

### Dashboard Shows No Data

**Possible causes**:
- No accounts in database yet
- Global filter is too restrictive
- RLS (Row Level Security) permissions issue

**Fix**:
1. Clear all filters (click "Reset Filters")
2. Check that CRM sync has completed
3. Verify you have accounts in the Accounts page
4. Contact support if issue persists

### Scores Not Updating

**Possible causes**:
- Scoring job not triggered
- ICP not defined
- Insufficient account data

**Fix**:
1. Navigate to Settings → Scoring
2. Check last scoring job status
3. Manually trigger "Refresh All Scores"
4. Monitor job progress
5. Check failed scores log if errors occur

### Metrics Don't Match CRM

**Possible causes**:
- Sync lag (up to 4 hours)
- Filters applied in LaunchPulse
- Duplicate accounts in LaunchPulse

**Fix**:
1. Check last CRM sync time (Settings → Integrations)
2. Clear all filters in dashboard
3. Run duplicate detection (Settings → Data Quality)
4. Trigger manual CRM sync if needed

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + R` | Refresh dashboard |
| `Ctrl/Cmd + E` | Export to CSV |
| `Ctrl/Cmd + F` | Open filter panel |
| `Esc` | Close all modals |

## Related Documentation

- [Platform Overview](./Platform_Overview.md) - Getting started
- [Account Management Guide](./Account_Management_Guide.md) - Managing accounts
- [Scoring Overview](../08_Scoring_Engine/Scoring_Overview.md) - Understanding scores
- [Data Quality Guide](./Settings_Configuration.md#data-quality) - Improving data

## Support

For dashboard questions:
- **Email**: support@launchpulse.ai
- **Slack**: #launchpulse-support
- **In-App Help**: Click ? icon → "Executive Dashboard Help"
