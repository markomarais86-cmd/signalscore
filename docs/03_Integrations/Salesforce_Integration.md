# Salesforce Integration Guide

## Overview

LaunchPulse integrates bi-directionally with Salesforce to sync accounts, contacts, and scores. This enables sales teams to work in their native environment while leveraging LaunchPulse's scoring intelligence.

## Features

- **Bi-Directional Account Sync**: Automatically sync accounts between Salesforce and LaunchPulse
- **Real-Time Scoring**: Push fit scores, propensity scores, and score bands to Salesforce custom fields
- **Contact Enrichment**: Enrich Salesforce contacts with persona data
- **Campaign Push**: Export scored campaigns directly to Salesforce campaigns
- **Webhook Updates**: Real-time updates when accounts change in Salesforce
- **Closed-Won Analysis**: Analyze closed-won opportunities to improve ICP definitions

## Setup Requirements

### Prerequisites
1. Salesforce Professional Edition or higher
2. System Administrator or equivalent permissions
3. API access enabled

### Initial Setup

Refer to `SALESFORCE_OAUTH_SETUP.md` in the root directory for detailed OAuth configuration steps.

**Quick Setup:**
1. Navigate to Settings → Integrations
2. Click "Connect Salesforce"
3. Authorize OAuth connection
4. Configure field mappings
5. Enable webhook listener (see `SALESFORCE_WEBHOOK_SETUP.md`)

## Field Mapping

### Standard Account Fields
| LaunchPulse Field | Salesforce Field |
|------------------|-----------------|
| external_id | AccountId |
| name | Name |
| domain | Website |
| employee_count | NumberOfEmployees |
| revenue_range | AnnualRevenue |
| industry_norm | Industry |
| country | BillingCountry |
| state_province | BillingState |

### Custom Score Fields
LaunchPulse creates these custom fields in Salesforce:

- `LaunchPulse_Fit_Score__c` (Number, 0-100)
- `LaunchPulse_Propensity_Score__c` (Number, 0-100)
- `LaunchPulse_Score_Band__c` (Text, A/B/C/D)
- `LaunchPulse_ICP_Match__c` (Text, ICP name)
- `LaunchPulse_Last_Scored__c` (DateTime)
- `LaunchPulse_Reachability__c` (Number, 0-100)

## Sync Configuration

### Sync Frequency
- **Initial Sync**: One-time bulk import of all accounts
- **Scheduled Sync**: Daily at 2:00 AM (configurable)
- **Real-Time Updates**: Webhook-triggered for account changes
- **Manual Sync**: Available in Settings → Integrations

### Sync Direction Options
1. **Salesforce → LaunchPulse Only**: Import accounts, no writes back
2. **Bi-Directional**: Sync accounts both ways, update scores in Salesforce
3. **LaunchPulse → Salesforce Only**: Push scores only, don't import

### Filtering
Configure which accounts to sync:
- By record type
- By owner
- By territory
- By custom field values
- Exclude inactive/deleted accounts

## Campaign Export

### Push Campaigns to Salesforce
1. Build campaign in LaunchPulse (see Campaign Builder Guide)
2. Select "Push to Salesforce" export option
3. Choose or create Salesforce Campaign
4. Map campaign member status
5. LaunchPulse creates Campaign Members with status

### Campaign Member Fields
LaunchPulse populates:
- ContactId (or LeadId)
- CampaignId
- Status (e.g., "Sent", "Targeted")
- `LaunchPulse_Score_Band__c` (custom field)
- `LaunchPulse_Export_Date__c` (custom field)

## Closed-Won Data Sync

LaunchPulse analyzes closed-won opportunities to improve scoring:

1. **Automatic Import**: Daily sync of opportunities with Stage = "Closed Won"
2. **Data Used**: Account demographics, opportunity amount, close date
3. **ICP Refinement**: Statistical analysis identifies winning patterns
4. **Propensity Training**: ML model learns from won deals

**Configuration:**
- Settings → Integrations → Salesforce → Closed-Won Sync
- Filter by date range, opportunity type, or amount threshold

## Webhook Integration

Real-time updates when accounts change in Salesforce.

See `SALESFORCE_WEBHOOK_SETUP.md` for:
- Apex trigger setup
- Outbound message configuration
- Security token handling
- Retry logic

## Troubleshooting

### Common Issues

**Sync Failures**
- Check API limits (Salesforce has daily limits)
- Verify OAuth token hasn't expired
- Check field-level security permissions
- Review sync logs in Settings → Integrations → Sync History

**Missing Custom Fields**
- Run field deployment from Settings → Integrations
- Verify System Administrator permissions
- Check field-level security for profiles

**Duplicate Accounts**
- Configure duplicate matching rules (domain-based recommended)
- Use LaunchPulse's duplicate merger in Settings → Data Quality

**Webhook Not Triggering**
- Verify Apex trigger is active
- Check remote site settings
- Review webhook logs in Supabase edge function logs
- See `TROUBLESHOOTING_INTEGRATIONS.md`

### Performance Optimization
- Enable bulk API for large syncs (>10K accounts)
- Schedule syncs during off-peak hours
- Use selective field syncing (only required fields)
- Implement pagination for large datasets

## API Rate Limits

Salesforce imposes API call limits:
- **Professional**: 1,000 calls/24 hours
- **Enterprise**: 5,000 calls/24 hours  
- **Unlimited**: 10,000 calls/24 hours

LaunchPulse optimizes API usage:
- Batch operations (200 records per call)
- Change detection (only sync modified records)
- Intelligent scheduling
- Rate limit monitoring with alerts

## Security

- OAuth 2.0 authentication (no password storage)
- Encrypted credential storage
- Field-level security respected
- Row-level security (sharing rules) respected
- Audit logging of all sync operations

## Advanced Configuration

### Custom Field Mapping
Create custom mappings in Settings → Integrations → Field Mapping:
```json
{
  "custom_field__c": "enrichment_field",
  "priority_score__c": "propensity_score"
}
```

### Selective Sync Rules
Use SOQL-style filters:
```
Type = 'Customer' AND Industry != NULL AND BillingCountry = 'United States'
```

## Support Resources

- Setup Guide: `SALESFORCE_OAUTH_SETUP.md`
- Webhook Guide: `SALESFORCE_WEBHOOK_SETUP.md`
- Field Mapping: `FIELD_MAPPING_GUIDE.md`
- Troubleshooting: `TROUBLESHOOTING_INTEGRATIONS.md`
- CRM Sync Overview: `CRM_SYNC_GUIDE.md`
