# Groove Integration Guide

## Overview

LaunchPulse integrates with Groove to enrich accounts and contacts with fit scores, enabling sales teams to prioritize their Groove flows and activities.

## Features

- **Contact Sync**: Export LaunchPulse contacts to Groove
- **Account Scoring**: Push fit scores to Groove account custom fields
- **Flow Assignment**: Auto-add high-score contacts to Groove flows
- **Activity Prioritization**: Highlight high-fit accounts in Groove
- **Engagement Tracking**: Monitor Groove engagement in LaunchPulse

## Setup Requirements

### Prerequisites
1. Groove account (Professional or Enterprise)
2. Admin permissions in Groove
3. Salesforce integration configured in Groove

### Initial Setup

Refer to `GROOVE_SETUP.md` for detailed configuration.

**Quick Start:**
1. Settings → Integrations → Groove
2. Click "Connect Groove"
3. Authorize API access
4. Configure custom field mappings
5. Test connection

## Field Mapping

### Account Custom Fields in Salesforce
(Groove uses Salesforce fields)

- `LaunchPulse_Fit_Score__c` (Number)
- `LaunchPulse_Score_Band__c` (Text)
- `LaunchPulse_ICP_Match__c` (Text)

### Contact Custom Fields
- `LaunchPulse_Persona_Match__c` (Text)
- `LaunchPulse_Reachability__c` (Number)

**Note:** Groove reads these fields from Salesforce, so ensure Salesforce integration is configured first.

## Campaign Export

Export campaigns to Groove flows:

1. Build campaign in LaunchPulse
2. Select "Export to Groove"
3. Choose target flow
4. Map personas to flow steps
5. Export contacts

**Process:**
- Contacts exported to Salesforce first (as Leads/Contacts)
- LaunchPulse triggers Groove flow enrollment
- Groove executes flow based on scores

## Flow Prioritization

Use fit scores to prioritize Groove activities:

**High-Fit Flow:**
- Trigger: Score Band = "A"
- Actions: High-touch sequence, more calls, executive involvement

**Medium-Fit Flow:**
- Trigger: Score Band = "B"
- Actions: Standard cadence, mixed email/call

**Low-Fit Flow:**
- Trigger: Score Band = "C/D"
- Actions: Email-only nurture, lower frequency

## Engagement Tracking

Track Groove engagement in LaunchPulse:

**Metrics:**
- Email opens/clicks
- Call completion
- Meeting scheduled
- Response rate

**Use Cases:**
- Update propensity scores based on engagement
- Identify active prospects
- Measure campaign effectiveness
- Alert sales on hot leads

## Troubleshooting

### Common Issues

**Fields Not Syncing**
- Verify Salesforce integration is working
- Check field-level security in Salesforce
- Ensure custom fields are created
- Review Groove field mapping

**Flows Not Triggering**
- Check flow enrollment criteria includes LaunchPulse fields
- Verify Salesforce workflow rules
- Review Groove flow logs
- Test with sample contact

## Support Resources

- Setup Guide: `GROOVE_SETUP.md`
- Salesforce Setup: `SALESFORCE_OAUTH_SETUP.md`
- Troubleshooting: `TROUBLESHOOTING_INTEGRATIONS.md`
