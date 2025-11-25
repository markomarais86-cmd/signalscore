# 15-Minute Setup Guide

**Version:** 1.0  
**Last Updated:** 2025-11-25  
**Author:** LaunchPulse Product Team

## Overview

Get LaunchPulse up and running in 15 minutes. This fast-track guide covers:
1. Account creation & login (2 min)
2. CRM connection (5 min)
3. ICP creation (5 min)
4. First scoring & enrichment (3 min)

**Prerequisites**:
- Salesforce or HubSpot admin access
- 20-50 closed-won accounts (helpful but optional)

## Step 1: Account Creation (2 minutes)

### Sign Up

1. Go to [app.launchpulse.ai](https://app.launchpulse.ai)
2. Click **"Sign Up"**
3. Enter email and password
4. Verify email (check inbox)
5. Log in

### Create Organization

1. Click **"Create Organization"**
2. Enter company name
3. Select industry
4. Enter company size
5. Click **"Create"**

**Result**: You're now in your LaunchPulse workspace.

## Step 2: Connect Your CRM (5 minutes)

### Salesforce

1. Navigate to **Settings** → **Integrations**
2. Click **"Connect Salesforce"**
3. Click **"Authorize Salesforce"**
4. Log into Salesforce
5. Click **"Allow"** to grant permissions
6. You'll be redirected back to LaunchPulse
7. Click **"Start Initial Sync"**

**Sync time**: 30-120 minutes depending on data volume
- <1,000 records: ~5 minutes
- 1,000-10,000 records: ~30 minutes
- 10,000+ records: 1-2 hours

**What's imported**:
- Accounts (companies)
- Contacts (leads)
- Opportunities (optional)
- Account Teams (optional)

**Tip**: You can proceed with steps 3-4 while sync runs in background.

### HubSpot

1. Navigate to **Settings** → **Integrations**
2. Click **"Connect HubSpot"**
3. Click **"Authorize HubSpot"**
4. Log into HubSpot
5. Select account (if multiple)
6. Click **"Connect app"**
7. You'll be redirected back to LaunchPulse
8. Click **"Start Initial Sync"**

**Sync time**: Similar to Salesforce (30-120 min)

**What's imported**:
- Companies (accounts)
- Contacts (leads)
- Deals (optional)

**Tip**: Sync runs in the background. Move to next step.

## Step 3: Create Your First ICP (5 minutes)

### Option A: Use a Template (Fastest)

1. Navigate to **ICP Manager**
2. Click **"Create New ICP"**
3. Select **"Use Template"**
4. Choose template matching your business:
   - **B2B SaaS (Enterprise)**: Software companies, 201-1000 employees, $10M+ revenue
   - **B2B SaaS (SMB)**: Software companies, 11-200 employees, $1M-10M revenue
   - **FinTech**: Financial services, 100-5000 employees
   - **HealthTech**: Healthcare, 50-1000 employees
   - **[+16 more templates]**
5. Review and adjust criteria if needed
6. Click **"Create ICP"**

**Result**: ICP created. Scoring begins automatically.

### Option B: Learn from Closed-Won Deals (Most Accurate)

1. Navigate to **ICP Manager**
2. Click **"Create New ICP"**
3. Select **"Learn from Data"**
4. Click **"Upload Closed-Won Deals"**
5. Download CSV template
6. Fill in at least 20-50 closed-won accounts:
   - Account name or domain (required)
   - Close date (required)
   - Deal value (optional)
7. Upload CSV
8. Click **"Analyze and Create ICP"**

**Result**: LaunchPulse analyzes your wins and creates an ICP that matches your historical success patterns.

**Time**: +5 minutes if you need to export deals from CRM

### Option C: Build from Scratch

1. Navigate to **ICP Manager**
2. Click **"Create New ICP"**
3. Select **"Start from Scratch"**
4. Fill in ICP criteria:

**Step 1 - Basic Info**:
- Name: "My First ICP"
- Description: "Primary target market for our product"

**Step 2 - Industries** (select 2-5):
- Example: Software, SaaS, Cloud Computing

**Step 3 - Geographies** (select 1-3):
- Example: United States, Canada, United Kingdom

**Step 4 - Company Size** (select 1-2 tiers):
- Example: 201-1000 employees

**Step 5 - Revenue** (optional):
- Example: $10M-50M

**Step 6 - Tech Stack** (optional, select 3-5):
- Example: Salesforce, HubSpot, AWS

5. Click **"Create ICP"**

**Result**: ICP created. Scoring begins automatically.

## Step 4: Run Enrichment & Scoring (3 minutes)

### Quick Enrichment (Optional but Recommended)

While CRM sync is running (or after it completes), enrich your top accounts:

1. Navigate to **Settings** → **Data Quality**
2. Click **"Smart Enrichment"**
3. Select enrichment scope:
   - **Top 100 accounts** (recommended for quick start)
   - **A-band accounts only** (after scoring completes)
   - **All accounts** (more expensive, do later)
4. Review cost estimate
5. Click **"Start Enrichment"**

**Cost estimate**:
- 100 accounts: ~$5-10
- 1,000 accounts: ~$50-100
- 10,000 accounts: ~$500-1,000

**Time**: 10-30 minutes depending on account count

**What it fills in**:
- Employee count
- Revenue range
- Industry (if missing)
- Technology stack
- Funding data
- LinkedIn URLs

### Trigger Bulk Scoring

1. Navigate to **Settings** → **Scoring**
2. Click **"Refresh All Scores"**
3. Select ICP (the one you just created)
4. Click **"Start Scoring"**

**Scoring speed**:
- 100 accounts: ~10 seconds
- 1,000 accounts: ~2 minutes
- 10,000 accounts: ~25 minutes

**Result**: All accounts scored against your ICP.

## Step 5: View Results (1 minute)

### Executive Dashboard

1. Navigate to **Executive Dashboard**
2. See your score distribution:
   - A-band (80-100): High-fit accounts
   - B-band (60-79): Good-fit accounts
   - C-band (40-59): Potential fit
   - D-band (0-39): Low fit

3. Check data quality metrics
4. Review geography and industry breakdowns

### Accounts Page

1. Navigate to **Accounts**
2. Sort by score (descending)
3. Click top account to see detail drawer:
   - ICP fit score
   - Dimension breakdown
   - Enrichment status
   - Linked contacts

### First Campaign (Optional, +5 min)

1. Navigate to **Campaign Builder**
2. Click **"New Campaign"**
3. Select your ICP
4. Set minimum score: **80** (A-band only)
5. Add persona filter (optional):
   - Job titles: VP Sales, Sales Director
   - Departments: Sales
6. Set max contacts per account: **2**
7. Preview: See account and contact counts
8. Click **"Export to CSV"**

**Result**: CSV file with your highest-fit accounts and contacts ready for outreach.

## Quick Win Checklist

After 15 minutes, you should have:

- ✅ **CRM connected**: Syncing accounts and contacts
- ✅ **ICP created**: Defined your ideal customer profile
- ✅ **Accounts scored**: See A/B/C/D distribution
- ✅ **Top 100 enriched**: Improved data quality
- ✅ **First campaign** (optional): Exported high-fit accounts

## What's Next?

### Immediate (Today)

- ✅ **Review top 50 A-band accounts**: Do they look right?
- ✅ **Share with sales team**: Get feedback on quality
- ✅ **Enrich remaining accounts**: Run bulk enrichment
- ✅ **Set up campaign**: Export first 100 A-band accounts for outreach

### This Week

- 📅 **Upload closed-won deals**: Improve ICP accuracy
- 📅 **Configure CRM push**: Push scores back to Salesforce/HubSpot
- 📅 **Set up AI agents**: Automate lead qualification
- 📅 **Schedule weekly review**: Add 15-min calendar event

### This Month

- 📅 **Review ICP performance**: Compare ICP scores to actual wins
- 📅 **Create segment ICPs**: Add SMB, Mid-Market, Enterprise ICPs
- 📅 **Integrate campaign reporting**: Track campaign performance
- 📅 **Onboard SDR team**: Train on using LaunchPulse

## Troubleshooting

### CRM Sync Stuck

**Issue**: Sync shows "In Progress" for >2 hours

**Fix**:
1. Check integration status (Settings → Integrations)
2. View sync logs for errors
3. Verify CRM credentials are still valid
4. Contact support if issue persists

### No Accounts Scored

**Issue**: All accounts show "Not Scored"

**Fix**:
1. Check that ICP is created (ICP Manager)
2. Verify scoring job completed (Settings → Scoring)
3. Check that accounts have minimum data (3/5 fields)
4. Manually trigger "Refresh All Scores"

### Low Data Quality

**Issue**: Most accounts missing firmographic data

**Fix**:
1. Run Smart Enrichment (Settings → Data Quality)
2. Check CRM data quality (are fields populated in CRM?)
3. Configure field mappings (Settings → Integrations → Field Mapping)

### All Scores are Low

**Issue**: No A-band accounts, most are C or D

**Fix**:
1. Review ICP criteria (too restrictive?)
2. Upload closed-won deals to validate ICP
3. Run enrichment to improve data completeness
4. Adjust ICP based on actual customer profile

## Getting Help

### In-App Help

- Click **?** icon (top right)
- Search help docs
- Chat with support bot

### Documentation

- [Full Platform Guide](../01_User_Guides/Platform_Overview.md)
- [ICP Manager Guide](../01_User_Guides/ICP_Manager_Guide.md)
- [Scoring Overview](../08_Scoring_Engine/Scoring_Overview.md)

### Live Support

- **Email**: support@launchpulse.ai
- **Slack**: #launchpulse-support
- **Book a Call**: [calendly.com/launchpulse-onboarding](https://calendly.com/launchpulse-onboarding)

### Video Tutorials

- [15-Minute Setup Walkthrough](https://youtube.com/launchpulse/setup)
- [Creating Your First ICP](https://youtube.com/launchpulse/icp)
- [Building Your First Campaign](https://youtube.com/launchpulse/campaign)

---

**Congratulations!** 🎉 You've successfully set up LaunchPulse. Your accounts are being scored, and you're ready to build high-converting campaigns.

**Next**: [ICP Manager Guide](../01_User_Guides/ICP_Manager_Guide.md) to learn advanced ICP techniques.
