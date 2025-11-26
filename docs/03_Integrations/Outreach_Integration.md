# Outreach Integration Guide

## Overview

LaunchPulse integrates with Outreach to sync scored accounts and contacts, enabling sales teams to prioritize outreach based on fit and propensity scores.

## Features

- **Prospect Sync**: Export LaunchPulse contacts to Outreach prospects
- **Account Enrichment**: Push fit scores to Outreach account custom fields
- **Sequence Assignment**: Auto-add high-score prospects to sequences
- **Custom Field Mapping**: Map LaunchPulse scores to Outreach fields
- **Bi-Directional Sync**: Update LaunchPulse when prospects engage

## Setup Requirements

### Prerequisites
1. Outreach account (Professional or Enterprise)
2. Admin permissions in Outreach
3. OAuth app configured (contact Outreach support)

### Initial Setup

Refer to `OUTREACH_SETUP.md` for detailed OAuth configuration.

**Quick Start:**
1. Settings → Integrations → Outreach
2. Click "Connect Outreach"
3. Authorize OAuth scopes (accounts, prospects, sequences)
4. Configure custom field mappings
5. Test connection

## Field Mapping

### Account Custom Fields
LaunchPulse creates these custom fields in Outreach:

- `launchpulse_fit_score` (Number)
- `launchpulse_propensity` (Number)
- `launchpulse_score_band` (Text: A/B/C/D)
- `launchpulse_icp_match` (Text: ICP name)

### Prospect Custom Fields
- `launchpulse_persona_match` (Text)
- `launchpulse_reachability` (Number)
- `launchpulse_data_quality` (Number)

## Campaign Export

Push campaigns to Outreach sequences:

1. Build campaign in LaunchPulse
2. Select "Export to Outreach"
3. Choose target sequence
4. Map persona to sequence variants
5. Export contacts as prospects

## Troubleshooting

See `OUTREACH_SETUP.md` and `TROUBLESHOOTING_INTEGRATIONS.md` for common issues.
