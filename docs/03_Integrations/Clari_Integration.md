# Clari Integration Guide

## Overview

LaunchPulse integrates with Clari to enhance revenue forecasting with account fit and propensity scores, enabling more accurate pipeline predictions.

## Features

- **Pipeline Enrichment**: Add fit scores to Clari pipeline
- **Forecast Accuracy**: Use propensity scores for deal probability
- **Account Intelligence**: Enrich Clari accounts with ICP data
- **Risk Identification**: Flag low-fit deals in pipeline
- **Historical Analysis**: Analyze closed deals by fit score

## Setup Requirements

### Prerequisites
1. Clari account with API access
2. Admin permissions
3. Clari CRM integration (Salesforce/HubSpot) configured

### Initial Setup

Refer to `CLARI_SETUP.md` for detailed configuration.

**Quick Start:**
1. Obtain Clari API credentials
2. Settings → Integrations → Clari
3. Enter API endpoint and key
4. Configure field mappings
5. Enable pipeline sync

## Pipeline Enrichment

Push LaunchPulse scores to Clari:

**Fields Added:**
- Account fit score (0-100)
- Propensity score (0-100)
- Score band (A/B/C/D)
- ICP match name
- Data quality score

**Use Cases:**
- Adjust close probabilities based on propensity
- Flag low-fit deals for review
- Segment pipeline by fit band
- Analyze win rates by ICP match

## Closed-Won Analysis

Sync closed-won data back to LaunchPulse:

**Process:**
1. Clari identifies closed-won opportunities
2. LaunchPulse imports deal data
3. Analyzes firmographics of won accounts
4. Refines ICP definitions
5. Trains propensity model

**Benefits:**
- Continuous ICP improvement
- ML model learns from revenue data
- Identify hidden success patterns

## Troubleshooting

See `CLARI_SETUP.md` and `TROUBLESHOOTING_INTEGRATIONS.md`.
