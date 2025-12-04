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

LaunchPulse is your AI-powered platform for identifying, scoring, and prioritizing your ideal customers.

## What You Can Do

**1. Score Your Accounts**
Upload your account data and get instant AI-powered fit scores (0-100) that tell you exactly which accounts match your Ideal Customer Profile.

**2. Build Targeted Campaigns**
Filter accounts by fit score, industry, size, and more to build laser-focused campaign lists.

**3. Enrich Your Data**
Automatically enhance your account data with firmographic information from multiple providers.

**4. Track Performance**
Monitor your ICP coverage, data quality, and campaign performance from the Executive Dashboard.

## Quick Start Checklist

1. ✅ Upload your accounts (CSV or CRM sync)
2. ✅ Create your first ICP
3. ✅ Review your fit score distribution
4. ✅ Build your first campaign

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
| 80-100 | **High Fit** | Strong match. Prioritize for outreach. |
| 60-79 | **Medium Fit** | Good potential. Worth further research. |
| 0-59 | **Low Fit** | Poor match. Deprioritize or exclude. |

## How Scoring Works

### 1. Criteria Matching
Each ICP criterion is checked against account attributes:
- ✅ Full match = 100% of weight
- ⚡ Partial match = Proportional points
- ❌ No match = 0 points

### 2. Weight Distribution
Different criteria carry different weights:
- **Industry**: 25% (highest impact)
- **Company Size**: 20%
- **Geography**: 15%
- **Revenue**: 15%
- **Tech Stack**: 15%
- **Signals**: 10%

### 3. Score Calculation
\`\`\`
Final Score = Σ (Criterion Weight × Match Score)
\`\`\`

## Example

Account: Acme Corp
- Industry: SaaS ✅ (25 pts)
- Size: 150 employees ✅ (20 pts)
- Location: USA ✅ (15 pts)
- Revenue: Unknown ⚡ (7.5 pts)
- Tech: Salesforce ✅ (15 pts)

**Total Score: 82.5 (High Fit)**

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

*In LaunchPulse: High + Medium fit accounts (score ≥ 60)*

### SOM (Serviceable Obtainable Market)
**Your capture opportunity**

The portion of SAM you can realistically win based on resources, competition, and capacity.

*In LaunchPulse: High fit accounts (score ≥ 80) within your sales capacity*

## How LaunchPulse Calculates

| Metric | Calculation |
|--------|-------------|
| TAM | All accounts in database |
| SAM | Accounts with fit score ≥ 60 |
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
    title: 'Data Sources & Enrichment',
    description: 'How your data is enhanced automatically',
    content: `# Data Enrichment

LaunchPulse automatically enhances your account data using multiple enrichment providers.

## Enrichment Providers

| Provider | Best For | Data Types |
|----------|----------|------------|
| **Clearbit** | Firmographics | Logo, size, industry, tech |
| **ZoomInfo** | B2B Intelligence | Contacts, org charts |
| **Apollo** | Lead Data | Emails, direct dials |
| **PDL** | Person Data | Job history, skills |

## What Gets Enriched

### Company Data
- Employee count & growth rate
- Revenue estimates
- Industry classification
- Technology stack
- Funding history
- Social profiles

### Contact Data
- Email verification
- Phone numbers
- Job titles & seniority
- Department classification

## Enrichment Priority

LaunchPulse uses a smart cascade:
1. Check existing data quality
2. Try primary provider (based on field type)
3. Fall back to secondary providers
4. Cache results to reduce costs

## Monitoring Costs

Go to **Settings → Enrichment** to:
- View credits used per provider
- Set monthly spending caps
- See enrichment coverage rates
- Track cost per enriched account`,
    keywords: ['data', 'sources', 'enrichment', 'clearbit', 'zoominfo', 'apollo', 'pdl', 'providers', 'enhance'],
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
- High: 15-25%
- Medium: 25-35%
- Low: 40-60%

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

## Interactive Features

🖱️ **Click any card** to drill down into details

🔍 **Filter by ICP** to see segment-specific metrics

📊 **Export data** for offline analysis

⚡ **Set alerts** for threshold notifications

## Trend Indicators

- 📈 Green arrow: Improving vs last week
- 📉 Red arrow: Declining vs last week
- ➡️ Gray: No significant change`,
    keywords: ['dashboard', 'metrics', 'kpi', 'overview', 'executive', 'summary', 'coverage', 'distribution', 'quality'],
    category: 'concepts',
    relatedPages: ['/']
  },

  // ==================== WORKFLOWS ====================
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
    id: 'crm-integration',
    title: 'CRM Integration Setup',
    description: 'Connect Salesforce or HubSpot in minutes',
    content: `# CRM Integration

Sync LaunchPulse data bi-directionally with your CRM.

## Salesforce Setup

1. Go to **Settings → Integrations**
2. Click **Connect Salesforce**
3. Log in and authorize LaunchPulse
4. Map fields:
   - Account → Account
   - Contact → Lead
   - Fit Score → Custom field
5. Choose sync frequency (hourly/daily)
6. Enable sync

## HubSpot Setup

1. Go to **Settings → Integrations**
2. Click **Connect HubSpot**
3. Authorize in HubSpot
4. Select properties to sync
5. Set sync schedule
6. Activate

## What Syncs

| LaunchPulse | CRM |
|-------------|-----|
| Accounts | Accounts/Companies |
| Leads | Contacts/Leads |
| Fit Scores | Custom property |
| ICP Segment | Custom property |
| Enriched data | Mapped fields |

## Sync Modes

**One-way (LP → CRM)**: Safe, recommended to start
**Bi-directional**: Updates flow both ways

## Troubleshooting

⚠️ **Sync failed**: Check API permissions

⚠️ **Missing records**: Verify field mappings

⚠️ **Duplicates**: Enable deduplication rules`,
    keywords: ['crm', 'integration', 'salesforce', 'hubspot', 'sync', 'connect', 'setup'],
    category: 'workflows',
    relatedPages: ['/settings']
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
- High/Medium/Low buckets

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
| \`Cmd/Ctrl + K\` | Command palette |
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
- Enable auto-enrichment
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

⚡ Enable enrichment for missing firmographics

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

## Check API Configuration

1. Go to **Settings → Enrichment**
2. Verify API keys are entered
3. Click **Test Connection** for each provider
4. Check remaining credits/quota

## Common Issues

### "Enrichment stuck on pending"
**Causes**: Rate limits, queue backlog
**Fix**: Check rate limit settings, wait for queue to clear

### "No data returned"
**Causes**: Domain not in provider databases
**Fix**: Try alternative providers, manually add critical data

### "Costs higher than expected"
**Causes**: Auto-enrichment too aggressive
**Fix**: 
- Enrich only high-priority accounts
- Use free tier first
- Set monthly spending caps

### "Stale data"
**Causes**: Cached from old enrichment
**Fix**: Force re-enrichment in account settings

## Provider Priority

LaunchPulse enriches in this order:
1. Clearbit (free tier first)
2. ZoomInfo (if configured)
3. Apollo (if credits available)
4. PDL (fallback)

## Cost Optimization

💰 Start with Clearbit free tier

💰 Enrich in batches, not real-time

💰 Set spending caps per provider

💰 Focus on high-fit accounts first`,
    keywords: ['enrichment', 'not working', 'api', 'key', 'stuck', 'pending', 'error', 'cost', 'credits'],
    category: 'troubleshooting',
    relatedPages: ['/settings', '/accounts']
  },
  {
    id: 'sync-failures',
    title: 'CRM Sync Problems',
    description: 'Resolving sync errors with Salesforce and HubSpot',
    content: `# CRM Sync Troubleshooting

## Check Sync Status

1. Go to **Settings → Integrations**
2. View sync history and errors
3. Check last successful sync time

## Common Errors

### "Authentication failed"
**Cause**: Token expired or revoked
**Fix**: Disconnect and reconnect CRM

### "Field mapping error"
**Cause**: CRM field deleted or renamed
**Fix**: Update field mappings in settings

### "Rate limit exceeded"
**Cause**: Too many API calls
**Fix**: Reduce sync frequency, sync smaller batches

### "Record not found"
**Cause**: Record deleted in CRM
**Fix**: Run reconciliation to clean up

### "Duplicate detected"
**Cause**: Multiple records with same domain
**Fix**: Enable deduplication rules

## Sync Modes

**Full Sync**: Re-sync all records (hourly limit)
**Incremental**: Only changed records (recommended)

## Best Practices

✅ Start with one-way sync (LP → CRM)

✅ Test with small segment first

✅ Monitor sync logs weekly

✅ Set up error notifications`,
    keywords: ['sync', 'crm', 'error', 'salesforce', 'hubspot', 'failed', 'authentication', 'mapping'],
    category: 'troubleshooting',
    relatedPages: ['/settings']
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
- Role-based permissions
- SSO/SAML support
- Audit logging for all actions

### Infrastructure
- SOC 2 Type II compliant hosting
- Automatic backups (daily)
- 99.9% uptime SLA

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

## Plans

### Starter
- Up to 10,000 accounts
- 2 ICPs
- Basic enrichment
- Email support

### Professional
- Up to 100,000 accounts
- Unlimited ICPs
- Advanced enrichment
- CRM integrations
- Priority support

### Enterprise
- Unlimited accounts
- Custom integrations
- Dedicated success manager
- SLA guarantees
- SSO/SAML

## Enrichment Credits

Enrichment is usage-based:
- Clearbit: $0.05/account
- ZoomInfo: $0.10/account
- Apollo: $0.08/account

Monthly caps available to control spending.

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

## By Plan

| Plan | Accounts/Export | Contacts/Export | Exports/Month |
|------|-----------------|-----------------|---------------|
| Starter | 1,000 | 3,000 | 10 |
| Professional | 10,000 | 30,000 | Unlimited |
| Enterprise | Unlimited | Unlimited | Unlimited |

## Format Options

All plans support:
- CSV download
- Direct CRM sync
- Outreach platform integration

## Tips for Large Exports

If you need to export more than your limit:

1. **Segment your list** - Export in batches by region or fit score
2. **Use CRM sync** - Sync doesn't count against export limits
3. **Upgrade plan** - Contact sales for higher limits

## Export History

View all exports in **Settings → Export History**:
- Date and time
- Number of records
- Download link (7 days)`,
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
- Review enrichment failures
- Check sync error logs
- Spot-check new records

### Monthly
- Run duplicate detection
- Identify stale accounts
- Review data quality scores

### Quarterly
- Full database audit
- Archive inactive accounts
- Re-enrich priority accounts

## Quick Wins

⚡ Enable auto-enrichment for new records

⚡ Set up validation rules on upload

⚡ Create data quality alerts

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
- **ABM campaigns**: 80+ fit score
- **Demand gen**: 70+ fit score
- **Nurture**: 60+ fit score

### Diversity Matters
Include a mix of:
- Company sizes
- Geographies
- Sub-industries

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
    keywords: ['campaign', 'success', 'convert', 'best practice', 'outreach', 'abm'],
    category: 'best-practices',
    relatedPages: ['/accounts', '/leads']
  }
];

// Video tutorials
export const videoTutorials: VideoTutorial[] = [
  {
    id: 'quickstart-overview',
    title: 'LaunchPulse in 5 Minutes',
    description: 'A quick tour of the platform and key features',
    duration: '5:00',
    videoUrl: 'https://launchpulse.com/tutorials/quickstart',
    category: 'Getting Started'
  },
  {
    id: 'icp-creation',
    title: 'Creating Your First ICP',
    description: 'Step-by-step walkthrough of ICP creation',
    duration: '8:30',
    videoUrl: 'https://launchpulse.com/tutorials/icp-creation',
    category: 'Getting Started'
  },
  {
    id: 'data-upload-guide',
    title: 'Uploading & Mapping Data',
    description: 'How to import your accounts and leads',
    duration: '6:15',
    videoUrl: 'https://launchpulse.com/tutorials/data-upload',
    category: 'Getting Started'
  },
  {
    id: 'campaign-building',
    title: 'Building High-Converting Campaigns',
    description: 'Create targeted account lists for outreach',
    duration: '10:00',
    videoUrl: 'https://launchpulse.com/tutorials/campaigns',
    category: 'Workflows'
  },
  {
    id: 'crm-setup',
    title: 'CRM Integration Setup',
    description: 'Connect Salesforce or HubSpot in minutes',
    duration: '7:45',
    videoUrl: 'https://launchpulse.com/tutorials/crm-setup',
    category: 'Integrations'
  },
  {
    id: 'scoring-deep-dive',
    title: 'Understanding Fit Scores',
    description: 'How scoring works and how to optimize it',
    duration: '12:00',
    videoUrl: 'https://launchpulse.com/tutorials/scoring',
    category: 'Concepts'
  }
];
