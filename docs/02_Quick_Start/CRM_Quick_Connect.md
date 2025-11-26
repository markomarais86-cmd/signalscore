# CRM Quick Connect Guide

**Connect your CRM to LaunchPulse in 5 minutes**

## Overview

This quick start guide walks you through connecting Salesforce or HubSpot to LaunchPulse, enabling automatic account and contact synchronization.

**Time Required**: 5 minutes  
**Prerequisites**: Admin access to your CRM

---

## Salesforce Quick Connect

### Step 1: Navigate to Integrations (30 seconds)

1. Click **Settings** (gear icon) in the left sidebar
2. Select **Integrations** → **CRM**
3. Click **Connect Salesforce**

### Step 2: Authorize LaunchPulse (2 minutes)

1. You'll be redirected to Salesforce login
2. Enter your Salesforce credentials
3. Click **Allow** to grant LaunchPulse access
4. You'll be redirected back to LaunchPulse

**Permissions Granted:**
- Read Accounts, Contacts, Leads
- Write custom fields (for fit scores)
- API access for syncing

### Step 3: Configure Sync Settings (2 minutes)

**Quick Setup (Recommended):**

Select **"Use Default Settings"** to automatically configure:
- Sync frequency: Every hour
- Sync direction: Bi-directional
- Objects: Accounts, Contacts, Leads
- Webhooks: Enabled (real-time updates)

**Custom Setup:**

Configure manually if you need specific settings:

| Setting | Recommendation |
|---------|----------------|
| Sync Frequency | Hourly (for active sales teams) |
| Sync Direction | Bi-directional (keep data in sync) |
| Objects to Sync | All (Accounts, Contacts, Leads, Opportunities) |
| Enable Webhooks | Yes (for real-time updates) |

### Step 4: Map Custom Fields (30 seconds)

LaunchPulse will write fit scores back to Salesforce. Create these custom fields in Salesforce:

**Quick Field Creation:**

Click **"Auto-Create Fields in Salesforce"** to automatically create:
- `LaunchPulse_Fit_Score__c` (Number)
- `LaunchPulse_Score_Band__c` (Text)
- `LaunchPulse_ICP__c` (Text)

**Manual Field Creation** (if auto-create not available):

1. In Salesforce: Setup → Object Manager → Account → Fields & Relationships
2. Create fields:
   - **Fit Score**: Number (3, 0) - `LaunchPulse_Fit_Score__c`
   - **Score Band**: Text (1) - `LaunchPulse_Score_Band__c`
   - **ICP Name**: Text (255) - `LaunchPulse_ICP__c`

### Step 5: Start Initial Sync (30 seconds)

1. Click **"Start Initial Sync"**
2. LaunchPulse will import your Salesforce accounts
3. Initial sync typically takes 5-30 minutes depending on account count

**What Gets Synced:**

**From Salesforce to LaunchPulse:**
- Account name, website, industry
- Employee count, revenue
- Billing address (country, state, city)
- Account owner
- Custom fields (if mapped)

**From LaunchPulse to Salesforce:**
- Fit score
- Score band (A/B/C/D)
- ICP name
- Last scored date

### Step 6: Verify Connection (30 seconds)

1. Navigate to **Accounts** page
2. You should see accounts imported from Salesforce
3. Check **Settings → Integrations → CRM** for sync status
4. ✅ Green indicator = Successful connection

---

## HubSpot Quick Connect

### Step 1: Navigate to Integrations (30 seconds)

1. Click **Settings** (gear icon) in the left sidebar
2. Select **Integrations** → **CRM**
3. Click **Connect HubSpot**

### Step 2: Authorize LaunchPulse (2 minutes)

1. You'll be redirected to HubSpot
2. Select your HubSpot portal (if you have multiple)
3. Review permissions and click **Connect app**
4. You'll be redirected back to LaunchPulse

**Permissions Granted:**
- Read Companies, Contacts, Deals
- Write custom properties
- Create and manage lists
- Trigger workflows

### Step 3: Configure Sync Settings (2 minutes)

**Quick Setup (Recommended):**

Select **"Use Default Settings"**:
- Sync mode: Real-time (webhooks)
- Objects: Companies, Contacts, Deals
- Properties: All standard + custom
- List management: Enabled

**Custom Setup:**

| Setting | Recommendation |
|---------|----------------|
| Sync Mode | Real-time (webhooks preferred) |
| Sync Objects | All (Companies, Contacts, Deals) |
| Property Sync | All (standard + custom) |
| List Management | Enabled (for campaign exports) |

### Step 4: Map Custom Properties (30 seconds)

LaunchPulse will create custom HubSpot properties:

Click **"Create HubSpot Properties"** to auto-create:
- `launchpulse_fit_score` (Number)
- `launchpulse_score_band` (Text)
- `launchpulse_icp` (Text)
- `launchpulse_last_scored` (Date)

**Manual Property Creation** (if needed):

1. In HubSpot: Settings → Properties → Company Properties
2. Create Custom Property:
   - **Label**: LaunchPulse Fit Score
   - **Type**: Number
   - **Internal Name**: `launchpulse_fit_score`

### Step 5: Start Initial Sync (30 seconds)

1. Click **"Start Initial Sync"**
2. LaunchPulse imports your HubSpot companies
3. Initial sync typically takes 5-20 minutes

**What Gets Synced:**

**From HubSpot to LaunchPulse:**
- Company name, domain, industry
- Employee count, revenue
- Address (city, state, country)
- Company owner
- Custom properties (if mapped)

**From LaunchPulse to HubSpot:**
- Fit score
- Score band
- ICP name
- Last scored timestamp
- Campaign membership (as lists)

### Step 6: Verify Connection (30 seconds)

1. Navigate to **Accounts** page
2. Accounts should be imported from HubSpot
3. Check **Settings → Integrations → CRM** for sync status
4. ✅ Green indicator = Connected and syncing

---

## Post-Connection: What Happens Next?

### Automatic Ongoing Sync

**Real-Time Updates (if webhooks enabled):**
- New accounts created in CRM → Instantly appear in LaunchPulse
- Account updated in CRM → Changes sync within seconds
- Scores calculated in LaunchPulse → Written back to CRM immediately

**Scheduled Sync (if webhooks not enabled):**
- Every hour: Check for new/updated accounts
- Bi-directional sync keeps data consistent

### Automatic Scoring

1. **New accounts are automatically scored** within minutes of sync
2. Fit scores are calculated based on your ICP profiles
3. Scores are written back to CRM custom fields
4. You can filter and segment in your CRM using LaunchPulse scores

### Campaign Export Integration

When you export a campaign from LaunchPulse:

**Salesforce:**
- Creates a Campaign object
- Adds contacts as Campaign Members
- Updates Account fields with latest scores

**HubSpot:**
- Creates a static List
- Adds contacts to the list
- Updates Company properties with latest scores

---

## Troubleshooting

### ❌ Issue: "Authorization failed"

**Causes:**
- Incorrect CRM credentials
- Insufficient CRM permissions
- OAuth token expired

**Solutions:**
1. Verify you're using admin credentials
2. Check your CRM permissions (must be System Admin or equivalent)
3. Try disconnecting and reconnecting
4. Clear browser cache and try again

---

### ❌ Issue: "Sync not starting"

**Causes:**
- No accounts in CRM
- API rate limits reached
- Connection interrupted

**Solutions:**
1. Verify you have accounts in your CRM
2. Wait 15 minutes and try again (rate limit reset)
3. Check CRM API status page
4. Review error logs in Settings → Integrations → Sync History

---

### ❌ Issue: "Custom fields not appearing in CRM"

**Causes:**
- Field creation failed
- Insufficient permissions to create fields
- Field already exists with different type

**Solutions:**
1. Manually create custom fields (see Step 4)
2. Verify you have "Customize Application" permission
3. Check for existing fields with same names
4. Contact LaunchPulse support for field creation script

---

### ❌ Issue: "Only some accounts syncing"

**Causes:**
- Account ownership restrictions
- CRM sharing rules
- Record type restrictions

**Solutions:**
1. Verify LaunchPulse integration user has access to all accounts
2. Review Salesforce sharing rules
3. Check record type visibility
4. Grant "View All Data" permission to integration user

---

## Next Steps

### ✅ CRM Connected - Now What?

**Immediate Actions (5-10 minutes):**

1. **Verify data quality**
   - Check Settings → Data Quality Dashboard
   - Identify missing fields
   - Run enrichment if needed

2. **Create your first ICP**
   - Follow: [First ICP Creation Guide](./First_ICP_Creation.md)
   - Define target company criteria
   - Score your accounts

3. **Review initial scores**
   - Navigate to Accounts page
   - Filter by Score Band A (high fit)
   - Review top-scoring accounts

**Within First Week:**

1. **Set up enrichment providers**
   - Add PDL, Clearbit, or ZoomInfo
   - Auto-enrich missing fields
   - Improve score accuracy

2. **Configure automations**
   - Enable auto-scoring for new accounts
   - Set up weekly CRM sync reports
   - Configure data quality alerts

3. **Build your first campaign**
   - Follow: [Campaign Export Quick Start](./Campaign_Export_Quick_Start.md)
   - Target high-fit accounts
   - Export to CRM or CSV

---

## Best Practices

### 🎯 Sync Frequency

- **High-Volume Sales Teams**: Hourly sync + webhooks
- **Standard Sales Teams**: Hourly sync
- **Low-Volume/Marketing**: Daily sync

### 🔄 Sync Direction

- **Bi-directional** (recommended): Keep all data in sync
- **CRM → LaunchPulse**: If CRM is source of truth
- **LaunchPulse → CRM**: If only pushing scores back

### 🏷️ Field Mapping

- Map all firmographic fields (size, industry, revenue)
- Include custom fields relevant to your ICP
- Keep CRM owner field synced for routing

### 📊 Monitoring

- Check sync status weekly in Integration Dashboard
- Set up alerts for sync failures
- Review sync history for errors

---

## Related Documentation

- **Detailed Setup**: [Salesforce OAuth Setup](../05_Integrations/Salesforce/OAuth_Setup.md)
- **Field Mapping**: [Salesforce Field Mapping Guide](../05_Integrations/Salesforce/Field_Mapping.md)
- **Next Steps**: [First ICP Creation](./First_ICP_Creation.md)
- **Troubleshooting**: [CRM Sync Troubleshooting](../05_Integrations/CRM/Troubleshooting.md)

---

## Support

- **Email**: support@launchpulse.io
- **Slack**: #crm-integration
- **Live Chat**: Available in-app

---

**Last Updated**: 2024-01-15  
**Version**: 1.0
