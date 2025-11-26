# Gong Integration Guide

## Overview

LaunchPulse integrates with Gong to analyze sales call data and identify patterns in successful deals, improving ICP definitions and propensity models.

## Features

- **Call Intelligence**: Analyze Gong calls for deal patterns
- **Topic Analysis**: Identify pain points discussed in won deals
- **Competitor Mentions**: Track competitive landscape insights
- **Deal Velocity**: Correlate call frequency with deal speed
- **Win/Loss Analysis**: Learn from call data in closed deals

## Setup Requirements

### Prerequisites
1. Gong account with API access
2. Technical admin permissions
3. Historical call data (recommended: 6+ months)

### Initial Setup

Refer to `GONG_SETUP.md` for detailed configuration.

**Quick Start:**
1. Obtain Gong API credentials
2. Settings → Integrations → Gong
3. Enter API key and endpoint
4. Configure call sync settings
5. Map Gong users to CRM users

## Call Analysis

### Win/Loss Patterns
LaunchPulse analyzes Gong calls to identify:

- Topics discussed in winning deals
- Questions asked by prospects
- Objections raised (and how handled)
- Decision criteria mentioned
- Competitor mentions
- Buying committee composition

### ICP Refinement
Use call insights to refine ICPs:
- Pain points: Extract from call transcripts
- Buying triggers: Identify from timeline
- Decision roles: Map from participants

## Closed-Won Enhancement

Enrich closed-won analysis with Gong data:

**Process:**
1. LaunchPulse imports closed-won opportunities
2. Matches to Gong calls via CRM opportunity ID
3. Analyzes call transcripts for patterns
4. Extracts topics, sentiment, questions
5. Incorporates into ICP statistical model

**Benefits:**
- Deeper understanding of why deals close
- Identify "hidden" ICP attributes
- Train propensity model on conversation data

## Troubleshooting

See `GONG_SETUP.md` and `TROUBLESHOOTING_INTEGRATIONS.md`.
