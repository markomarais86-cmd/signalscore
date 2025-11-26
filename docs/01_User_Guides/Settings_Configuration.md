# Settings Configuration Guide

## Overview

The Settings page in LaunchPulse is the central hub for configuring integrations, scoring parameters, AI agents, automations, and team management. This guide provides comprehensive documentation for all available settings and their optimal configurations.

## Table of Contents

1. [Accessing Settings](#accessing-settings)
2. [Integration Settings](#integration-settings)
3. [Scoring Configuration](#scoring-configuration)
4. [AI Agent Settings](#ai-agent-settings)
5. [Automation Settings](#automation-settings)
6. [Data Quality Settings](#data-quality-settings)
7. [API Key Management](#api-key-management)
8. [Team and Organization Settings](#team-and-organization-settings)
9. [Feature Flags](#feature-flags)
10. [Best Practices](#best-practices)

---

## Accessing Settings

Navigate to Settings from:
- **Main Navigation**: Click the gear icon in the left sidebar
- **User Menu**: Click your profile → Settings
- **Quick Access**: Press `Cmd+,` (Mac) or `Ctrl+,` (Windows)

---

## Integration Settings

### CRM Integrations

#### Salesforce Configuration

**Connection Setup:**
1. Navigate to Settings → Integrations → CRM
2. Click "Connect Salesforce"
3. Authorize LaunchPulse via OAuth
4. Configure sync settings

**Sync Settings:**

| Setting | Options | Recommended |
|---------|---------|-------------|
| **Sync Frequency** | Hourly, Every 4 hours, Daily | Hourly |
| **Sync Direction** | Bi-directional, CRM→LP, LP→CRM | Bi-directional |
| **Sync Objects** | Accounts, Contacts, Leads, Opportunities | All |
| **Webhook Enabled** | Yes/No | Yes (real-time updates) |

**Field Mapping:**

Configure which Salesforce fields map to LaunchPulse:

```json
{
  "account_mappings": {
    "Name": "name",
    "Website": "domain",
    "Industry": "industry_raw",
    "NumberOfEmployees": "employee_count",
    "BillingCountry": "country",
    "Type": "data_source"
  },
  "custom_fields": {
    "LaunchPulse_Fit_Score__c": "fit_score",
    "LaunchPulse_ICP__c": "primary_icp",
    "LaunchPulse_Score_Band__c": "score_band"
  }
}
```

**Advanced Settings:**

- **Rate Limiting**: Respect Salesforce API limits
  - Standard: 15,000 calls/day
  - Enterprise: 100,000 calls/day
- **Batch Size**: 200 records per sync batch (recommended)
- **Error Handling**: Retry failed syncs 3 times with exponential backoff

**Related Documentation:**
- [Salesforce OAuth Setup](../05_Integrations/Salesforce/OAuth_Setup.md)
- [Salesforce Field Mapping Guide](../05_Integrations/Salesforce/Field_Mapping.md)

---

#### HubSpot Configuration

**Connection Setup:**
1. Settings → Integrations → CRM → Connect HubSpot
2. Authorize via OAuth
3. Select HubSpot portal
4. Configure sync settings

**Sync Settings:**

| Setting | Options | Recommended |
|---------|---------|-------------|
| **Sync Frequency** | Real-time (webhooks), Hourly, Daily | Real-time |
| **Sync Objects** | Companies, Contacts, Deals | All |
| **Property Sync** | Standard, Custom, All | All |
| **List Management** | Create lists from campaigns | Enabled |

**Property Mappings:**

```json
{
  "company_properties": {
    "name": "name",
    "domain": "domain",
    "industry": "industry",
    "numberofemployees": "employee_count",
    "country": "country",
    "launchpulse_fit_score": "fit_score",
    "launchpulse_icp": "primary_icp"
  }
}
```

**HubSpot-Specific Features:**

- **List Creation**: Auto-create static lists from campaign exports
- **Workflow Integration**: Trigger HubSpot workflows on score changes
- **Form Integration**: Enrich form submissions with LaunchPulse scores

**Related Documentation:**
- [HubSpot OAuth Setup](../05_Integrations/HubSpot/OAuth_Setup.md)
- [HubSpot List Management](../05_Integrations/HubSpot/List_Management.md)

---

### Enrichment Provider Integrations

#### PDL (People Data Labs)

**Setup:**
1. Settings → Integrations → Enrichment → PDL
2. Enter PDL API key
3. Configure enrichment preferences

**Configuration:**

| Setting | Options | Recommended |
|---------|---------|-------------|
| **Auto-Enrich** | On/Off | On (for new accounts) |
| **Enrichment Fields** | Company, Person, Both | Both |
| **Match Confidence** | High, Medium, Low | Medium |
| **Monthly Budget** | $0-$10,000+ | Set based on volume |

**Enrichment Priority:**
- Company firmographics (employee count, revenue, industry)
- Technology stack data
- Funding and financial data
- Social profiles (LinkedIn, Twitter)

**Cost Management:**
- **Company Enrichment**: ~$0.05-$0.15 per record
- **Person Enrichment**: ~$0.10-$0.25 per record
- **Bulk Discounts**: Available for >10,000 requests/month

**Related Documentation:**
- [PDL Setup Guide](../05_Integrations/PDL/Setup_Guide.md)
- [Enrichment Cost Calculator](../09_Workflows/Enrichment_Cost_Management.md)

---

#### Clearbit

**Setup:**
1. Settings → Integrations → Enrichment → Clearbit
2. Enter Clearbit API key
3. Enable enrichment types

**Enrichment Options:**

| Type | Use Case | Cost |
|------|----------|------|
| **Reveal** | Identify website visitors | Free tier available |
| **Enrichment** | Company/person data | ~$0.40 per match |
| **Prospector** | Find contacts at companies | ~$0.30 per contact |

**Configuration:**
```json
{
  "reveal": {
    "enabled": true,
    "threshold": "medium_confidence"
  },
  "enrichment": {
    "auto_enrich": true,
    "fields": ["company", "person", "tech_stack"]
  },
  "prospector": {
    "enabled": false,
    "role_filters": ["executive", "management"]
  }
}
```

---

#### ZoomInfo

**Setup:**
1. Settings → Integrations → Enrichment → ZoomInfo
2. Enter ZoomInfo API credentials
3. Configure search preferences

**Configuration:**

| Setting | Value |
|---------|-------|
| **API Endpoint** | US, EU, APAC |
| **Match Strategy** | Domain, Name+Location |
| **Contact Discovery** | Enabled/Disabled |
| **Intent Signals** | Enabled/Disabled |

**ZoomInfo Features:**
- Company firmographics enrichment
- Contact discovery with hierarchy
- Intent signal integration
- Technology install base data

**Cost Considerations:**
- Typically requires annual contract
- Per-seat or credit-based pricing
- Contact enrichment consumes credits

**Related Documentation:**
- [ZoomInfo Setup Guide](../05_Integrations/ZoomInfo/Setup_Guide.md)

---

#### Apollo.io

**Setup:**
1. Settings → Integrations → Enrichment → Apollo
2. Enter Apollo API key
3. Configure contact discovery

**Configuration:**

```json
{
  "enrichment": {
    "auto_discover_contacts": true,
    "min_contacts_per_account": 2,
    "max_contacts_per_account": 5,
    "seniority_filters": ["VP", "Director", "C-Suite"],
    "department_filters": ["Engineering", "Sales", "Marketing"]
  },
  "credits": {
    "monthly_limit": 1000,
    "alert_threshold": 800
  }
}
```

**Apollo Features:**
- Contact discovery with job titles
- Email verification
- Phone number enrichment
- Engagement tracking

---

### Sales Engagement Platform Integrations

#### Outreach.io

**Setup:**
1. Settings → Integrations → SEP → Outreach
2. OAuth connection
3. Configure sequence integration

**Campaign Push Configuration:**

```json
{
  "default_sequence": "Outbound_Cold_V2",
  "auto_assign_to_rep": true,
  "task_creation": {
    "enabled": true,
    "task_type": "call",
    "due_date": "2_days_after_export"
  }
}
```

---

#### SalesLoft

**Setup:**
1. Settings → Integrations → SEP → SalesLoft
2. Connect via API key
3. Configure cadence mappings

**Configuration:**

| Setting | Value |
|---------|-------|
| **Default Cadence** | Select from SalesLoft |
| **Owner Assignment** | Territory, Round Robin, Manual |
| **Update Existing** | Yes/No |
| **Sync Engagement** | Enabled |

---

### Data Provider Integrations

#### Clay

**Setup:**
1. Settings → Integrations → Data → Clay
2. Generate webhook URL
3. Configure field mappings in Clay

**Webhook Configuration:**

```
Webhook URL: https://[your-project].supabase.co/functions/v1/clay-webhook-receiver
Method: POST
Headers: 
  - Authorization: Bearer [your-api-key]
```

**Field Mapping:**

Map Clay table columns to LaunchPulse fields:
- `company_name` → `name`
- `website` → `domain`
- `employee_count` → `employee_count`
- `industry` → `industry_raw`

**Related Documentation:**
- [Clay Integration Setup](../05_Integrations/Clay/Setup_Guide.md)
- [Clay Webhook Configuration](../05_Integrations/Clay/Webhook_Setup.md)

---

## Scoring Configuration

### Feature Weights

Configure the importance of each dimension in fit score calculation.

**Default Weights:**

| Dimension | Default Weight | Range | Description |
|-----------|----------------|-------|-------------|
| **Company Size** | 0.25 | 0.0-1.0 | Employee count fit |
| **Industry** | 0.25 | 0.0-1.0 | Industry alignment |
| **Geography** | 0.20 | 0.0-1.0 | Geographic fit |
| **Revenue** | 0.15 | 0.0-1.0 | Revenue range fit |
| **Tech Stack** | 0.10 | 0.0-1.0 | Technology alignment |
| **Funding** | 0.05 | 0.0-1.0 | Funding status |

**Adjusting Weights:**

1. Settings → Scoring → Feature Weights
2. Adjust sliders for each dimension
3. Weights must sum to 1.0
4. Click "Recalculate All Scores" to apply

**When to Adjust Weights:**

- **After uploading closed-won data**: Use "Auto-Calculate Weights" to derive from historical patterns
- **Product changes**: If your product targets different attributes
- **Market expansion**: Adjust geography weight when expanding to new regions

**Auto-Calculate Weights:**

LaunchPulse can automatically derive weights from closed-won analysis:

1. Upload 50+ closed-won deals
2. Settings → Scoring → Auto-Calculate Weights
3. Review correlation analysis results
4. Apply recommended weights

**Example Output:**
```
Correlation Analysis (100 closed-won deals):
- Company Size: r=0.45 (p<0.01) → Weight: 0.30
- Industry: r=0.38 (p<0.01) → Weight: 0.25
- Geography: r=0.25 (p<0.05) → Weight: 0.15
- Revenue: r=0.32 (p<0.01) → Weight: 0.20
- Tech Stack: r=0.18 (p<0.10) → Weight: 0.10
```

---

### Score Bands

Configure score band thresholds.

**Default Bands:**
- A: 80-100
- B: 60-79
- C: 40-59
- D: 0-39

**Custom Bands:**

Adjust thresholds based on your account distribution:

**Example: Stricter A-Band**
```
A: 85-100 (top 10% only)
B: 70-84
C: 50-69
D: 0-49
```

**Example: More Granular**
```
A+: 90-100
A: 80-89
B+: 70-79
B: 60-69
C: 40-59
D: 0-39
```

---

### Propensity Model

Configure ML-based conversion prediction.

**Settings:**

| Setting | Options | Description |
|---------|---------|-------------|
| **Enable Propensity** | On/Off | Turn on ML-based scoring |
| **Training Data** | Closed-won deals | Minimum 100 deals recommended |
| **Retrain Frequency** | Weekly, Monthly, Quarterly | Weekly recommended |
| **Features** | Select features for model | All recommended |

**Model Performance Metrics:**

View in Settings → Scoring → Propensity Model:
- **Accuracy**: % of correct predictions
- **Precision**: True positives / All positives
- **Recall**: True positives / All actual wins
- **AUC-ROC**: Model discrimination ability

---

## AI Agent Settings

### Lead Qualification Agent

**Configuration:**

| Setting | Value | Description |
|---------|-------|-------------|
| **Auto-Run** | Enabled/Disabled | Automatically qualify new leads |
| **Qualification Criteria** | Custom rules | Define qualification logic |
| **Schedule** | Hourly, Daily, Manual | How often agent runs |
| **Notify Sales** | Yes/No | Alert sales on high-quality leads |

**Qualification Rules:**

```json
{
  "qualified_if": {
    "fit_score": {"min": 70},
    "employee_count": {"min": 50, "max": 5000},
    "has_email": true,
    "job_title_matches": ["VP", "Director", "Manager", "C-Suite"]
  },
  "disqualified_if": {
    "industry": ["Education", "Non-Profit"],
    "country": ["Sanctioned countries"],
    "no_consent": true
  }
}
```

---

### Follow-Up Agent

**Configuration:**

| Setting | Value |
|---------|-------|
| **Auto-Follow-Up** | Enabled/Disabled |
| **Follow-Up Delay** | 3, 5, 7 days |
| **Max Follow-Ups** | 1-5 |
| **Skip if Engaged** | Yes/No |

**Follow-Up Strategy:**

```json
{
  "sequence": [
    {"day": 0, "action": "initial_email"},
    {"day": 3, "action": "follow_up_email"},
    {"day": 7, "action": "final_email"},
    {"day": 14, "action": "assign_to_sales"}
  ]
}
```

---

### Meeting Scheduler Agent

**Configuration:**

| Setting | Value |
|---------|-------|
| **Calendar Integration** | Google, Outlook, Calendly |
| **Booking Rules** | Business hours, timezone-aware |
| **Buffer Time** | 15, 30, 60 minutes |
| **Max Meetings/Day** | 1-10 |

**Availability Settings:**

```json
{
  "working_hours": {
    "monday": "09:00-17:00",
    "tuesday": "09:00-17:00",
    "wednesday": "09:00-17:00",
    "thursday": "09:00-17:00",
    "friday": "09:00-17:00"
  },
  "timezone": "America/Los_Angeles",
  "buffer_between_meetings": 30
}
```

---

### Data Enrichment Agent

**Configuration:**

| Setting | Value |
|---------|-------|
| **Auto-Enrich** | New accounts, Updated accounts, Manual |
| **Enrichment Priority** | Missing fields first, Low confidence, All |
| **Budget Limit** | $0-$1000/month |
| **Providers** | PDL, Clearbit, ZoomInfo, Apollo |

**Enrichment Waterfall:**

Configure provider priority:

```json
{
  "waterfall": [
    {"provider": "crm_data", "priority": 1},
    {"provider": "clearbit_free", "priority": 2},
    {"provider": "pdl", "priority": 3, "max_cost": 0.15},
    {"provider": "zoominfo", "priority": 4, "max_cost": 0.30}
  ],
  "stop_on_success": true
}
```

---

## Automation Settings

### Scheduled Jobs

**Available Automations:**

| Job | Default Schedule | Purpose |
|-----|------------------|---------|
| **CRM Sync** | Hourly | Sync accounts/contacts from CRM |
| **Score Refresh** | Daily at 2am | Recalculate all fit scores |
| **Data Quality Check** | Daily | Identify missing/stale data |
| **Weekly Analytics** | Weekly, Monday 6am | Generate weekly snapshots |
| **Enrichment Jobs** | Continuous | Process enrichment queue |

**Customizing Schedules:**

1. Settings → Automations
2. Select job
3. Choose frequency: Hourly, Daily, Weekly, Custom Cron
4. Set time and timezone

**Custom Cron Example:**
```
0 2 * * * (Daily at 2am UTC)
0 */4 * * * (Every 4 hours)
0 0 * * 0 (Weekly on Sunday at midnight)
```

---

### Auto-Scoring Rules

Configure when accounts are automatically scored:

**Triggers:**

- [x] New account created
- [x] Account enrichment completed
- [x] CRM sync updates account
- [x] ICP criteria changed
- [x] Manual bulk scoring request
- [ ] Score older than 30 days (Optional)

---

### Data Quality Automation

**Auto-Fix Settings:**

| Issue | Auto-Fix | Action |
|-------|----------|--------|
| **Missing domain** | Enabled | Extract from email or CRM |
| **Duplicate accounts** | Manual | Flag for review |
| **Missing industry** | Enabled | Enrich from domain |
| **Invalid email** | Enabled | Mark as bounced |
| **Stale data (>180 days)** | Enabled | Queue for re-enrichment |

---

## Data Quality Settings

### Data Completeness Rules

Define required fields for account completeness:

**Required Fields:**
- [x] Company Name
- [x] Domain
- [x] Industry
- [x] Employee Count
- [ ] Revenue Range
- [ ] Country
- [ ] Phone Number

**Completeness Scoring:**
```
Completeness % = (Filled Fields / Required Fields) × 100
```

---

### Duplicate Management

**Duplicate Detection Rules:**

| Rule | Match Type | Action |
|------|------------|--------|
| **Same domain** | Exact | Auto-merge |
| **Similar name + location** | Fuzzy (85%) | Flag for review |
| **Same CRM ID** | Exact | Alert admin |

**Merge Strategy:**
- Keep most recent data
- Preserve all CRM IDs
- Merge contact lists
- Combine enrichment history

---

## API Key Management

### Creating API Keys

1. Settings → API Keys → Create New Key
2. Enter key name and description
3. Select scopes (permissions)
4. Set expiration (optional)
5. Copy key (shown only once)

**Available Scopes:**

| Scope | Permissions |
|-------|-------------|
| `read:accounts` | View account data |
| `write:accounts` | Create/update accounts |
| `read:scores` | View fit scores |
| `write:scores` | Trigger scoring jobs |
| `read:campaigns` | View campaigns |
| `write:campaigns` | Export campaigns |
| `admin` | Full access |

**Best Practices:**
- Create separate keys for each integration
- Use minimal scopes required
- Set expiration dates for external keys
- Rotate keys quarterly
- Revoke unused keys immediately

---

## Team and Organization Settings

### User Management

**User Roles:**

| Role | Permissions |
|------|-------------|
| **Admin** | Full access to all settings and data |
| **Manager** | Manage campaigns, view reports, no settings |
| **Sales** | View accounts, create campaigns, no admin |
| **Read-Only** | View-only access to dashboards and reports |

**Inviting Users:**

1. Settings → Team → Invite User
2. Enter email address
3. Select role
4. Send invitation
5. User receives email with setup link

---

### Organization Settings

**Company Profile:**
- Organization Name
- Primary Industry
- Company Size
- Headquarters Location

**Billing:**
- Current Plan
- Usage Metrics
- Invoice History
- Payment Method

**Data Residency:**
- US, EU, APAC
- Affects data storage location and compliance

---

## Feature Flags

### Available Feature Flags

Toggle experimental or enterprise features:

| Feature | Description | Access |
|---------|-------------|--------|
| **Propensity Scoring** | ML-based conversion prediction | Enterprise |
| **Multi-ICP Scoring** | Score against multiple ICPs | Pro+ |
| **Custom Reports** | Build custom dashboards | Pro+ |
| **AI Agents** | Automated workflows | Enterprise |
| **API Access** | Programmatic access | Pro+ |
| **White Labeling** | Remove LaunchPulse branding | Enterprise |

**Enabling Features:**

1. Settings → Feature Flags
2. Toggle feature on/off
3. Some features require plan upgrade

---

## Best Practices

### Integration Setup

1. **Start with CRM**: Connect your CRM first for account data
2. **Add enrichment gradually**: Start with one provider, add more as needed
3. **Test before enabling automation**: Manually test integrations before auto-sync
4. **Monitor sync health**: Check integration dashboard weekly

### Scoring Configuration

1. **Use auto-calculated weights**: After uploading closed-won data
2. **Validate with sales team**: Ensure scores align with sales intuition
3. **Iterate on ICP criteria**: Refine based on score distribution
4. **Re-score after changes**: Always recalculate scores after weight/ICP changes

### Data Quality

1. **Set realistic completeness goals**: 80%+ completeness for required fields
2. **Enable auto-enrichment**: For new accounts and missing fields
3. **Regular duplicate cleanup**: Weekly or monthly
4. **Monitor enrichment costs**: Set budget alerts

### API Key Security

1. **Least privilege**: Grant minimum scopes needed
2. **Regular rotation**: Rotate keys every 90 days
3. **Audit logs**: Review API key usage monthly
4. **Secure storage**: Never commit keys to code repositories

---

## Related Documentation

- [CRM Integration Guide](../05_Integrations/CRM/)
- [Enrichment Provider Setup](../05_Integrations/Enrichment/)
- [API Reference](../10_API_Reference/)
- [Feature Weights Calculation](../08_Scoring_Engine/Scoring_Weights.md)
- [AI Agent Configuration](../07_AI_Agents/)

---

**Last Updated**: 2024-01-15  
**Version**: 1.0
