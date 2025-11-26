# Clay Integration Guide

## Overview

LaunchPulse integrates with Clay to enable bi-directional data flows, combining Clay's data enrichment orchestration with LaunchPulse's scoring intelligence. This integration is ideal for customers using Clay tables for complex enrichment workflows.

## Features

- **Incoming Webhooks**: Receive enriched data from Clay tables
- **Outgoing Webhooks**: Send LaunchPulse scores to Clay
- **Field Mapping**: Flexible mapping between Clay columns and LaunchPulse fields
- **Bulk Import**: Batch import from Clay tables
- **Score Export**: Push fit/propensity scores back to Clay
- **Webhook Logs**: Monitor and troubleshoot data flows

## Setup Requirements

### Prerequisites
1. Active Clay account
2. Clay table with account or contact data
3. LaunchPulse organization ID
4. Understanding of Clay's webhook capabilities

### Initial Setup

Refer to `CLAY_INTEGRATION_SETUP.md` for step-by-step configuration.

**Quick Start:**
1. Navigate to Settings → Integrations → Clay
2. Enable Clay integration
3. Copy webhook URL
4. Configure field mappings
5. Set up webhook in Clay table

## Incoming Webhooks

### Receive Data from Clay

LaunchPulse can receive enriched account or contact data from Clay via webhooks.

**Webhook URL:**
```
https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/clay-webhook-receiver
```

**Setup in Clay:**
1. Open your Clay table
2. Add "HTTP API" enrichment column
3. Method: POST
4. URL: LaunchPulse webhook URL (from Settings)
5. Headers: `x-org-id: YOUR_ORG_ID`
6. Body: Map Clay columns to JSON payload
7. Test webhook
8. Run for all rows

### Webhook Payload Structure

**For Accounts:**
```json
{
  "type": "account",
  "domain": "{{company_domain}}",
  "name": "{{company_name}}",
  "employee_count": "{{employee_count}}",
  "revenue_range": "{{revenue_range}}",
  "industry": "{{industry}}",
  "country": "{{country}}",
  "custom_field_1": "{{custom_data}}"
}
```

**For Contacts:**
```json
{
  "type": "contact",
  "email": "{{email}}",
  "first_name": "{{first_name}}",
  "last_name": "{{last_name}}",
  "title": "{{job_title}}",
  "company_domain": "{{company_domain}}",
  "linkedin_url": "{{linkedin_url}}"
}
```

### Field Mapping

Configure how Clay fields map to LaunchPulse:

**Component:** `ClayFieldMapping.tsx`
**Location:** Settings → Integrations → Clay → Field Mapping

**Account Mappings:**
| Clay Column | LaunchPulse Field | Required |
|------------|------------------|----------|
| Domain | domain | Yes |
| Company Name | name | No |
| Employee Count | employee_count | No |
| Revenue | revenue_range | No |
| Industry | industry_norm | No |
| Country | country | No |
| State/Province | state_province | No |
| Tech Stack | tech_stack | No |

**Contact Mappings:**
| Clay Column | LaunchPulse Field | Required |
|------------|------------------|----------|
| Email | email | Yes |
| First Name | first_name | No |
| Last Name | last_name | No |
| Full Name | full_name | No |
| Title | title | No |
| Company Domain | company_domain | Yes |
| Seniority | seniority | No |
| Department | department | No |

**Custom Fields:**
You can map additional Clay columns to LaunchPulse custom fields. These will be stored in the `enrichment_citations` or `trust_signals` JSON fields.

### Bulk Import from Clay

Import entire Clay table at once:

**Process:**
1. Export Clay table to CSV
2. Go to Settings → Data Upload → Clay Import
3. Upload CSV file
4. Map columns to LaunchPulse fields
5. Choose upsert strategy (create new vs update existing)
6. Review preview
7. Execute import

**Recommended for:**
- Initial migration from Clay to LaunchPulse
- Large datasets (>1000 records)
- One-time imports

## Outgoing Webhooks

### Send Scores to Clay

Push LaunchPulse fit and propensity scores back to Clay tables.

**Setup:**
1. Settings → Integrations → Clay → Outgoing Webhooks
2. Click "Add Clay Destination"
3. Enter Clay webhook URL (from Clay "Catch Webhook" column)
4. Select data to send (fit score, propensity, score band, ICP match)
5. Test webhook
6. Enable for score updates

**Webhook Payload to Clay:**
```json
{
  "domain": "acme.com",
  "fit_score": 87,
  "propensity_score": 72,
  "score_band": "A",
  "icp_match": "Enterprise SaaS",
  "reachability_score": 65,
  "last_scored_at": "2025-01-15T10:30:00Z"
}
```

**In Clay:**
1. Add "Catch Webhook" column
2. Copy webhook URL
3. Paste into LaunchPulse outgoing webhook config
4. Send test payload
5. Map received fields to Clay columns

### Automatic Score Sync

Enable automatic score syncing:

**Configuration:**
- Settings → Integrations → Clay → Auto-Sync
- Trigger: When account is scored/re-scored
- Frequency: Real-time or batched (hourly, daily)
- Filter: All accounts or specific score bands (A/B only)

**Use Cases:**
- Keep Clay tables updated with latest scores
- Trigger Clay workflows based on score changes
- Maintain single source of truth in Clay

## Webhook Logging

Monitor all webhook activity:

**Component:** `ClayIncomingWebhooks.tsx`
**Location:** Settings → Integrations → Clay → Webhook Logs

**Log Details:**
- Timestamp
- Webhook type (incoming/outgoing)
- Payload preview
- Processing status (success/error)
- Error messages (if failed)
- Processing time
- Records affected

**Filtering:**
- By date range
- By status (all, success, errors)
- By webhook type
- Search by domain/email

**Retention:** 30 days

## Use Cases

### Use Case 1: Clay Waterfall → LaunchPulse Scoring

**Scenario:** Use Clay's enrichment waterfall to gather data, then score in LaunchPulse.

**Workflow:**
1. Clay enriches accounts (Clearbit → Apollo → ZoomInfo waterfall)
2. Webhook sends enriched data to LaunchPulse
3. LaunchPulse scores against ICP
4. Outgoing webhook returns scores to Clay
5. Clay uses scores for prioritization/routing

**Benefits:**
- Best-of-both-worlds enrichment
- LaunchPulse's sophisticated scoring
- Clay's workflow automation

### Use Case 2: LaunchPulse Scoring → Clay Campaigns

**Scenario:** Score in LaunchPulse, build campaigns in Clay.

**Workflow:**
1. LaunchPulse scores all CRM accounts
2. Outgoing webhook sends A/B band accounts to Clay
3. Clay finds contacts (people waterfall)
4. Clay validates emails
5. Clay personalizes outreach
6. Clay exports to sequencer

**Benefits:**
- LaunchPulse's ICP-based scoring
- Clay's contact discovery
- Clay's personalization features

### Use Case 3: Bi-Directional Enrichment

**Scenario:** Continuous data sync between systems.

**Workflow:**
1. CRM syncs to LaunchPulse
2. LaunchPulse scores accounts
3. Scores pushed to Clay
4. Clay enriches missing fields
5. Enriched data back to LaunchPulse
6. Updated data syncs to CRM

**Benefits:**
- Each system does what it does best
- Continuous data improvement
- Single workflow for teams

## Field Mapping Configuration

Flexible mapping for complex workflows:

**Nested Field Support:**
Clay columns like `enrichment.employee_count` can map to LaunchPulse `employee_count`.

**Array Field Support:**
Clay arrays (e.g., tech stack) can map to LaunchPulse array fields.

**Transformation Rules:**
- Number formatting (remove commas, currency symbols)
- Date parsing (multiple formats supported)
- String normalization (trim, lowercase for domains)
- Boolean conversion ("Yes"/"No" → true/false)

**Custom Mappings:**
Map Clay custom fields to LaunchPulse custom fields via JSON configuration:

```json
{
  "clay_custom_field_1": {
    "launchpulse_field": "enrichment_citations",
    "path": "custom.field_1",
    "type": "string"
  }
}
```

## Error Handling

### Common Errors

**Invalid Payload**
- Error: "Missing required field: domain"
- Solution: Ensure Clay column is mapped correctly
- Check field mapping in Settings

**Duplicate Records**
- Error: "Account already exists"
- Solution: Enable "Update existing" in webhook config
- Or use bulk import with upsert mode

**Authentication Failed**
- Error: "Invalid org_id"
- Solution: Verify `x-org-id` header in Clay webhook
- Get correct org_id from Settings → Organization

**Rate Limiting**
- Error: "Too many requests"
- Solution: Batch webhooks (send every 100 rows, not per row)
- Or use bulk import instead of webhooks

### Retry Logic

LaunchPulse automatically retries failed webhooks:
- 3 retry attempts
- Exponential backoff (1s, 5s, 15s)
- Permanent failure after 3 attempts
- Logged in webhook logs

### Manual Retry

For failed webhooks:
1. Go to Settings → Integrations → Clay → Webhook Logs
2. Filter by "Errors"
3. Select failed webhooks
4. Click "Retry Selected"
5. Monitor progress

## Performance Optimization

### Batching
Send data in batches instead of one row at a time:

**In Clay:**
- Use "Batch HTTP API" instead of row-by-row
- Group 50-100 records per request
- Reduces API calls and improves speed

**Payload:**
```json
{
  "batch": true,
  "accounts": [
    { "domain": "acme.com", ... },
    { "domain": "corp.com", ... }
  ]
}
```

### Scheduling
For non-time-sensitive data:
- Schedule Clay table runs during off-peak hours
- Batch webhooks daily instead of real-time
- Reduces load on both systems

### Selective Syncing
Don't sync everything:
- Only send A/B band accounts to Clay
- Only send scored accounts
- Filter by data quality thresholds

## Security

- **Authentication**: Webhook URL includes secret token
- **Org ID Verification**: All requests validated against org_id
- **IP Whitelisting**: Optional (Clay's IP ranges)
- **HTTPS Only**: All webhook traffic encrypted
- **Audit Logging**: All webhook activity logged
- **Payload Validation**: Schema validation before processing

## Troubleshooting

**Webhook Not Triggering**
1. Check webhook URL is correct
2. Verify org_id header is set
3. Test webhook with sample payload
4. Review Clay HTTP API column for errors

**Data Not Appearing**
1. Check webhook logs for errors
2. Verify field mapping is correct
3. Ensure required fields are present
4. Check data type conversions

**Slow Performance**
1. Reduce payload size (fewer fields)
2. Use batching instead of row-by-row
3. Schedule during off-peak hours
4. Consider bulk import for large datasets

## Support Resources

- Setup Guide: `CLAY_INTEGRATION_SETUP.md`
- Field Mapping UI: `ClayFieldMapping.tsx`
- Webhook Receiver: `clay-webhook-receiver` edge function
- Webhook Logs: `ClayIncomingWebhooks.tsx`
- Troubleshooting: `TROUBLESHOOTING_INTEGRATIONS.md`
