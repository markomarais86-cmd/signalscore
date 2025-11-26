# Zapier Integration Guide

## Overview

LaunchPulse integrates with Zapier to enable no-code workflow automation, connecting LaunchPulse scores and data to 5,000+ apps in the Zapier ecosystem.

## Features

- **Triggers**: Score updates, new accounts, high-fit leads
- **Actions**: Create/update accounts, push scores, export data
- **Filters**: Route data based on score bands, ICP match, etc.
- **Multi-Step Zaps**: Complex workflows combining multiple apps
- **Webhooks**: Send LaunchPulse data to any endpoint

## Setup Requirements

### Prerequisites
1. Zapier account (Free or paid)
2. LaunchPulse API key (for authentication)

### Initial Setup

**Quick Start:**
1. Settings → Integrations → Zapier
2. Click "Enable Zapier Integration"
3. Copy webhook URL
4. Generate LaunchPulse API key
5. Create Zap in Zapier

## Triggers

LaunchPulse provides these Zapier triggers:

### New High-Fit Account
**Trigger:** Account scored with A or B band

**Output:**
- Account name, domain
- Fit score, propensity score
- Score band
- ICP match
- All firmographic fields

**Use Cases:**
- Send Slack notification to sales team
- Create deal in CRM
- Add to outreach sequence
- Log in Google Sheets

### Score Update
**Trigger:** Account score changes significantly (>10 points)

**Output:**
- Previous score, new score
- Delta (change amount)
- Reason for change (field updates, ICP refinement)
- Account details

**Use Cases:**
- Alert account owner
- Update CRM fields
- Trigger re-evaluation by sales

### Campaign Export
**Trigger:** Campaign exported from LaunchPulse

**Output:**
- Campaign name
- ICP used
- Account count, contact count
- Export file URL
- Campaign metadata

**Use Cases:**
- Send to email marketing platform (Mailchimp, SendGrid)
- Import to advertising platform (LinkedIn, Google Ads)
- Create CRM campaign

## Actions

LaunchPulse provides these Zapier actions:

### Score Account
**Action:** Score a single account on-demand

**Inputs:**
- Domain (required)
- ICP ID (optional, uses primary if not specified)

**Output:**
- Fit score, propensity score
- Score band
- ICP match
- Score breakdown by dimension

**Use Cases:**
- Score new leads from webforms
- Re-score accounts on trigger (funding event, etc.)
- Score during sales call (real-time)

### Create/Update Account
**Action:** Add or update account in LaunchPulse

**Inputs:**
- Domain (required)
- Name, employee count, revenue, industry, country, etc.
- Custom fields

**Output:**
- Account ID
- Created or updated timestamp
- Enrichment status

**Use Cases:**
- Import accounts from other systems
- Update account data from webform submissions
- Sync data from spreadsheets

### Find Contacts
**Action:** Discover contacts at an account

**Inputs:**
- Account domain
- Persona criteria (title, seniority, department)
- Max contacts per account
- Enrichment provider (Apollo, ZoomInfo, PDL)

**Output:**
- Contact list (name, email, title)
- Contact count
- Enrichment cost

**Use Cases:**
- Find contacts after account scores high
- Build targeted lists
- Enrich existing account lists

## Sample Zaps

### Zap 1: Webform to Scored Lead
**Workflow:**
1. **Trigger:** New webform submission (Typeform, Google Forms, etc.)
2. **Action:** Create account in LaunchPulse (domain from form)
3. **Action:** Score account with primary ICP
4. **Filter:** If score band = A or B
5. **Action:** Create lead in CRM (Salesforce, HubSpot)
6. **Action:** Send Slack notification to sales

**Benefits:** Automatically qualify and route inbound leads

### Zap 2: High-Fit Account Alert
**Workflow:**
1. **Trigger:** LaunchPulse - New High-Fit Account
2. **Filter:** Score band = A
3. **Action:** Send email to account owner
4. **Action:** Create task in CRM
5. **Action:** Log in Google Sheets for reporting

**Benefits:** Never miss a high-fit account

### Zap 3: Funding Event → Re-Score
**Workflow:**
1. **Trigger:** New funding event (Crunchbase, PitchBook via webhook)
2. **Filter:** Funding amount > $10M
3. **Action:** Update account in LaunchPulse (funding data)
4. **Action:** Re-score account
5. **Filter:** If new score band = A
6. **Action:** Create opportunity in CRM

**Benefits:** Catch buying intent from funding signals

### Zap 4: Campaign to Email Platform
**Workflow:**
1. **Trigger:** LaunchPulse - Campaign Export
2. **Action:** Download export CSV
3. **Action:** Parse CSV
4. **Action:** Create contacts in Mailchimp (or SendGrid, etc.)
5. **Action:** Add to specific campaign/list
6. **Action:** Send campaign start notification

**Benefits:** Seamless campaign execution

### Zap 5: Score Update → CRM Sync
**Workflow:**
1. **Trigger:** LaunchPulse - Score Update
2. **Filter:** Score increased by >15 points
3. **Action:** Update CRM record (Salesforce, HubSpot)
4. **Action:** Increase lead score in CRM
5. **Action:** Notify sales rep

**Benefits:** Keep CRM scores in sync with LaunchPulse

## Webhook Integration

### Outgoing Webhooks
Send LaunchPulse data to any endpoint:

**Configuration:**
- Settings → Integrations → Zapier → Outgoing Webhooks
- Click "Add Webhook Destination"
- Enter target URL
- Select event type (score update, campaign export, etc.)
- Test webhook

**Payload Example:**
```json
{
  "event": "score_update",
  "account": {
    "domain": "acme.com",
    "name": "Acme Corporation",
    "fit_score": 87,
    "propensity_score": 72,
    "score_band": "A",
    "icp_match": "Enterprise SaaS"
  },
  "previous_score": 65,
  "score_delta": 22,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### Incoming Webhooks
Receive data from Zapier (or any source):

**Zapier Webhook URL:**
```
https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/zapier-sync
```

**Authentication:** Include `x-org-id` header

**Payload Structure:**
```json
{
  "action": "create_account",
  "data": {
    "domain": "newco.com",
    "name": "New Company",
    "employee_count": 150,
    "industry": "Software"
  }
}
```

**Supported Actions:**
- `create_account`
- `update_account`
- `score_account`
- `create_contact`
- `update_contact`

## Authentication

LaunchPulse uses API key authentication for Zapier:

**Setup:**
1. Settings → Integrations → API Keys
2. Click "Generate API Key"
3. Name: "Zapier Integration"
4. Scopes: Select needed permissions (read, write, score)
5. Copy API key (shown once!)
6. In Zapier, enter API key in connection settings

**Security:**
- API keys are hashed in database
- Keys can be revoked anytime
- Separate key for each integration recommended
- Audit log tracks all API key usage

## Rate Limits

LaunchPulse API rate limits:
- **Requests**: 100 per minute per API key
- **Daily**: 10,000 requests per day
- **Concurrent**: 5 simultaneous requests

**Handling in Zapier:**
- Zapier automatically retries on rate limit errors
- Use "Delay" action to throttle requests
- For bulk operations, use Zapier's "Looping by Zapier" with delays

## Troubleshooting

### Common Issues

**Authentication Failed**
- Verify API key is correct (no extra spaces)
- Check API key hasn't expired or been revoked
- Ensure API key has necessary scopes

**No Data Returned**
- Verify account exists in LaunchPulse (check domain)
- Check trigger filters in Zap
- Review LaunchPulse webhook logs

**Rate Limit Errors**
- Add "Delay" action (1-2 seconds between requests)
- Reduce Zap frequency (e.g., hourly instead of every new item)
- Contact LaunchPulse for rate limit increase

**Webhook Not Triggering**
- Test webhook with sample data
- Check webhook URL is correct
- Verify webhook is enabled in LaunchPulse settings
- Review webhook logs in Settings → Integrations → Zapier

### Best Practices

1. **Use Filters**: Reduce unnecessary actions (cost and rate limits)
2. **Error Handling**: Enable Zap's error notifications
3. **Test First**: Always test Zaps with sample data
4. **Document**: Add notes to Zap steps for team reference
5. **Monitor**: Review Zap history weekly for errors
6. **Separate Keys**: One API key per integration (easier to revoke)

## Zapier Components

LaunchPulse provides these components for Zapier integration:

**Frontend:**
- `ZapierIntegration.tsx` - Main settings UI
- `ZapierWebhookManager.tsx` - Webhook configuration

**Backend:**
- `zapier-sync` edge function - Handles incoming webhooks
- `generate-api-key` edge function - Creates API keys

**Testing:**
- Use Zapier's "Test" feature before activating
- LaunchPulse test mode available (doesn't count against usage)

## Use Cases by Industry

### SaaS Companies
- Score inbound signups in real-time
- Route high-fit trials to sales
- Trigger onboarding based on fit score

### Agencies
- Score prospect lists from lead gen campaigns
- Route high-fit to account managers
- Sync scores to project management tools

### Enterprise Sales
- Alert on funding events (via Crunchbase)
- Multi-thread high-fit accounts automatically
- Sync executive contacts to CRM

### Marketing Teams
- Build targeted ad audiences (high-fit domains)
- Personalize website for high-fit visitors (via IP)
- Score event registrants in real-time

## Support Resources

- Setup Guide: `MASTER_INTEGRATION_GUIDE.md`
- Webhook Logs: Settings → Integrations → Zapier → Logs
- API Keys: Settings → Integrations → API Keys
- Edge Function: `zapier-sync/index.ts`
- Components: `ZapierIntegration.tsx`, `ZapierWebhookManager.tsx`
- Troubleshooting: `TROUBLESHOOTING_INTEGRATIONS.md`
