# HubSpot Integration Guide

## Overview

LaunchPulse integrates with HubSpot to enrich companies and contacts with fit and propensity scores, enabling marketing and sales teams to prioritize high-value prospects.

## Features

- **Company Sync**: Bi-directional company record synchronization
- **Contact Enrichment**: Add persona and reachability data to contacts
- **Score Properties**: Custom properties for fit, propensity, and score bands
- **List Segmentation**: Create HubSpot lists based on LaunchPulse scores
- **Workflow Triggers**: Use scores to trigger HubSpot workflows
- **Deal Intelligence**: Enrich deals with account fit scores

## Setup Requirements

### Prerequisites
1. HubSpot Professional or Enterprise subscription
2. Super Admin permissions
3. Marketing Hub or Sales Hub access

### Initial Setup

Refer to `HUBSPOT_OAUTH_SETUP.md` for detailed OAuth configuration.

**Quick Start:**
1. Go to Settings → Integrations
2. Click "Connect HubSpot"
3. Authorize OAuth scopes (companies, contacts, lists)
4. Configure sync preferences
5. Map custom properties

## Property Mapping

### Company Properties
LaunchPulse creates custom company properties:

| Property Name | Type | Description |
|--------------|------|-------------|
| launchpulse_fit_score | Number | 0-100 overall fit score |
| launchpulse_propensity | Number | 0-100 propensity to buy |
| launchpulse_score_band | Single-line text | A, B, C, or D band |
| launchpulse_icp_match | Single-line text | Matching ICP name |
| launchpulse_last_scored | Date | Last scoring timestamp |
| launchpulse_reachability | Number | Contact availability score |
| launchpulse_data_quality | Number | Data completeness % |

### Contact Properties
| Property Name | Type | Description |
|--------------|------|-------------|
| launchpulse_persona_match | Single-line text | Matching persona |
| launchpulse_seniority | Single-line text | Job seniority level |
| launchpulse_department | Single-line text | Functional department |
| launchpulse_decision_role | Single-line text | Buyer role |
| launchpulse_email_status | Single-line text | Email validity |

## Sync Configuration

### Sync Modes
1. **Import Only**: Pull HubSpot companies into LaunchPulse
2. **Export Only**: Push scores to HubSpot
3. **Bi-Directional**: Two-way sync (recommended)

### Sync Schedule
- **Initial Import**: One-time bulk sync
- **Scheduled Updates**: Every 4 hours (configurable)
- **Real-Time**: Webhook-triggered for critical updates
- **Manual Refresh**: Available anytime

### Filtering Rules
Sync only relevant companies:
- By lifecycle stage
- By lead status
- By list membership
- By property values
- Exclude test/internal companies

## List Segmentation

### Create Scored Lists
Use LaunchPulse scores to create HubSpot lists:

**Example: High-Fit A Accounts**
- Criteria: `launchpulse_score_band = "A"`
- Auto-update as scores change
- Use for targeted campaigns

**Example: High Propensity Prospects**
- Criteria: `launchpulse_propensity > 75`
- Combine with lifecycle stage
- Trigger nurture workflows

### Suggested Lists
LaunchPulse can auto-create these lists:
- A-Band Accounts (High Fit)
- B-Band Accounts (Medium Fit)
- High Propensity (>75)
- Campaign Ready (Has contacts + High score)
- Needs Enrichment (Low data quality)

## Workflow Integration

### Score-Based Workflows
Trigger HubSpot workflows using LaunchPulse data:

**Example 1: High-Fit Account Alert**
- Trigger: `launchpulse_score_band` changes to "A"
- Action: Notify account owner
- Action: Add to outreach sequence

**Example 2: Data Enrichment Request**
- Trigger: `launchpulse_data_quality < 50`
- Action: Create task for SDR
- Action: Send to enrichment queue

**Example 3: Propensity Spike**
- Trigger: `launchpulse_propensity` increases by >20
- Action: Update lead score
- Action: Create deal

## Campaign Export

### Push Campaigns to HubSpot
1. Build campaign in LaunchPulse
2. Select "Export to HubSpot" option
3. Choose target list or create new one
4. Map contact properties
5. Export contacts with scores

### Export Options
- **Create New List**: Fresh list for campaign
- **Add to Existing List**: Append to list
- **Update Properties**: Refresh scores on existing contacts
- **Include Accounts**: Export companies too

## Deal Intelligence

Enrich HubSpot deals with account fit scores:

1. **Auto-Association**: Link deals to LaunchPulse-scored companies
2. **Deal Properties**: Add fit and propensity to deal records
3. **Forecasting**: Use propensity for deal probability
4. **Prioritization**: Sales focus on high-fit deals

**Deal Properties Added:**
- `associated_company_fit_score`
- `associated_company_propensity`
- `launchpulse_close_probability`

## Closed-Won Analysis

Sync closed-won deals back to LaunchPulse for ICP learning:

**Configuration:**
- Settings → Integrations → HubSpot → Deal Sync
- Filter: Deal Stage = "Closed Won"
- Frequency: Daily
- Data: Company properties, deal amount, close date

**Benefits:**
- Improves ICP definitions
- Trains propensity model
- Identifies winning patterns

## Reporting

### HubSpot Reports Using LaunchPulse Data

**Fit Score Distribution Report:**
- Report type: Companies
- Group by: `launchpulse_score_band`
- Visualization: Pie chart

**Conversion by Fit Score:**
- Report type: Deals
- Filter: Closed Won
- Group by: `associated_company_fit_score`
- Metric: Win rate

**Data Quality Dashboard:**
- Report type: Companies
- Metric: Average `launchpulse_data_quality`
- Trend over time

## Troubleshooting

### Common Issues

**Property Not Created**
- Solution: Run property sync from Settings → Integrations
- Verify Super Admin permissions
- Check API scope authorization

**Sync Failures**
- Check HubSpot API rate limits (100 requests/10 seconds)
- Verify OAuth token is valid
- Review error logs in Sync History

**Missing Companies**
- Check filter criteria
- Verify companies have required fields (domain)
- Review sync logs for errors

**Score Not Updating**
- Ensure bi-directional sync is enabled
- Check last sync timestamp
- Manually trigger refresh

### Performance Tips
- Use selective property sync (only needed fields)
- Schedule heavy syncs during off-hours
- Batch operations for >1000 records
- Monitor API usage in HubSpot settings

## API Rate Limits

HubSpot API limits:
- **Professional**: 100 requests per 10 seconds
- **Enterprise**: 150 requests per 10 seconds
- **Daily limit**: 500,000 calls/day

LaunchPulse handles limits:
- Automatic request throttling
- Exponential backoff on errors
- Batch processing (100 records/call)
- Rate limit monitoring

## Security

- OAuth 2.0 authentication
- Scoped permissions (only necessary access)
- Encrypted token storage
- Audit trail of all sync operations
- GDPR-compliant data handling

## Advanced Configuration

### Custom Property Mapping
Map additional fields in Settings → Integrations → Field Mapping:

```json
{
  "hubspot": {
    "company": {
      "custom_priority": "propensity_score",
      "data_source": "enriched_from"
    },
    "contact": {
      "persona_tier": "persona_match_score"
    }
  }
}
```

### Webhook Configuration
Enable real-time updates:
1. HubSpot → Settings → Integrations → Private Apps
2. Create webhook subscription
3. Point to LaunchPulse webhook endpoint
4. Subscribe to company and contact property changes

## Use Cases

### Marketing
- Segment campaigns by fit score
- Prioritize content for A-band accounts
- Personalize messaging by ICP match

### Sales
- Focus on high-propensity leads
- Enrich CRM data automatically
- Get notified of score changes

### Revenue Operations
- Track data quality metrics
- Monitor ICP coverage
- Analyze conversion by fit score

## Support Resources

- Setup Guide: `HUBSPOT_OAUTH_SETUP.md`
- Field Mapping: `FIELD_MAPPING_GUIDE.md`
- CRM Overview: `CRM_SYNC_GUIDE.md`
- Troubleshooting: `TROUBLESHOOTING_INTEGRATIONS.md`
