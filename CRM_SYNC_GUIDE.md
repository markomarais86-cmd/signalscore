# CRM Sync Guide

## Overview

This guide covers CRM synchronization strategies, frequency options, and best practices for maintaining data consistency between your CRM (Salesforce/HubSpot) and the ICP Signal Platform.

**Version:** 1.0  
**Last Updated:** 2025-11-06

---

## Sync Modes

### 1. Initial Full Sync
**When:** First-time setup
**Duration:** 30 min - 2 hours (depends on data volume)
**What:** Imports all historical data

**Process:**
1. Connects to CRM
2. Fetches all accounts, contacts, opportunities
3. Imports into database
4. Triggers enrichment
5. Runs ICP scoring

### 2. Incremental Sync
**When:** Ongoing (hourly/daily)
**Duration:** 1-5 minutes
**What:** Only fetches changed records

**Process:**
1. Query CRM for records updated since last sync
2. Update existing records
3. Create new records
4. Mark deleted records

### 3. Webhook (Real-time)
**When:** Record changes in CRM
**Duration:** Instant (< 5 seconds)
**What:** Pushes single record change

**Process:**
1. Record updated in CRM
2. CRM sends webhook
3. Your system receives update
4. Updates single record

---

## Sync Frequency Options

### Recommended by Company Size

| Company Size | Accounts | Sync Frequency | Why |
|--------------|----------|----------------|-----|
| Startup (<50 accounts) | < 100 | Daily | Low change rate |
| SMB | 100-1,000 | Hourly | Moderate changes |
| Mid-Market | 1,000-10,000 | Hourly + Webhooks | High activity |
| Enterprise | 10,000+ | Webhooks + 4x daily | Critical data freshness |

---

## Sync Configuration

### Settings → CRM Integration
- **Sync Frequency:** Hourly (recommended)
- **Sync Direction:** CRM → Platform (read-only)
- **Conflict Resolution:** CRM data wins
- **Webhook:** Enabled (if available)

---

## Monitoring Sync Health

### Daily Checks
- Integration Health dashboard
- Sync success rate > 95%
- Last sync < 24 hours ago

### Weekly Checks
- Review failed syncs
- Verify data quality
- Check webhook delivery

---

## Troubleshooting

### Sync Fails
1. Check credentials valid
2. Check API rate limits
3. Review error logs
4. Verify field mappings

### Data Missing
1. Check date filters
2. Verify CRM permissions
3. Check RLS policies
4. Review sync logs

---

**Last Updated:** 2025-11-06
