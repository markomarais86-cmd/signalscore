# ICP Manager Guide

**Version:** 1.0  
**Last Updated:** 2025-11-25  
**Author:** LaunchPulse Product Team

## Overview

The ICP (Ideal Customer Profile) Manager allows you to define, manage, and analyze your target customer profiles. ICPs are the foundation of LaunchPulse's scoring engine and campaign builder.

**Access**: Navigate to **ICP Manager** from the main navigation.

## What is an ICP?

An Ideal Customer Profile (ICP) is a detailed description of the type of company that would benefit most from your product or service.

**Components**:
- **Firmographics**: Industry, geography, size, revenue
- **Technographics**: Technology stack and tools used
- **Behavioral**: Funding status, growth stage, buying signals
- **Personas**: Job titles, departments, seniority levels of contacts

**Why ICPs matter**:
- Focus sales and marketing efforts on best-fit accounts
- Prioritize leads based on fit score
- Build targeted campaigns
- Measure TAM/SAM/SOM accurately
- Align sales and marketing teams

## Creating Your First ICP

### Step 1: Start the ICP Wizard

1. Navigate to **ICP Manager**
2. Click **"Create New ICP"**
3. Choose creation method:
   - **Start from scratch**: Build ICP manually
   - **Use template**: Start with industry template
   - **Learn from data**: Analyze closed-won deals (recommended)

### Step 2: Basic Information

**ICP Name**: Give your ICP a descriptive name
- Examples: "Enterprise SaaS", "SMB FinTech", "Mid-Market E-commerce"
- Tip: Be specific enough to distinguish multiple ICPs

**Description**: Explain what this ICP represents
- Who is the target customer?
- What problems do they have?
- Why do they need your solution?

**Category**: Select ICP type
- Primary (main target market)
- Secondary (expansion market)
- Experimental (testing new segment)

### Step 3: Define Firmographics

**Industries** (required)
Select target industries from dropdown:
- Software / SaaS
- Financial Services / FinTech
- Healthcare / MedTech
- E-commerce / Retail
- Manufacturing
- [+50 more industries]

**Tip**: Select normalized industry names for better matching. LaunchPulse will map variations (e.g., "SaaS" matches "Software as a Service", "Cloud Software", etc.)

**Geographies** (required)
Select target countries or regions:
- United States
- Canada
- United Kingdom
- Europe (all countries)
- North America (US + Canada + Mexico)
- [+195 countries]

**Company Sizes** (required)
Select target employee count ranges:
- 1-10 (Startups)
- 11-50 (Small businesses)
- 51-200 (Mid-market)
- 201-1000 (Enterprise)
- 1000-5000 (Large enterprise)
- 5000+ (Mega-corp)

**Tip**: Select 1-2 adjacent tiers for best results. Too broad = lower fit scores.

**Revenue Ranges** (optional but recommended)
Select target revenue ranges:
- $0-1M
- $1M-10M
- $10M-50M
- $50M-100M
- $100M-500M
- $500M+

**Tip**: Revenue data is less available than size data, but highly valuable when present.

### Step 4: Technology Stack (Optional)

**Tech Stack** (optional)
Select technologies your ideal customers use:
- CRM: Salesforce, HubSpot, Microsoft Dynamics
- Marketing: Marketo, Pardot, HubSpot Marketing
- Sales Tools: Outreach, SalesLoft, Groove
- Cloud: AWS, Azure, Google Cloud
- Data: Snowflake, Databricks, Redshift
- [+500 more technologies]

**Why it matters**:
- Indicates technical maturity
- Signals budget for software
- Shows process sophistication
- Enables ABM plays (e.g., Salesforce users for your Salesforce app)

**Tip**: Start with 3-5 critical technologies. You can add more later.

### Step 5: Persona Criteria (Optional)

**Job Titles**
Target contact titles:
- VP Sales, Sales Director, Head of Sales
- Chief Revenue Officer (CRO), Head of Revenue
- VP Marketing, CMO, Head of Demand Gen
- CEO, Founder (for small companies)
- [Custom titles...]

**Departments**
Target departments:
- Sales
- Marketing
- Revenue Operations
- Customer Success
- [Custom departments...]

**Seniority Levels**
Target seniority:
- C-Level (CEO, CRO, CMO, etc.)
- VP-Level
- Director-Level
- Manager-Level
- IC (Individual Contributor)

**Decision Roles**
Target roles in buying process:
- Economic Buyer (signs the check)
- Champion (internal advocate)
- Influencer (provides input)
- User (end user of product)

**Tip**: Persona criteria are used in Campaign Builder to find the right contacts at target accounts.

### Step 6: Advanced Criteria (Optional)

**Funding Status**
Target funding stages:
- Bootstrapped
- Seed
- Series A
- Series B
- Series C+
- Public

**Growth Indicators**
- Recent funding (last 12 months)
- Rapid hiring (20%+ headcount growth)
- Expansion signals (new offices, new products)

**Exclusions**
Exclude specific companies or industries:
- Competitors
- Industries you don't serve
- Specific companies (blocklist)

### Step 7: Review & Create

**Preview**:
- Review all ICP criteria
- See estimated match count (accounts matching this ICP)
- View sample accounts matching this profile

**Validate**:
- If you have closed-won data, see how many wins match this ICP
- Adjust criteria if validation shows poor match

**Create**:
- Click "Create ICP"
- LaunchPulse immediately starts scoring accounts against this ICP
- Progress bar shows scoring status

## Using ICP Templates

### Pre-Built Templates

LaunchPulse includes 20+ industry templates:

**B2B SaaS (Enterprise)**:
- Industries: Software, SaaS, Cloud Computing
- Geographies: US, Canada, UK, Western Europe
- Size: 201-1000 employees
- Revenue: $10M-100M
- Tech: Salesforce, AWS, HubSpot

**B2B SaaS (SMB)**:
- Industries: Software, SaaS
- Geographies: US, Canada
- Size: 11-200 employees
- Revenue: $1M-10M
- Tech: HubSpot, Google Workspace

**FinTech (Enterprise)**:
- Industries: Banking, FinTech, Financial Services
- Geographies: US, UK, Singapore
- Size: 500-5000 employees
- Revenue: $100M+
- Tech: Salesforce, AWS, Snowflake

**[+17 more templates]**

### Using a Template

1. Click "Create New ICP"
2. Select "Use Template"
3. Choose template from gallery
4. Customize criteria (templates are starting points)
5. Save as new ICP

## Analyzing Closed-Won Deals

### Why Analyze Wins?

Learning from your historical wins improves scoring accuracy:
- Identifies which dimensions correlate with conversion
- Adjusts ICP criteria based on real data
- Boosts scores for accounts matching win patterns
- Reveals hidden ICP characteristics

### Upload Closed-Won Data

1. Navigate to **ICP Manager** → **"Analyze Wins"**
2. Click **"Upload Closed-Won Deals"**
3. Download CSV template
4. Fill in your closed-won deals:
   - Account name or domain (required)
   - Close date (required)
   - Deal value (optional but recommended)
   - Sales cycle days (optional)
5. Upload CSV
6. Map fields if needed
7. Click "Import Deals"

**Data sources**:
- CRM opportunity reports
- Finance/billing data
- Sales team spreadsheets

**Tip**: Upload at least 20-50 deals for meaningful analysis.

### View Analysis Results

After upload, LaunchPulse automatically analyzes correlations:

**Industry Analysis**:
- Which industries close most frequently?
- Industry → Conversion rate
- Example: "SaaS accounts close 2.5x more than average"

**Geography Analysis**:
- Which regions have highest close rates?
- Example: "US West Coast accounts close 30% faster"

**Size Analysis**:
- Which company sizes convert best?
- Example: "200-500 employee accounts have 2x higher ACV"

**Revenue Analysis**:
- Which revenue ranges close most?
- Example: "$10M-50M companies have shortest sales cycle"

**Tech Stack Analysis**:
- Which technologies correlate with wins?
- Example: "Salesforce users convert 40% more"

### Apply Findings to ICP

1. Review correlation analysis
2. Click "Adjust ICP Based on Findings"
3. LaunchPulse suggests ICP modifications:
   - Add high-converting industries
   - Remove low-converting criteria
   - Adjust company size ranges
4. Review suggestions
5. Apply changes
6. Re-score all accounts (automatic)

**Result**: Accounts matching your win patterns get higher scores.

## Managing Multiple ICPs

### Use Cases for Multiple ICPs

**Segment by Market**:
- ICP 1: Enterprise (1000+ employees)
- ICP 2: Mid-Market (201-1000 employees)
- ICP 3: SMB (11-200 employees)

**Segment by Vertical**:
- ICP 1: SaaS
- ICP 2: FinTech
- ICP 3: HealthTech

**Segment by Geography**:
- ICP 1: North America
- ICP 2: EMEA
- ICP 3: APAC

**Segment by Product**:
- ICP 1: Product A (enterprise features)
- ICP 2: Product B (SMB features)

### Working with Multiple ICPs

**View All ICPs**:
- ICP Manager shows list of all ICPs
- Sort by: Name, Match Count, Average Score, Last Updated

**Compare ICPs**:
- Select 2-3 ICPs
- Click "Compare"
- See side-by-side comparison:
  - Criteria differences
  - Match counts
  - Average scores
  - Closed-won overlap

**Set Primary ICP**:
- Mark one ICP as "Primary"
- Primary ICP used in Executive Dashboard by default
- Used in Campaign Builder pre-filters

**Archive ICP**:
- Mark old ICPs as "Archived"
- Keeps historical scores but removes from active use
- Useful for seasonal or experimental ICPs

## ICP Performance Metrics

### Key Metrics per ICP

**Match Count**:
- Total accounts matching this ICP
- Breakdown by score band (A/B/C/D)

**Average Score**:
- Mean fit score for this ICP
- Trend over time

**Closed-Won Rate**:
- Conversion rate for accounts in this ICP
- Requires closed-won data upload

**Campaign Performance**:
- Accounts from this ICP in active campaigns
- Response rates, meeting rates (if integrated)

**TAM Estimate**:
- Total addressable market for this ICP
- SAM: Serviceable addressable market
- SOM: Serviceable obtainable market

### ICP Health Dashboard

**Data Coverage**:
- Percentage of ICP-matching accounts with complete data
- Fields with low coverage highlighted

**Scoring Coverage**:
- Percentage of ICP-matching accounts with scores
- Accounts pending scoring

**Contact Coverage**:
- Percentage of ICP-matching accounts with contacts
- Critical for campaign building

**Enrichment Status**:
- Percentage of ICP-matching accounts enriched
- Cost estimate to enrich remaining accounts

## Editing & Versioning

### Edit Existing ICP

1. Click ICP in ICP Manager
2. Click "Edit ICP"
3. Modify criteria
4. Click "Save Changes"

**What happens**:
- New version created (version number increments)
- All accounts re-scored automatically
- Historical scores preserved
- Score history shows when ICP changed

**Tip**: Major ICP changes create new version. Minor edits (e.g., fixing typo in description) don't.

### Version History

View all versions of an ICP:
1. Open ICP detail
2. Click "Version History"
3. See list of versions with:
   - Version number
   - Created date
   - Created by (user)
   - Changes made
   - Match count at that time

**Compare Versions**:
- Select two versions
- Click "Compare"
- See diff of criteria changes
- See impact on match count and scores

### Clone ICP

Create a copy of an ICP:
1. Open ICP detail
2. Click "Clone ICP"
3. New ICP created with suffix " (Copy)"
4. Modify as needed
5. Save as new ICP

**Use cases**:
- Test ICP variations
- Create region-specific ICPs
- A/B test different criteria

## Best Practices

### Start Narrow, Expand Later

**Why**: Narrow ICPs produce higher-quality leads
- Begin with 1-2 industries, 1-2 geographies, 1 size tier
- Validate with sales team feedback
- Gradually expand criteria

**Example progression**:
- V1: SaaS, US, 201-1000 employees
- V2: SaaS + FinTech, US + Canada, 201-1000 employees
- V3: SaaS + FinTech, North America + UK, 201-1000 employees

### Use Closed-Won Data Early

**Why**: Real data beats assumptions
- Upload closed-won deals ASAP
- Re-analyze quarterly
- Let data guide ICP refinements

### Name ICPs Descriptively

**Good names**:
- "Enterprise SaaS (US)"
- "SMB FinTech (Global)"
- "Mid-Market E-commerce (EMEA)"

**Bad names**:
- "ICP 1"
- "Test"
- "My ICP"

### Document ICP Changes

**Best practice**: Add notes when editing ICP
- Why did you change it?
- What did sales feedback say?
- What data informed the change?

This helps future you (and your team) understand evolution.

### Review ICPs Quarterly

**Quarterly ICP review checklist**:
- ✅ Upload last quarter's closed-won deals
- ✅ Run correlation analysis
- ✅ Compare ICP criteria to win patterns
- ✅ Adjust ICP based on findings
- ✅ Re-score all accounts
- ✅ Document changes
- ✅ Share with sales and marketing teams

## Troubleshooting

### No Accounts Match My ICP

**Possible causes**:
- ICP too narrow
- Missing data on accounts
- Incorrect industry/geography normalization

**Fix**:
1. Review ICP criteria (too restrictive?)
2. Check data quality (accounts missing firmographic data?)
3. Try "Preview Matches" before saving ICP
4. Relax one constraint at a time

### ICP Scores Too Low

**Possible causes**:
- ICP doesn't match your actual customer base
- Account data incomplete (affects scoring)
- ICP criteria mismatch (e.g., selected wrong industries)

**Fix**:
1. Upload closed-won deals to see if they match ICP
2. Run enrichment to improve data quality
3. Review ICP criteria against actual wins
4. Adjust ICP based on data

### Scoring Job Stuck

**Possible causes**:
- Too many accounts (>50K)
- Database performance issue
- Edge function timeout

**Fix**:
1. Check scoring job status (Settings → Scoring)
2. View error logs if available
3. Wait 10 minutes and retry
4. Contact support if issue persists

## Related Documentation

- [Scoring Overview](../08_Scoring_Engine/Scoring_Overview.md) - How scores are calculated
- [Closed-Won Analysis](../08_Scoring_Engine/Closed_Won_Analysis.md) - Learning from wins
- [Campaign Builder Guide](./Campaign_Builder_Guide.md) - Using ICPs in campaigns
- [Account Management Guide](./Account_Management_Guide.md) - Viewing account scores

## Support

For ICP questions:
- **Email**: support@launchpulse.ai
- **Slack**: #launchpulse-support
- **Book a Call**: [calendly.com/launchpulse](https://calendly.com/launchpulse)
