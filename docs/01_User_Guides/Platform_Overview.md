# Platform Overview

**Version:** 1.0  
**Last Updated:** 2025-11-25  
**Author:** LaunchPulse Product Team

## Welcome to LaunchPulse

LaunchPulse is a B2B account intelligence platform that helps you:
- 🎯 **Score accounts** against your Ideal Customer Profile (ICP)
- 📊 **Enrich firmographic data** from multiple providers
- 🚀 **Build targeted campaigns** for sales and marketing
- 🔗 **Sync with your CRM** (Salesforce, HubSpot)
- 🤖 **Automate workflows** with AI agents

## Getting Started

### 1. Connect Your CRM

**Salesforce or HubSpot** → Settings → Integrations → Connect

LaunchPulse will import your:
- Accounts (companies)
- Contacts (leads)
- Opportunities (deals)
- Activities (optional)

**Initial sync**: 30-120 minutes depending on data volume  
**Ongoing sync**: Every 4 hours automatically

### 2. Define Your ICP

**ICP Manager** → Create New ICP

Define your ideal customer by:
- Industries (e.g., SaaS, FinTech)
- Geographies (e.g., United States, Europe)
- Company size (e.g., 100-1000 employees)
- Revenue range (e.g., $10M-50M)
- Technology stack (e.g., Salesforce, AWS)

**💡 Tip**: Upload closed-won deals to let LaunchPulse learn from your historical wins.

### 3. Enrich Your Data

**Settings** → Data Quality → Bulk Enrichment

LaunchPulse fills in missing firmographic data using:
- PDL (People Data Labs)
- Clearbit
- AI estimation
- Deep research (high-value accounts)

**Cost**: ~$0.01-0.10 per account depending on enrichment depth

### 4. Score Your Accounts

**Accounts** → Bulk Score

LaunchPulse evaluates each account against your ICP:
- **0-100 score**: How well the account fits your ICP
- **A/B/C/D band**: Easy filtering by fit level
- **Dimension breakdown**: See which dimensions match/mismatch

**Scoring speed**: ~10,000 accounts per hour

### 5. Build Campaigns

**Campaign Builder** → New Campaign

Filter accounts by:
- ICP fit score (e.g., A-band only)
- Geography, industry, size
- Persona criteria (job titles, departments)
- Contact availability

**Export options**:
- CSV download
- Salesforce campaign
- HubSpot list
- Outreach sequence

## Main Navigation

### 📊 Executive Dashboard

High-level overview of your account universe:
- Score distribution (A/B/C/D bands)
- TAM/SAM/SOM estimates
- Data quality metrics
- Geography breakdown
- Industry analysis
- Recent insights and recommendations

**Best for**: Weekly executive reviews, board presentations

### 🏢 Accounts

View and manage all accounts:
- Search, filter, sort accounts
- View ICP fit scores and bands
- See enrichment status
- Open account details (360° view)
- Export to CSV

**Best for**: Sales ops, account prioritization

### 👥 Leads

View and manage all contacts:
- Filter by persona, title, department
- View lead-account linkage
- See contact enrichment status
- Campaign inclusion history

**Best for**: SDR teams, lead routing

### 🎯 ICP Manager

Create and manage Ideal Customer Profiles:
- Define ICP criteria
- View ICP performance
- Compare multiple ICPs
- Clone and modify ICPs
- Validate against closed-won deals

**Best for**: Marketing ops, strategy teams

### 🚀 Campaign Builder

Build targeted outbound campaigns:
- Filter by ICP and score
- Match personas to accounts
- Deduplicate contacts
- Export to CRM or CSV
- Track campaign history

**Best for**: Demand gen, SDR managers

### ⚙️ Settings

Configure integrations and preferences:
- **Integrations**: Connect CRMs and tools
- **Data Quality**: Run enrichment jobs
- **Scoring**: Configure scoring jobs
- **API Keys**: Manage external provider keys
- **Users & Permissions**: Invite team members
- **AI Agents**: Configure automation

**Best for**: Admins, platform owners

## Core Concepts

### Accounts vs Leads

- **Account**: A company/organization (e.g., "Acme Corp")
- **Lead**: A person/contact at an account (e.g., "John Doe at Acme Corp")

LaunchPulse automatically links leads to accounts using domain matching.

### ICP Fit Score

A 0-100 score indicating how well an account matches your ICP definition:
- **80-100** (A): Perfect fit, high priority
- **60-79** (B): Good fit, qualified
- **40-59** (C): Potential fit, nurture
- **0-39** (D): Poor fit, low priority

### Data Sources

- **CRM**: Data synced from Salesforce/HubSpot
- **Enrichment**: Data from PDL, Clearbit, AI
- **External**: Data from Apollo, ZoomInfo, Clay
- **Manual**: Data uploaded via CSV

### Enrichment Phases

1. **PDL**: Fast, cheap, 40% coverage
2. **Clearbit**: Free tier, 30% coverage
3. **AI Estimation**: GPT-4 based, 80% coverage
4. **Deep Research**: Manual-quality, high-value only

### Campaign Deduplication

Prevents sending to the same contact multiple times:
- Checks past 90 days of campaign exports
- Excludes contacts in active sequences
- Configurable lookback window

## Key Workflows

### Weekly Account Review
1. Open **Executive Dashboard**
2. Review score distribution
3. Check data quality metrics
4. Review "Accounts Needing Attention"
5. Export A-band accounts for outreach

### Building a Campaign
1. Open **Campaign Builder**
2. Select ICP and minimum score (e.g., B-band+)
3. Add persona filters (job titles, departments)
4. Preview account/contact counts
5. Set deduplication rules
6. Export to CRM or CSV

### Quarterly ICP Review
1. Upload closed-won deals (last quarter)
2. Navigate to **ICP Manager**
3. Click "Analyze Wins"
4. Review correlation analysis
5. Adjust ICP criteria based on findings
6. Re-score all accounts

### Fixing Data Quality Issues
1. Open **Settings** → **Data Quality**
2. Review completeness scores
3. Filter accounts missing critical fields
4. Click "Enrich Selected Accounts"
5. Monitor enrichment job progress
6. Re-score after enrichment completes

## Common Questions

### Q: How much does enrichment cost?
**A**: ~$0.01-0.10 per account depending on depth. Budget ~$100-500 for 10,000 accounts.

### Q: How often does CRM sync run?
**A**: Every 4 hours automatically. You can also trigger manual sync in Settings.

### Q: Can I have multiple ICPs?
**A**: Yes! Create multiple ICPs for different segments (e.g., Enterprise vs SMB).

### Q: How do I export data?
**A**: Use "Export" buttons in Accounts, Leads, or Campaign Builder. CSV and CRM push supported.

### Q: What's the difference between scoring and enrichment?
**A**:
- **Enrichment**: Filling in missing firmographic data
- **Scoring**: Evaluating accounts against your ICP

### Q: Can I customize score weights?
**A**: Not yet (planned Q1 2026). Current weights are industry best practices.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Global search |
| `Ctrl/Cmd + ,` | Open Settings |
| `Ctrl/Cmd + /` | Open help panel |
| `Esc` | Close drawer/modal |

## Getting Help

### In-App Help
- Click **?** icon in top right
- Hover over field labels for tooltips
- Check "Help" tab in each page

### Documentation
- [docs.launchpulse.ai](https://docs.launchpulse.ai)
- Video tutorials: [youtube.com/launchpulse](https://youtube.com/launchpulse)

### Support
- **Email**: support@launchpulse.ai
- **Slack**: #launchpulse-support
- **Live Chat**: Click chat bubble (9am-5pm ET)

## Next Steps

1. ✅ **Complete onboarding**: Connect CRM, create ICP
2. ✅ **Enrich accounts**: Run bulk enrichment
3. ✅ **Score accounts**: Run bulk scoring
4. ✅ **Build first campaign**: Export 50 A-band accounts
5. ✅ **Schedule weekly review**: Add recurring calendar event

**Ready to dive deeper?** Check out:
- [15-Minute Setup Guide](../02_Quick_Start/15_Minute_Setup.md)
- [ICP Manager Guide](./ICP_Manager_Guide.md)
- [Campaign Builder Guide](./Campaign_Builder_Guide.md)

---

**Welcome aboard!** 🚀
