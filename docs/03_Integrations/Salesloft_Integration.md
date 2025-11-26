# Salesloft Integration Guide

## Overview

LaunchPulse integrates with Salesloft to enrich people and accounts with fit and propensity scores, enabling sales teams to prioritize their cadences.

## Features

- **People Sync**: Export LaunchPulse contacts to Salesloft
- **Account Scoring**: Push fit scores to Salesloft account custom fields
- **Cadence Assignment**: Auto-add high-score people to cadences
- **Custom Field Mapping**: Flexible field configuration
- **Activity Sync**: Track engagement back to LaunchPulse

## Setup Requirements

### Prerequisites
1. Salesloft account (Team or Enterprise)
2. Admin permissions
3. API key from Salesloft settings

### Initial Setup

Refer to `SALESLOFT_SETUP.md` for step-by-step guide.

**Quick Start:**
1. Get API key from Salesloft → Settings → API
2. Settings → Integrations → Salesloft
3. Enter API key
4. Configure custom fields
5. Test connection

## Field Mapping

### Account Custom Fields
- `launchpulse_fit_score` (Number 0-100)
- `launchpulse_score_band` (Text A/B/C/D)
- `launchpulse_icp` (Text ICP name)

### Person Custom Fields
- `launchpulse_persona` (Text persona match)
- `launchpulse_reachability` (Number 0-100)

## Campaign Export

Export campaigns to Salesloft cadences:

1. Build campaign in LaunchPulse
2. Select "Export to Salesloft"
3. Choose cadence
4. Map personas to cadence steps
5. Export people

## Troubleshooting

See `SALESLOFT_SETUP.md` and `TROUBLESHOOTING_INTEGRATIONS.md`.
