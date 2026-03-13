export interface HelpItem {
  id: string;
  title: string;
  description: string;
  content: string;
  keywords: string[];
  category: 'quickstart' | 'concepts' | 'workflows' | 'troubleshooting' | 'faq' | 'best-practices';
  relatedPages: string[];
  videoUrl?: string;
}

export interface VideoTutorial {
  id: string;
  title: string;
  description: string;
  duration: string;
  thumbnailUrl?: string;
  videoUrl: string;
  category: string;
}

export const helpDatabase: HelpItem[] = [
  // ==================== QUICK START ====================
  {
    id: 'platform-overview',
    title: 'Getting Started with LaunchPulse',
    description: 'Your complete guide to mastering LaunchPulse in under 10 minutes',
    content: `# Welcome to LaunchPulse

LaunchPulse is your AI-powered Managed Demand Engine for identifying, scoring, enriching, and prioritizing your ideal customers.

## What You Can Do

**1. Score Your Accounts**
Upload your account data and get instant AI-powered fit scores (0-100) that tell you exactly which accounts match your Ideal Customer Profile.

**2. Build Targeted Campaigns**
Use the Campaign Builder to create segmented outreach campaigns with Fuel Line types (ABM, Technographic, Firmographic, Persona).

**3. Enrich Your Data**
Automatically enhance your account and lead data using our 6-stage Smart Enrichment Waterfall — Perplexity AI, Firecrawl, Multi-AI aggregation, PeopleDataLabs, Apollo, and Hunter.

**4. Discover Intent Signals**
AI-powered intent signals detect engagement velocity, multi-threading gaps, score changes, and coverage gaps across your accounts.

**5. AI Chat (Cmd+K)**
Natural language interface to query your data, trigger actions, and get instant answers.

**6. List Builder**
Search and filter your entire database with score-based filtering and export targeted lists.

## Quick Start Checklist

1. ✅ Upload your accounts (CSV or CRM sync)
2. ✅ Create your first ICP
3. ✅ Run enrichment to fill data gaps
4. ✅ Review your fit score distribution
5. ✅ Compute intent signals
6. ✅ Build your first campaign

## Need Help?

- Click the **?** icon on any page for contextual help
- Use **Cmd/Ctrl + K** to search across the platform
- Contact support at support@launchpulse.com`,
    keywords: ['overview', 'getting started', 'introduction', 'quick start', 'basics', 'welcome', 'first steps'],
    category: 'quickstart',
    relatedPages: ['/']
  },
  {
    id: 'upload-csv',
    title: 'Uploading Your Data',
    description: 'Step-by-step guide to importing accounts and leads',
    content: `# Uploading CSV Data

## Before You Start

Make sure your CSV file includes these essential columns:

**For Accounts:**
- \`domain\` (required) - e.g., "acme.com"
- \`name\` (required) - Company name
- \`employee_count\` - Number of employees
- \`industry\` - Industry classification
- \`country\` - Use ISO codes (US, GB) or full names

**For Leads:**
- \`email\` (required) - Business email
- \`first_name\`, \`last_name\` (required)
- \`company\` or \`domain\` - To match to accounts
- \`title\` - Job title

## Upload Steps

1. **Navigate** to Data Upload from the sidebar
2. **Download the template** to see the exact format
3. **Prepare your data** following the template
4. **Click Upload** and select your file
5. **Map columns** - match your headers to LaunchPulse fields
6. **Review validation** - fix any errors highlighted
7. **Confirm** to complete the import

## Pro Tips

💡 **Domain Format**: Use "acme.com" not "https://www.acme.com"

💡 **Deduplication**: We'll merge records with the same domain automatically

💡 **Incremental Updates**: Upload new data anytime - we'll merge intelligently

💡 **Large Files**: Files up to 100MB are supported. For larger datasets, split into multiple uploads.`,
    keywords: ['upload', 'csv', 'import', 'data', 'file', 'accounts', 'leads', 'template', 'format'],
    category: 'quickstart',
    relatedPages: ['/data-upload']
  },
  {
    id: 'create-icp',
    title: 'Creating Your First ICP',
    description: 'Define your Ideal Customer Profile in 5 minutes',
    content: `# Creating Your Ideal Customer Profile

Your ICP (Ideal Customer Profile) is the blueprint LaunchPulse uses to score every account in your database.

## ICP Creation Wizard

1. **Go to ICP Manager** from the sidebar
2. **Click "Create New ICP"**
3. **Choose your approach:**
   - **Template**: Start from industry-specific templates
   - **Closed-Won Analysis**: Let AI analyze your winning deals
   - **Manual**: Build criteria from scratch

## Define Your Criteria

### Firmographics
- **Industries**: Select primary industries (e.g., SaaS, Healthcare)
- **Company Size**: Set employee count ranges (e.g., 50-500)
- **Revenue**: Target revenue bands
- **Geography**: Countries, regions, or specific cities

### Growth Signals
- **Funding Status**: Seed, Series A, B, C+
- **Tech Stack**: Required technologies
- **Buying Signals**: Recent hires, expansion, etc.

### Personas (Optional)
- **Job Titles**: Target decision-makers
- **Departments**: Sales, Marketing, IT, etc.
- **Seniority**: C-level, VP, Director, Manager

## Best Practices

🎯 **Start Focused**: Better to be too narrow than too broad. You can always expand later.

🎯 **Use Data**: Analyze your closed-won deals to inform criteria.

🎯 **Multiple ICPs**: Create separate ICPs for different market segments.

🎯 **Iterate**: Review and refine based on conversion data.`,
    keywords: ['icp', 'create', 'profile', 'segment', 'define', 'criteria', 'wizard', 'ideal customer'],
    category: 'quickstart',
    relatedPages: ['/icp-manager']
  },

  // ==================== CONCEPTS ====================
  {
    id: 'icp-scoring',
    title: 'How ICP Fit Scoring Works',
    description: 'Understanding the scoring algorithm and fit levels',
    content: `# ICP Fit Scoring Explained

Every account receives a fit score from 0-100 based on how well it matches your ICP criteria.

## Score Ranges

| Score | Level | What It Means |
|-------|-------|---------------|
| 70-100 | **High Fit (A)** | Strong match. Prioritize for outreach. |
| 40-69 | **Medium Fit (B)** | Good potential. Worth further research. |
| 0-39 | **Low Fit (C)** | Poor match. Deprioritize or exclude. |

## How Scoring Works

### 1. Server-Side Computation
Scores are computed via the \`score-accounts\` edge function. This ensures consistent, accurate scoring across your entire database.

### 2. Criteria Matching
Each ICP criterion is checked against account attributes:
- ✅ Full match = 100% of weight
- ⚡ Partial match = Proportional points
- ❌ No match = 0 points

### 3. Weight Distribution
Different criteria carry different weights based on your ICP configuration:
- **Industry**: Typically 20-25%
- **Company Size**: 15-20%
- **Geography**: 10-15%
- **Revenue**: 15-20%
- **Tech Stack**: 10-15%
- **Signals**: 5-10%

### 4. Score History
Every score change is tracked in \`score_history\`, enabling trend analysis and intent signal detection.

## Improving Accuracy

📊 **More Data = Better Scores**: Enriched accounts score more accurately.

📊 **Calibrate Weights**: Adjust based on what matters most for your wins.

📊 **Review Edge Cases**: Check medium-fit accounts to fine-tune criteria.`,
    keywords: ['icp', 'score', 'fit', 'scoring', 'algorithm', 'high fit', 'medium fit', 'low fit', 'weights', 'calculation'],
    category: 'concepts',
    relatedPages: ['/', '/icp-manager', '/accounts']
  },
  {
    id: 'tam-sam-som',
    title: 'TAM, SAM, and SOM',
    description: 'Understanding your market size metrics',
    content: `# Market Sizing: TAM, SAM, SOM

## Definitions

### TAM (Total Addressable Market)
**The entire market opportunity**

All accounts that could potentially use your product/service, regardless of your current capabilities or focus.

*In LaunchPulse: Total accounts in your database*

### SAM (Serviceable Addressable Market)
**Your realistic target market**

The portion of TAM that matches your ICP criteria and that you can actually serve.

*In LaunchPulse: High + Medium fit accounts (score ≥ 40)*

### SOM (Serviceable Obtainable Market)
**Your capture opportunity**

The portion of SAM you can realistically win based on resources, competition, and capacity.

*In LaunchPulse: High fit accounts (score ≥ 70) within your sales capacity*

## How LaunchPulse Calculates

| Metric | Calculation |
|--------|-------------|
| TAM | All accounts in database |
| SAM | Accounts with fit score ≥ 40 |
| SOM | High-fit accounts ÷ Win rate × Capacity |

## Use Cases

📈 **Investor Pitches**: Show market opportunity with data-backed sizing

📈 **Territory Planning**: Allocate reps based on SOM by region

📈 **Goal Setting**: Set realistic pipeline targets

📈 **Expansion Planning**: Identify underserved segments`,
    keywords: ['tam', 'sam', 'som', 'market', 'size', 'addressable', 'opportunity', 'total', 'serviceable'],
    category: 'concepts',
    relatedPages: ['/']
  },
  {
    id: 'data-sources',
    title: 'Data Sources & Smart Enrichment',
    description: 'How your data is enhanced through the 6-stage enrichment waterfall',
    content: `# Smart Enrichment Waterfall

LaunchPulse uses a 6-stage intelligent enrichment waterfall to enhance your account and lead data. Each stage adds progressively deeper data, with early-exit optimization when 90% field coverage is achieved.

## Enrichment Stages

| Stage | Provider | What It Does | Cost |
|-------|----------|-------------|------|
| **1. Cache** | Internal | Checks 30-day cached results first | Free |
| **2. Perplexity AI** | Real-time search | Searches the web for current company information | Included |
| **3. Firecrawl** | Web scraping | Structured extraction from company websites | Included |
| **4. Multi-AI** | Claude, Gemini, Grok | Aggregates insights from multiple AI models | Included |
| **5. Paid Fallbacks** | PeopleDataLabs, Apollo | Traditional B2B data APIs for verified firmographics | Per-record |
| **6. Hunter** | Email verification | Verifies email deliverability | Per-record |

## What Gets Enriched

### Company Data
- Employee count & growth rate
- Revenue estimates
- Industry classification (normalized)
- Technology stack
- Funding history & total raised
- Social profiles (LinkedIn, Twitter, Facebook)
- Business model classification
- SIC/NAICS codes

### Contact Data
- Email verification status
- Phone numbers (direct dial, mobile)
- Job titles & seniority
- Department classification
- LinkedIn profiles

## Smart Features

### Early Exit
If 90% of fields are already populated after any stage, enrichment stops — saving time and cost.

### Circuit Breakers
Paid APIs (Apollo, PDL) have automatic circuit breakers. If a provider returns errors, it's temporarily bypassed.

### Accuracy Validators
Each enriched field includes a confidence score. Low-confidence data is flagged for review.

### Custom Vertical Attributes
Define custom enrichment fields (e.g., "bed_count" for healthcare) with AI-powered extraction prompts.

## Monitoring Costs

Go to **Settings → Enrichment** to:
- View credits used (tracked in your organization settings)
- See enrichment coverage rates
- Monitor job progress in real-time
- Review source breakdown per job`,
    keywords: ['data', 'sources', 'enrichment', 'perplexity', 'firecrawl', 'apollo', 'pdl', 'hunter', 'waterfall', 'providers', 'enhance', 'ai'],
    category: 'concepts',
    relatedPages: ['/data-upload', '/settings', '/accounts']
  },
  {
    id: 'executive-dashboard',
    title: 'Reading Your Dashboard',
    description: 'Understanding every metric on the Executive Dashboard',
    content: `# Executive Dashboard Guide

Your command center for ICP performance and data health.

## Key Metrics

### ICP Coverage
**What it shows**: Percentage of accounts matching your ICP

**Target**: 20-40% for focused ICPs

**Action**: If too low, broaden ICP criteria. If too high, tighten them.

### Fit Distribution
**High/Medium/Low breakdown** of your database

**Healthy distribution**: 
- High (A): 15-25%
- Medium (B): 25-35%
- Low (C): 40-60%

### Data Quality Score
**Completeness** of your account data (0-100%)

**Factors**:
- Has industry
- Has employee count
- Has geography
- Has contacts
- Has revenue

### Geographic Heatmap
**Where** your ideal accounts are concentrated

**Use for**: Territory planning, expansion decisions

### Growth KPIs
Weekly growth trends for accounts, leads, and scoring coverage.

## Interactive Features

🖱️ **Click any card** to drill down into details

🔍 **Filter by ICP** to see segment-specific metrics

📊 **Smart Insights Panel** for AI-generated recommendations

⚡ **Set alerts** for threshold notifications

## Trend Indicators

- 📈 Green arrow: Improving vs last week
- 📉 Red arrow: Declining vs last week
- ➡️ Gray: No significant change`,
    keywords: ['dashboard', 'metrics', 'kpi', 'overview', 'executive', 'summary', 'coverage', 'distribution', 'quality'],
    category: 'concepts',
    relatedPages: ['/']
  },
  {
    id: 'intent-signals',
    title: 'Intent Signals & Alerts',
    description: 'How LaunchPulse detects buying signals and engagement patterns',
    content: `# Intent Signals

LaunchPulse automatically computes intent signals that identify which accounts are showing buying behavior or need attention.

## Signal Types

### 🚀 Engagement Velocity
Detects accounts with increasing activity week-over-week. Uses activity data or score history as a proxy.
- **Threshold**: 50%+ increase in engagement vs prior week
- **Priority**: High if 200%+ increase

### 🧵 Multi-Threading Gaps
Identifies high-fit accounts where you only have 1 contact engaged — a single point of failure.
- **Triggers on**: High-fit accounts with exactly 1 linked lead
- **Priority**: High for companies with 500+ employees

### 📊 Score Changes
Alerts when accounts experience significant ICP score movements (up or down).
- **Threshold**: 15+ point gain or 20+ point drop
- **Priority**: Critical for 30+ point changes

### 🎯 Coverage Gaps
Flags high-fit accounts with no recent engagement in the last 30 days.
- **Triggers on**: High-fit accounts with zero recent activity
- **Priority**: High for accounts with high propensity scores

## Computing Signals

1. Navigate to the **Dashboard** or **Intent Signals** panel
2. Click **Compute Signals** to run the analysis
3. Signals are stored in \`account_signals\` and auto-expire after 7 days
4. Dismiss or action signals as you work through them

## Acting on Signals

Each signal includes:
- **Account name** and link
- **Priority level** (critical, high, medium, low)
- **Recommended action** (e.g., add contacts, launch campaign)
- **Context metadata** (counts, percentages, trends)

## Signal-to-Campaign Routing

High-priority signals can be routed directly into the Campaign Builder:
- Intent signals → ABM fuel line
- Score changes → Enterprise sequence
- Coverage gaps → Firmographic targeting`,
    keywords: ['intent', 'signals', 'engagement', 'velocity', 'multi-thread', 'score change', 'coverage gap', 'alerts', 'buying signals'],
    category: 'concepts',
    relatedPages: ['/', '/accounts']
  },

  // ==================== WORKFLOWS ====================
  {
    id: 'campaign-builder',
    title: 'Campaign Builder V2',
    description: 'Build segmented outreach campaigns with the 7-step wizard',
    content: `# Campaign Builder V2

The Campaign Builder guides you through creating targeted outreach campaigns in 7 steps.

## The 7 Steps

### 1. Setup
- Name your campaign
- Select a **Fuel Line type**:
  - **ABM**: Named accounts from signals/manual selection
  - **Technographic**: Accounts using specific tech stack
  - **Firmographic**: Industry + size + geography targeting
  - **Persona**: Job title + seniority first approach

### 2. Targeting
- Set account filters (industry, size, geography, fit score)
- Filters auto-configure based on Fuel Line type

### 3. Sequence
- Choose from templates: Enterprise, SMB, Partner
- Customize email steps and timing

### 4. Persona
- Define target job titles and seniority
- Set max contacts per account (2-3 recommended)

### 5. Data Source
- Select which accounts to include
- Apply suppression lists (global or per-campaign)

### 6. Preview
- Review account count and contact count
- See fit score distribution
- Verify suppression exclusions

### 7. Export
- Download CSV or sync to CRM
- Campaign saved with metadata for tracking

## Fuel Line Types

Each fuel line auto-configures targeting defaults:

| Fuel Line | Best For | Auto-Config |
|-----------|----------|-------------|
| ABM | Signal-triggered accounts | Enterprise sequence, pre-loaded accounts |
| Technographic | Tech-stack based targeting | Filters by tech_stack column |
| Firmographic | Industry/size/geo targeting | Sets employee/revenue ranges |
| Persona | Title-first targeting | Leads with persona filters first |

## Best Practices

✅ **Quality over quantity** - 100 high-fit > 1000 low-fit

✅ **Include multiple personas** - Decision maker + influencer

✅ **A/B test segments** - Compare different fuel line types

✅ **Track outcomes** - Import results to optimize ICP`,
    keywords: ['campaign', 'builder', 'wizard', 'fuel line', 'abm', 'technographic', 'firmographic', 'persona', 'sequence', 'export'],
    category: 'workflows',
    relatedPages: ['/campaigns']
  },
  {
    id: 'list-builder',
    title: 'Using the List Builder',
    description: 'Search, filter, and export targeted account lists',
    content: `# List Builder

The List Builder provides a powerful search and filter interface for building targeted lists.

## Search Capabilities

### Company Filters
- **Name/Domain search**: Free text search across accounts
- **Industry**: Filter by normalized industry
- **Employee Count**: Min/max ranges
- **Revenue Range**: Revenue band filtering
- **Geography**: Country, state, city
- **Tech Stack**: Filter by technologies used

### Fit Score Filtering
- **Band A** (70-100): High-fit accounts
- **Band B** (40-69): Medium-fit accounts
- **Band C** (0-39): Low-fit accounts

### Contact Filters
- Job title search
- Seniority level
- Department

## Working with Results

### Score Columns
Results display fit_score, overall_score, and intent_score alongside account data.

### Export
Click **Export CSV** to download your filtered results with all columns including scores.

## Tips

💡 Combine fit score bands with industry filters for targeted segments

💡 Use the List Builder before campaigns to validate your targeting

💡 Export results to share with your sales team`,
    keywords: ['list', 'builder', 'search', 'filter', 'export', 'accounts', 'score', 'band'],
    category: 'workflows',
    relatedPages: ['/list-builder']
  },
  {
    id: 'build-campaign',
    title: 'Building Campaign Lists',
    description: 'Create and export targeted account lists',
    content: `# Building a Campaign

Turn your scored accounts into actionable campaign lists.

## Step 1: Filter Accounts

Navigate to **Accounts** and apply filters:

1. **Select ICP** - Choose your target segment
2. **Set Fit Score** - Usually 70+ for campaigns
3. **Add Firmographics**:
   - Industry
   - Company size
   - Geography
4. **Require Contacts** - Toggle "Has Leads"

## Step 2: Add Persona Filters

Click **Persona Filters** to target:
- Specific job titles (e.g., "VP Sales")
- Seniority levels (Director+)
- Departments (Sales, Marketing)
- Max contacts per account (2-3 recommended)

## Step 3: Review & Refine

Check your list:
- Total accounts
- Total contacts
- Top accounts preview
- Fit score distribution

Adjust filters until you have a focused list (100-300 accounts is ideal).

## Step 4: Export

Click **Build Campaign**:
1. Name your campaign
2. Choose format (CSV, direct CRM sync)
3. Select fields to include
4. Download or sync

## Campaign Best Practices

✅ **Quality over quantity** - 100 high-fit > 1000 low-fit

✅ **Include multiple personas** - Decision maker + influencer

✅ **A/B test segments** - Compare different ICP slices

✅ **Track outcomes** - Import results to optimize ICP`,
    keywords: ['campaign', 'build', 'export', 'target', 'list', 'accounts', 'filter', 'outreach'],
    category: 'workflows',
    relatedPages: ['/accounts', '/leads']
  },
  {
    id: 'closed-won-analysis',
    title: 'Analyzing Your Wins',
    description: 'Use closed-won deals to optimize your ICP',
    content: `# Closed-Won Analysis

Let AI analyze your winning deals to optimize your ICP.

## Why It Matters

Your best customers reveal patterns:
- Which industries convert best
- Optimal company sizes
- Winning geographies
- Technology correlations

## How to Use

### 1. Prepare Your Data

Export from CRM with columns:
- \`account_id\` or \`domain\`
- \`close_date\`
- \`deal_value\`
- \`sales_cycle_days\` (optional)

### 2. Upload Deals

1. Go to **Data Upload → Closed-Won**
2. Upload your CSV
3. Map columns
4. Confirm import

### 3. Review Insights

AI generates insights:
- **Common patterns** across winners
- **ICP recommendations** with confidence scores
- **Segment analysis** by deal size
- **Geographic hotspots**

### 4. Apply to ICP

Click **Apply Recommendations** to:
- Auto-adjust ICP criteria
- Create new micro-segments
- Update scoring weights

## Best Practices

📊 **Minimum 50 deals** for statistically significant insights

📊 **Include deal value** to weight high-value patterns

📊 **Update quarterly** as your wins evolve`,
    keywords: ['closed won', 'deals', 'analysis', 'winners', 'optimize', 'insights', 'patterns', 'ai'],
    category: 'workflows',
    relatedPages: ['/data-upload', '/icp-manager']
  },
  {
    id: 'account-filters',
    title: 'Filtering & Segmenting',
    description: 'Find exactly the accounts you need',
    content: `# Account Filtering

Powerful filters to slice your data any way you need.

## Filter Categories

### ICP & Scoring
- ICP Segment
- Fit Score (slider or ranges)
- High/Medium/Low buckets (A/B/C bands)

### Firmographics
- Industry (hierarchical)
- Sub-industry
- Employee count
- Revenue range
- Country / State / City

### Data Quality
- Data source (CRM, CSV, Enrichment)
- Enrichment status
- Data completeness %
- Last updated

### Engagement
- Has leads (yes/no)
- Campaign-ready
- Contacted / Not contacted
- Last export date

### Advanced
- Tech stack (any/all)
- Funding stage
- Growth signals
- Custom fields

## Combining Filters

Filters use **AND** logic:
\`Industry = SaaS AND Size = 50-200 AND Country = USA\`

## Saving Segments

1. Apply your filters
2. Click **Save as Segment**
3. Name your segment
4. Access from Segments dropdown

## Quick Tips

⚡ **Cmd/Ctrl + F** to focus search

⚡ **Clear All** to reset filters

⚡ **Recent Filters** shows your history`,
    keywords: ['filter', 'search', 'find', 'accounts', 'narrow', 'refine', 'segment', 'criteria'],
    category: 'workflows',
    relatedPages: ['/accounts']
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'Navigate faster with shortcuts',
    content: `# Keyboard Shortcuts

Speed up your workflow with these shortcuts.

## Global

| Shortcut | Action |
|----------|--------|
| \`Cmd/Ctrl + K\` | AI Chat / Command palette |
| \`Cmd/Ctrl + /\` | Open help |
| \`Cmd/Ctrl + ,\` | Settings |
| \`Esc\` | Close dialogs |

## Navigation

| Shortcut | Action |
|----------|--------|
| \`G then D\` | Dashboard |
| \`G then A\` | Accounts |
| \`G then L\` | Leads |
| \`G then I\` | ICP Manager |
| \`G then S\` | Settings |

## Accounts Page

| Shortcut | Action |
|----------|--------|
| \`F\` | Focus filters |
| \`Cmd/Ctrl + E\` | Export |
| \`Cmd/Ctrl + N\` | New campaign |
| \`Enter\` | Open selected account |

## Data Upload

| Shortcut | Action |
|----------|--------|
| \`U\` | Upload CSV |
| \`D\` | Download template |

## Tips

💡 Press \`?\` anywhere to see available shortcuts

💡 Shortcuts require focus on the main content area`,
    keywords: ['keyboard', 'shortcuts', 'hotkeys', 'navigation', 'speed', 'quick'],
    category: 'workflows',
    relatedPages: ['/', '/accounts', '/leads', '/icp-manager', '/data-upload']
  },

  // ==================== TROUBLESHOOTING ====================
  {
    id: 'upload-errors',
    title: 'Fixing Upload Errors',
    description: 'Common CSV issues and solutions',
    content: `# Troubleshooting Upload Errors

## Common Errors

### "Invalid domain format"
**Cause**: Domain includes protocol or subdomain
**Fix**: Use \`acme.com\` not \`https://www.acme.com\`

### "Missing required fields"
**Cause**: Required columns are empty
**Fix**: Ensure every row has \`domain\`, \`name\` (accounts) or \`email\`, \`first_name\`, \`last_name\` (leads)

### "Duplicate entries"
**Cause**: Same domain/email appears multiple times
**Fix**: Deduplicate before upload, or we'll merge automatically

### "Country not recognized"
**Cause**: Non-standard country format
**Fix**: Use ISO codes (US, GB, CA) or full names

### "Invalid date format"
**Cause**: Inconsistent date formatting
**Fix**: Use YYYY-MM-DD consistently

### "Character encoding issue"
**Cause**: Special characters corrupted
**Fix**: Save as UTF-8 encoded CSV

## Validation Report

After upload, review the validation report:
- ✅ **Valid rows**: Ready to import
- ⚠️ **Warnings**: Will import with notes
- ❌ **Errors**: Must fix before import

## Large File Tips

- Max file size: 100MB
- For larger files, split by domain range (A-M, N-Z)
- Upload during off-peak hours for faster processing`,
    keywords: ['upload', 'error', 'fix', 'csv', 'problem', 'troubleshoot', 'validation', 'format'],
    category: 'troubleshooting',
    relatedPages: ['/data-upload']
  },
  {
    id: 'low-fit-scores',
    title: 'Improving Low Scores',
    description: 'Why scores are low and how to fix them',
    content: `# Diagnosing Low Fit Scores

## Common Causes

### 1. ICP Too Narrow
Your criteria exclude most accounts.

**Solution**:
- Broaden industry selections
- Expand size ranges
- Add more geographies

### 2. Missing Account Data
Accounts lack info needed for scoring.

**Solution**:
- Run Smart Enrichment to fill data gaps
- Upload more complete data
- Wait for enrichment to complete

### 3. Misaligned Criteria
Your ICP doesn't reflect your actual buyers.

**Solution**:
- Run closed-won analysis
- Review high-fit account attributes
- Adjust weights and criteria

### 4. Database Mismatch
Your accounts aren't in your target market.

**Solution**:
- Source new lists from data providers
- Use lookalike modeling
- Expand data sources

## Diagnosing Steps

1. **Check data completeness** on low-scoring accounts
2. **Review ICP match reasons** in account details
3. **Compare to high-scoring** accounts
4. **Run segment analysis** to find patterns

## Quick Wins

⚡ Run enrichment for missing firmographics

⚡ Loosen 1-2 criteria and re-score

⚡ Create a broader "nurture" ICP tier`,
    keywords: ['low', 'score', 'fit', 'poor', 'bad', 'improve', 'increase', 'fix'],
    category: 'troubleshooting',
    relatedPages: ['/accounts', '/icp-manager']
  },
  {
    id: 'enrichment-not-working',
    title: 'Enrichment Issues',
    description: 'Fixing data enrichment problems',
    content: `# Enrichment Troubleshooting

## Understanding Enrichment Results

When you run enrichment, records can have three outcomes:

### ✅ Newly Enriched
The waterfall found and added new data. Credits are deducted.

### ⏭️ Already Complete
The record already had 90%+ field coverage. The waterfall exits early — no credits used. This shows as "0 enriched" but is actually a good outcome.

### ❌ Failed
The waterfall couldn't find data from any provider. Common for small/new companies.

## Common Issues

### "Enrichment shows 0 enriched"
**Most likely cause**: Records are already enriched from prior runs. Check the "already complete" count.
**Alternative cause**: Domain not found in any provider database.

### "Enrichment stuck or slow"
**Cause**: The 6-stage waterfall calls multiple AI providers sequentially. Each record can take 10-25 seconds.
**Fix**: Reduce batch size or wait for completion. Jobs auto-pause at timeout and can be resumed.

### "Costs higher than expected"
**Cause**: Apollo and PDL stages use per-record pricing.
**Fix**: 
- Enable \`skipPaidProviders\` to use only free AI stages
- Set monthly spending caps
- Enrich only high-fit accounts first

### "Stale data"
**Cause**: Cached from old enrichment (30-day cache window)
**Fix**: Force re-enrichment with \`forceAllStages: true\`

## Enrichment Waterfall Order

LaunchPulse enriches in this order:
1. **Cache** (30-day lookback, free)
2. **Perplexity AI** (real-time web search)
3. **Firecrawl** (structured web scraping)
4. **Multi-AI** (Claude, Gemini, Grok aggregation)
5. **PeopleDataLabs** (if configured, per-record)
6. **Apollo** (if configured, per-record)
7. **Hunter** (email verification, per-record)

## Cost Optimization

💰 AI stages (Perplexity, Firecrawl, Multi-AI) are included in your plan

💰 Paid stages (PDL, Apollo, Hunter) use per-record credits

💰 Early-exit at 90% coverage saves unnecessary API calls

💰 Focus on high-fit accounts first for best ROI`,
    keywords: ['enrichment', 'not working', 'api', 'stuck', 'pending', 'error', 'cost', 'credits', 'waterfall', 'perplexity', 'firecrawl'],
    category: 'troubleshooting',
    relatedPages: ['/settings', '/accounts']
  },

  // ==================== FAQ ====================
  {
    id: 'faq-data-security',
    title: 'Is my data secure?',
    description: 'How LaunchPulse protects your data',
    content: `# Data Security

## Our Commitment

Your data security is our top priority.

## Security Measures

### Encryption
- Data encrypted at rest (AES-256)
- Data encrypted in transit (TLS 1.3)
- API keys encrypted and hashed

### Access Control
- Role-based permissions (Owner, Admin, Member, Viewer)
- Row-Level Security (RLS) on all database tables
- Audit logging for all actions

### Infrastructure
- Hosted on Supabase (SOC 2 compliant)
- Automatic backups (daily)
- Edge functions run in isolated containers

### Compliance
- GDPR compliant
- CCPA compliant
- Data processing agreements available

## Your Controls

You can:
- Export all your data anytime
- Delete your data permanently
- Control team member access
- View audit logs

## Questions?

Contact security@launchpulse.com`,
    keywords: ['security', 'data', 'safe', 'encrypted', 'gdpr', 'compliance', 'privacy'],
    category: 'faq',
    relatedPages: ['/settings']
  },
  {
    id: 'faq-pricing',
    title: 'How does pricing work?',
    description: 'Understanding LaunchPulse pricing',
    content: `# Pricing Overview

## Credit-Based Model

LaunchPulse uses a credit-based system for enrichment and AI operations.

### Enrichment Credits
Your organization has an allocated pool of enrichment credits:
- Credits are deducted when the waterfall successfully enriches a record with new data
- Records that are already complete (cache hits) don't consume credits
- AI-only stages (Perplexity, Firecrawl, Multi-AI) are included
- Paid provider stages (PDL, Apollo, Hunter) use additional per-record credits

### Credit Tracking
View your credit usage in **Settings → Organization**:
- Credits used vs total allocated
- Usage trends over time
- Per-job credit breakdown

## Plans

### Professional
- Configurable account limits
- Unlimited ICPs
- Full enrichment waterfall
- AI Chat & Intent Signals
- Campaign Builder

### Enterprise
- Unlimited accounts
- Custom integrations
- Dedicated success manager
- SLA guarantees
- Custom AI agent configurations

## Questions?

Contact sales@launchpulse.com for custom pricing.`,
    keywords: ['pricing', 'cost', 'plan', 'credits', 'billing', 'subscription', 'enterprise'],
    category: 'faq',
    relatedPages: ['/settings']
  },
  {
    id: 'faq-export-limits',
    title: 'Are there export limits?',
    description: 'Campaign export limitations',
    content: `# Export Limits

## Format Options

All plans support:
- CSV download
- Direct CRM sync (Salesforce, HubSpot)
- Campaign Builder export

## Export History

View all exports in **Settings → Export History**:
- Date and time
- Number of records
- Campaign name and fuel line type

## Tips for Large Exports

If you need to export a large dataset:

1. **Segment your list** - Export in batches by region or fit score band
2. **Use CRM sync** - Sync doesn't count against export limits
3. **Use the Campaign Builder** - Includes deduplication and suppression`,
    keywords: ['export', 'limit', 'download', 'campaign', 'maximum', 'restriction'],
    category: 'faq',
    relatedPages: ['/accounts', '/settings']
  },

  // ==================== BEST PRACTICES ====================
  {
    id: 'bp-icp-strategy',
    title: 'ICP Strategy Best Practices',
    description: 'Build ICPs that drive results',
    content: `# ICP Strategy Best Practices

## Start with Data

Don't guess. Analyze:
- Your best customers
- Closed-won patterns
- Fastest sales cycles
- Highest LTV accounts

## Tier Your ICPs

Create 2-3 tiers:

### Tier 1: Primary ICP
- Highest conversion potential
- Focus 60% of resources
- Tightest criteria

### Tier 2: Secondary ICP
- Good fit, longer sales cycle
- 30% of resources
- Broader criteria

### Tier 3: Emerging/Test
- New markets to explore
- 10% of resources
- Experimental criteria

## Iterate Regularly

📅 **Monthly**: Review fit score distribution

📅 **Quarterly**: Analyze conversion by segment

📅 **Bi-annually**: Major ICP revision based on wins

## Common Mistakes

❌ Too many ICPs (stick to 2-4)

❌ Criteria based on assumptions not data

❌ Never updating after initial creation

❌ Ignoring negative signals (what to avoid)`,
    keywords: ['icp', 'strategy', 'best practice', 'tier', 'segment', 'optimize'],
    category: 'best-practices',
    relatedPages: ['/icp-manager']
  },
  {
    id: 'bp-data-quality',
    title: 'Maintaining Data Quality',
    description: 'Keep your data clean and accurate',
    content: `# Data Quality Best Practices

## The Quality Hierarchy

1. **Completeness**: All key fields filled
2. **Accuracy**: Data matches reality
3. **Freshness**: Data is up-to-date
4. **Consistency**: Standardized formats

## Key Metrics to Track

- **Completeness %**: Target 80%+
- **Enrichment rate**: Target 70%+
- **Duplicate rate**: Target <5%
- **Stale data**: Records not updated in 90+ days

## Maintenance Routines

### Weekly
- Review enrichment job results
- Check for failed enrichments
- Spot-check new records

### Monthly
- Run account merge/dedup
- Identify stale accounts
- Review data quality on Dashboard

### Quarterly
- Full database audit
- Archive inactive accounts
- Re-enrich priority accounts

## Quick Wins

⚡ Enable auto-enrichment for new records via AI Agents

⚡ Set up validation rules on upload

⚡ Use intent signals to flag stale high-fit accounts

⚡ Standardize field formats`,
    keywords: ['data', 'quality', 'clean', 'accuracy', 'maintenance', 'hygiene', 'duplicates'],
    category: 'best-practices',
    relatedPages: ['/data-upload', '/settings']
  },
  {
    id: 'bp-campaign-success',
    title: 'Campaign Success Factors',
    description: 'Build campaigns that convert',
    content: `# Campaign Success Best Practices

## Before You Build

✅ Define clear campaign goal
✅ Set target account count (100-300 ideal)
✅ Identify 2-3 target personas
✅ Prepare personalized messaging

## Account Selection

### Fit Score Thresholds
- **ABM campaigns**: 70+ fit score (Band A)
- **Demand gen**: 40+ fit score (Band B+)
- **Nurture**: All scored accounts

### Fuel Line Selection
Match your data signal to the right fuel line:
- **Intent signals** → ABM
- **Tech stack match** → Technographic
- **Industry/size fit** → Firmographic
- **Title-first** → Persona

## Contact Selection

### Ideal Contact Mix
- 1 decision maker per account
- 1-2 influencers per account
- Verified emails only

### Persona Targeting
Focus on titles that:
- Have budget authority
- Experience the pain you solve
- Are accessible via your channels

## Post-Campaign

📊 Track opens, clicks, replies

📊 Note which accounts engage

📊 Feed outcomes back to LaunchPulse

📊 Refine ICP based on results`,
    keywords: ['campaign', 'success', 'convert', 'best practice', 'outreach', 'abm', 'fuel line'],
    category: 'best-practices',
    relatedPages: ['/accounts', '/leads']
  },

  // ==================== AI FEATURES ====================
  {
    id: 'ai-chat',
    title: 'Using AI Chat',
    description: 'Get instant answers and perform actions with natural language',
    content: `# AI Chat Assistant

Access your AI assistant anytime with **Cmd/Ctrl + K** or click the chat icon.

## What You Can Ask

### Data Questions
- "How many high-fit accounts do I have?"
- "Show me accounts in the healthcare industry"
- "What's my ICP coverage for Enterprise segment?"

### Actions
- "Create a campaign with top 50 high-fit accounts"
- "Score these new accounts against my ICP"
- "Export accounts with fit score above 70"

### Analysis
- "Why is Acme Corp a high-fit account?"
- "Compare my two ICPs"
- "What industries have the best fit scores?"

### Navigation
- "Take me to ICP Manager"
- "Open account details for Acme Corp"
- "Show me the data quality report"

## Tips for Better Results

💡 **Be specific**: "Show SaaS companies with 50-200 employees" works better than "Show me some companies"

💡 **Use context**: "In my Enterprise ICP, which accounts need enrichment?"

💡 **Ask follow-ups**: The AI remembers your conversation context

💡 **Request formats**: "Give me a table of..." or "Summarize the key points"

## AI Memory

The AI learns your preferences over time:
- Preferred report formats
- Common queries and shortcuts
- Organization-specific context

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + K | Open AI Chat |
| Escape | Close chat |
| Enter | Send message |
| Shift + Enter | New line |`,
    keywords: ['ai', 'chat', 'assistant', 'natural language', 'ask', 'question', 'cmd k', 'search', 'memory'],
    category: 'concepts',
    relatedPages: ['/']
  },
  {
    id: 'ai-agents-setup',
    title: 'Setting Up AI Agents',
    description: 'Automate repetitive tasks with intelligent agents',
    content: `# AI Agents

AI Agents automate repetitive tasks in the background, saving you hours of manual work.

## Available Agent Types

### Enrichment Agent
Automatically enriches new accounts as they're added.
- Triggers: New account upload, CRM sync
- Actions: Runs 6-stage enrichment waterfall

### Scoring Agent
Keeps fit scores up-to-date as data changes.
- Triggers: Data update, ICP change
- Actions: Recalculate scores, update segments

### Monitoring Agent
Watches for important changes in your data.
- Triggers: Scheduled (daily/weekly)
- Actions: Compute intent signals, send alerts

### Cleanup Agent
Maintains data quality automatically.
- Triggers: Scheduled
- Actions: Merge duplicates, flag stale records

## Creating an Agent

1. Go to **AI Agents** from the sidebar
2. Click **Create New Agent**
3. Choose agent type
4. Configure parameters:
   - Schedule (real-time, hourly, daily)
   - Scope (all accounts or filtered)
   - Notifications (email, in-app)
5. Enable and save

## Agent Registry

The Agent Registry tracks:
- Agent health scores
- Success rates and latency
- Total invocations
- Last error details

## Monitoring Agents

View agent activity in the **Agent Runs** panel:
- Last run time
- Records processed
- Errors encountered
- Run duration
- Live progress metrics

## Best Practices

🤖 **Start simple**: Enable one agent at a time

🤖 **Set alerts**: Get notified on failures

🤖 **Review regularly**: Check agent logs weekly

🤖 **Adjust scope**: Narrow agents if they run too long`,
    keywords: ['ai', 'agents', 'automation', 'background', 'enrichment', 'scoring', 'monitoring', 'schedule', 'registry'],
    category: 'workflows',
    relatedPages: ['/ai-agents', '/settings']
  },
  {
    id: 'ai-enrichment',
    title: 'AI-Powered Enrichment',
    description: 'How the Smart Enrichment Waterfall enhances your data',
    content: `# AI-Powered Enrichment

LaunchPulse uses a unique 6-stage waterfall that combines AI search, web scraping, and traditional data providers.

## How It Works

### 1. Perplexity AI (Real-Time Search)
AI searches the web for current company information:
- Company websites, news, press releases
- Job postings and hiring patterns
- Social media presence
- Recent announcements

### 2. Firecrawl (Structured Web Scraping)
Extracts structured data from company websites:
- Employee information
- Product offerings
- Technology indicators
- Contact details

### 3. Multi-AI Aggregation
Combines insights from Claude, Gemini, and Grok:
- Cross-validates findings
- Fills gaps from different perspectives
- Business model classification
- Growth stage estimation

### 4. Paid Provider Fallbacks
Traditional B2B data APIs for verified firmographics:
- **PeopleDataLabs**: Company data, contacts
- **Apollo**: Email discovery, org charts

### 5. Hunter (Email Verification)
Verifies email deliverability for discovered contacts.

## AI vs Traditional Enrichment

| Aspect | Traditional | AI-Powered |
|--------|-------------|------------|
| Source | Static API databases | Real-time web + AI analysis |
| Data age | Quarterly updates | Current as of search time |
| Coverage | Structured fields only | Structured + unstructured insights |
| Custom fields | Not supported | Custom prompts for vertical data |

## Confidence Scoring

Each AI-enriched field includes a confidence score:
- **90-100%**: Very reliable, multiple sources agree
- **70-89%**: Likely accurate, some verification
- **50-69%**: Possible, needs review
- **<50%**: Low confidence, treat as suggestion

## Custom Vertical Attributes

Define custom enrichment fields for your industry:
1. Go to **Settings → Custom Attributes**
2. Define a field (e.g., "bed_count" for healthcare)
3. Write an enrichment prompt
4. AI will extract this data during enrichment

## Reviewing Results

AI-enriched fields are marked with confidence indicators. Check the enrichment job details for:
- Source breakdown (which provider found which field)
- Confidence per field
- Cost per record`,
    keywords: ['ai', 'enrichment', 'intelligence', 'signals', 'confidence', 'web', 'analysis', 'insights', 'waterfall', 'perplexity', 'firecrawl'],
    category: 'concepts',
    relatedPages: ['/accounts', '/settings']
  },

  // ==================== LEAD MANAGEMENT ====================
  {
    id: 'lead-management',
    title: 'Managing Leads',
    description: 'Work with contacts and their account relationships',
    content: `# Lead Management

Leads (contacts) are the people at your target accounts. Here's how to manage them effectively.

## Leads vs Accounts

| Concept | Description | Example |
|---------|-------------|---------|
| Account | Company | Acme Corp |
| Lead | Person at company | Jane Doe, VP Sales |

## Viewing Leads

Navigate to **Leads** to see all contacts:

### Key Fields
- Name & title
- Email & phone
- Account association
- Lead score
- Last activity

### Filters
- By account (fit score, industry)
- By persona (title, seniority)
- By status (new, contacted, qualified)
- By data quality (verified email)

## Lead-to-Account Matching

LaunchPulse automatically links leads to accounts by:
1. **Email domain matching** (e.g., jane@acme.com → acme.com)
2. **Website/domain matching**
3. **Company name matching** (creates new accounts if needed)

The \`bulk_match_all_leads\` function runs in batches of 2,000 leads, creating accounts with firmographic data from leads when no matching account exists.

### Unmatched Leads
If a lead can't be matched:
- Can create new account from lead
- Can manually assign to existing account

## Lead Actions

### Individual
- View lead details
- Edit information
- Add to campaign
- Log activity

### Bulk
- Select multiple leads
- Add to campaign
- Update status
- Export to CSV

## Lead Scoring

Leads receive scores based on:
- Account fit score (inherited)
- Title/seniority match
- Email verification status
- Engagement signals`,
    keywords: ['leads', 'contacts', 'people', 'manage', 'account', 'matching', 'orphan'],
    category: 'quickstart',
    relatedPages: ['/leads', '/accounts']
  },

  // ==================== SETTINGS & ADMIN ====================
  {
    id: 'settings-guide',
    title: 'Settings & Configuration',
    description: 'Configure your workspace and preferences',
    content: `# Settings Overview

Access settings via the gear icon in the sidebar.

## Account Settings

### Profile
- Update name and email
- Change password
- Set timezone

### Notifications
- Email digest frequency
- Alert preferences
- Campaign notifications
- Agent status updates

## Workspace Settings

### General
- Workspace name
- Default ICP
- Branded configuration

### Team Management
- Invite users
- Set roles (Admin, Member, Viewer)
- Remove users

### API Keys
- Generate API keys
- Set key permissions
- View usage
- Revoke keys

## Integration Settings

### Enrichment
- View credit balance and usage
- Monitor enrichment jobs
- Configure custom attribute definitions
- Set enrichment preferences

### Webhooks
- Outbound webhooks
- Event triggers
- Payload format
- Delivery logs

## Data Settings

### Privacy
- Data retention period
- Export data
- Delete data
- GDPR compliance

### Import/Export
- Upload templates
- Export formats
- Scheduled exports

## Quick Links

| Setting | Path |
|---------|------|
| Profile | Settings → Profile |
| Team | Settings → Team |
| Enrichment | Settings → Enrichment |
| API | Settings → API Keys |`,
    keywords: ['settings', 'configuration', 'profile', 'workspace', 'team', 'api', 'integrations'],
    category: 'workflows',
    relatedPages: ['/settings']
  },
  {
    id: 'user-roles',
    title: 'User Roles & Permissions',
    description: 'Understanding access levels in your workspace',
    content: `# User Roles & Permissions

Control what team members can see and do in LaunchPulse.

## Role Types

### Admin
Manage workspace and users:
- Invite/remove users
- Create/edit ICPs
- Manage integrations
- View all data
- Configure settings

### Member
Standard user access:
- View accounts and leads
- Build campaigns
- Use AI features
- Export data
- Cannot manage users

### Viewer
Read-only access:
- View dashboards
- View accounts (no edit)
- View reports
- Cannot export

## Permission Matrix

| Action | Admin | Member | Viewer |
|--------|-------|--------|--------|
| View data | ✅ | ✅ | ✅ |
| Edit accounts | ✅ | ✅ | ❌ |
| Build campaigns | ✅ | ✅ | ❌ |
| Export data | ✅ | ✅ | ❌ |
| Manage ICPs | ✅ | ❌ | ❌ |
| User management | ✅ | ❌ | ❌ |

## Managing Roles

### Invite New User
1. Go to **Settings → Team**
2. Click **Invite User**
3. Enter email
4. Select role
5. Send invite

### Change Role
1. Find user in team list
2. Click role dropdown
3. Select new role
4. Confirm change

## Best Practices

👥 **Least privilege**: Start with Viewer, upgrade as needed

👥 **Multiple admins**: Have 2+ admins for continuity

👥 **Regular audits**: Review access quarterly`,
    keywords: ['roles', 'permissions', 'access', 'admin', 'member', 'viewer', 'team', 'users'],
    category: 'concepts',
    relatedPages: ['/settings']
  },

  // ==================== DATA OPERATIONS ====================
  {
    id: 'bulk-operations',
    title: 'Bulk Data Operations',
    description: 'Efficiently manage large datasets with bulk actions',
    content: `# Bulk Operations

Perform actions on multiple records at once.

## Bulk Selection

### Select All on Page
Click the checkbox in the header to select all visible records.

### Select All Matching
After filtering, click **Select all X matching** to include all filtered records (not just visible).

### Manual Selection
Hold **Shift** and click to select a range.
Hold **Cmd/Ctrl** and click for individual selection.

## Available Bulk Actions

### Accounts

| Action | Description |
|--------|-------------|
| **Add to Campaign** | Create campaign from selection |
| **Re-score** | Recalculate fit scores |
| **Enrich** | Trigger Smart Enrichment waterfall |
| **Export** | Download as CSV |
| **Update Field** | Edit common fields |
| **Archive** | Remove from active view |
| **Delete** | Permanently remove |

### Leads

| Action | Description |
|--------|-------------|
| **Add to Campaign** | Include in campaign |
| **Assign to Account** | Link orphan leads |
| **Update Status** | Change lead status |
| **Export** | Download as CSV |
| **Delete** | Permanently remove |

## Merge Duplicates

Find and merge duplicate accounts:

1. Go to **Accounts → Duplicates**
2. Review suggested matches
3. Select merge strategy:
   - Keep newest data
   - Keep oldest data
   - Manual field selection
4. Click **Merge**
5. Leads auto-transfer to merged account

## Performance Tips

⚡ **Large operations**: Operations on 1000+ records run in background

⚡ **Progress tracking**: Check Jobs panel for status

⚡ **Timing**: Run bulk operations during off-hours

⚡ **Batching**: System automatically batches large selections`,
    keywords: ['bulk', 'mass', 'operations', 'select', 'edit', 'delete', 'archive', 'merge', 'duplicates'],
    category: 'workflows',
    relatedPages: ['/accounts', '/leads']
  }
];

// Video tutorials - empty until real content is available
export const videoTutorials: VideoTutorial[] = [];
