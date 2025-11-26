# CRM ↔ LaunchPulse ↔ CRM Data Flow

**Version:** 1.0  
**Last Updated:** 2025-11-26  
**Author:** LaunchPulse Engineering Team

## Overview

LaunchPulse implements bidirectional data synchronization with CRM systems (Salesforce, HubSpot), enabling continuous enrichment, scoring, and campaign intelligence. This document describes the complete data flow from CRM ingestion through scoring and enrichment, and back to CRM via campaign exports.

## High-Level Flow Diagram

```
┌─────────────┐         ┌─────────────────┐         ┌─────────────┐
│             │ Pull    │                 │ Push    │             │
│     CRM     │ ───────>│  LaunchPulse   │ ───────>│     CRM     │
│  (Source)   │         │   (Platform)    │         │ (Enhanced)  │
│             │ <───────│                 │ <───────│             │
└─────────────┘ Webhook └─────────────────┘ API     └─────────────┘
                                │
                                │ Enrichment
                                │ Scoring
                                │ AI Insights
                                ▼
                        ┌───────────────┐
                        │  External     │
                        │  Data         │
                        │  Providers    │
                        │  (PDL, ZI,    │
                        │   Clearbit)   │
                        └───────────────┘
```

## Phase 1: CRM → LaunchPulse (Data Ingestion)

### 1.1 Scheduled Pull Sync

**Frequency:** Hourly (configurable: 15min, hourly, daily)

**Process:**
```
Cron trigger (every hour)
        ↓
scheduled-crm-sync edge function
        ↓
fetch-crm-accounts (OAuth API call)
        ↓
Fetch accounts + contacts modified since last_sync_at
        ↓
Transform to LaunchPulse schema
        ↓
Upsert to accounts table (ON CONFLICT external_id)
        ↓
Upsert to Leads table (ON CONFLICT external_id)
        ↓
Update integration_logs (success/failure)
```

**Salesforce Query:**
```sql
SELECT Id, Name, Website, Industry, NumberOfEmployees, 
       AnnualRevenue, BillingCountry, BillingState, Type,
       LastModifiedDate
FROM Account
WHERE LastModifiedDate >= :lastSyncTimestamp
ORDER BY LastModifiedDate ASC
LIMIT 10000
```

**HubSpot Query:**
```typescript
// GET /crm/v3/objects/companies
{
  properties: [
    'name', 'domain', 'industry', 'numberofemployees',
    'annualrevenue', 'country', 'state', 'hs_lastmodifieddate'
  ],
  filterGroups: [{
    filters: [{
      propertyName: 'hs_lastmodifieddate',
      operator: 'GTE',
      value: lastSyncTimestamp
    }]
  }],
  limit: 100,
  after: paginationToken
}
```

**Data Mapping:**

| LaunchPulse Field | Salesforce Field | HubSpot Field |
|-------------------|------------------|---------------|
| `name` | `Account.Name` | `name` |
| `domain` | `Account.Website` | `domain` |
| `industry_raw` | `Account.Industry` | `industry` |
| `employee_count` | `Account.NumberOfEmployees` | `numberofemployees` |
| `revenue_range` | Derived from `AnnualRevenue` | `annualrevenue` |
| `country` | `Account.BillingCountry` | `country` |
| `state_province` | `Account.BillingState` | `state` |
| `external_id` | `Account.Id` | `hs_object_id` |

### 1.2 Real-Time Webhook Sync

**Salesforce Outbound Messages:**
```xml
<!-- Workflow Rule: Account Updated -->
<OutboundMessage>
  <AccountId>001234567890ABC</AccountId>
  <Name>Acme Corporation</Name>
  <Website>acme.com</Website>
  <Industry>Technology</Industry>
  <!-- ... other fields -->
</OutboundMessage>
```

**HubSpot Webhooks:**
```json
// POST to https://api.launchpulse.ai/webhooks/hubspot
{
  \"eventType\": \"company.propertyChange\",
  \"objectId\": 12345678,
  \"propertyName\": \"industry\",
  \"propertyValue\": \"Software\",
  \"occurredAt\": \"2025-11-26T10:30:00.000Z\"
}
```

**Webhook Processing:**
```
Webhook received at salesforce-webhook function
        ↓
Validate signature + replay attack check
        ↓
Transform payload to LaunchPulse schema
        ↓
Upsert to accounts table
        ↓
Trigger auto-scoring (if enabled)
        ↓
Return 200 OK
```

### 1.3 Lead-to-Account Matching

After account ingestion, contacts/leads must be linked to parent accounts:

```
Leads ingested from CRM
        ↓
match-leads-to-accounts function
        ↓
Match by:
    1. CRM-provided AccountId (if present)
    2. Email domain → Account domain
    3. Company name fuzzy matching
        ↓
Update Leads.account_external_id
        ↓
Calculate account contact_count
```

**Matching Algorithm:**
```typescript
// Priority 1: CRM relationship
if (lead.AccountId) {
  return accounts.find(a => a.external_id === lead.AccountId);
}

// Priority 2: Email domain
const emailDomain = extractDomain(lead.email);
const domainMatch = accounts.find(a => a.domain === emailDomain);
if (domainMatch) return domainMatch;

// Priority 3: Company name fuzzy match (>85% similarity)
const fuzzyMatch = accounts.find(a => 
  similarity(a.name, lead.company) > 0.85
);
return fuzzyMatch || null;
```

## Phase 2: Enrichment Within LaunchPulse

### 2.1 Enrichment Trigger

Accounts are automatically queued for enrichment:

**Trigger Conditions:**
- New account created (never enriched)
- Account updated with missing fields
- Manual "Smart Enrich" request
- Scheduled weekly re-enrichment

**Enrichment Waterfall:**
```
Account requires enrichment
        ↓
enrich-accounts orchestrator
        ↓
Phase 1: CRM data (already present)
        ↓
Phase 2: PDL + Basic firmographics (parallel)
    ├─> enrich-pdl (contact data)
    └─> enrich-firmographics (company data)
        ↓
Phase 3: Clearbit + Tech stack (parallel)
    ├─> enrich-clearbit-free (free tier)
    └─> enrich-tech-stack (BuiltWith, Wappalyzer)
        ↓
Phase 4: AI inference (advanced signals)
    └─> enrich-ai-firmographics (GPT-4 inference)
        ↓
Update accounts table
        ↓
Log to enrichment_history
```

**Cost Control:**
- Check enrichment budget before each phase
- Skip expensive providers if budget exceeded
- Smart field selection (only enrich missing fields)

### 2.2 Scoring Trigger

After enrichment, accounts are automatically scored:

```
Account enrichment completed
        ↓
score-account function
        ↓
Fetch account + ICP profile
        ↓
Calculate dimension scores:
    - Industry match
    - Geography match
    - Company size match
    - Revenue match
    - Technology match
    - Funding signals
        ↓
Apply weights + data completeness adjustment
        ↓
Fetch closed-won correlations
        ↓
Apply boost (if account matches closed-won patterns)
        ↓
Assign score band (A/B/C/D)
        ↓
Upsert to scores table
        ↓
Trigger AI insights generation (if A/B band)
```

## Phase 3: Campaign Building

Users build campaigns from scored accounts:

```
User selects ICP + score bands
        ↓
find-campaign-contacts function
        ↓
Query accounts WHERE:
    - icp_id matches
    - score_band IN ('A', 'B')
    - has_contacts = true
        ↓
Fetch associated leads
        ↓
Apply persona filters:
    - Job titles
    - Seniority levels
    - Departments
        ↓
Deduplication:
    - Remove duplicates by email
    - Respect consent_registry opt-outs
    - Apply max_contacts_per_account limit
        ↓
Reachability scoring:
    - Email deliverability
    - Phone availability
    - LinkedIn profile presence
        ↓
generate-campaign-name (AI naming)
        ↓
Save to campaign_snapshots
```

## Phase 4: LaunchPulse → CRM (Campaign Export)

### 4.1 Campaign Push to CRM

**Salesforce Push:**
```
User clicks "Push to Salesforce"
        ↓
push-campaign-to-crm function
        ↓
Create Salesforce Campaign
        ↓
For each account:
    Create CampaignMember (link Account to Campaign)
    Update Account custom fields:
        - LaunchPulse_Score__c
        - LaunchPulse_Band__c
        - LaunchPulse_ICP__c
        ↓
For each lead:
    Create Task or Activity
        ↓
Log to integration_logs
```

**Salesforce API Calls:**
```typescript
// 1. Create Campaign
const campaign = await sfApi.post('/sobjects/Campaign', {
  Name: 'Q4 2025 High-Fit Outreach',
  IsActive: true,
  Type: 'Outbound',
  Status: 'Planned'
});

// 2. Add Campaign Members (bulk)
await sfApi.post('/composite/sobjects', {
  allOrNothing: false,
  records: accounts.map(acc => ({
    attributes: { type: 'CampaignMember' },
    CampaignId: campaign.id,
    ContactId: acc.primary_contact_id,
    Status: 'Sent'
  }))
});

// 3. Update Account fields (bulk)
await sfApi.patch('/composite/sobjects/Account', {
  allOrNothing: false,
  records: accounts.map(acc => ({
    Id: acc.external_id,
    LaunchPulse_Score__c: acc.score,
    LaunchPulse_Band__c: acc.score_band,
    LaunchPulse_Last_Scored__c: new Date().toISOString()
  }))
});
```

**HubSpot Push:**
```typescript
// 1. Create HubSpot List
const list = await hubspotApi.post('/contacts/v1/lists', {
  name: 'LaunchPulse - High Fit Accounts',
  dynamic: false,
  portalId: orgConfig.hubspot_portal_id
});

// 2. Add contacts to list (bulk)
await hubspotApi.post(`/contacts/v1/lists/${list.listId}/add`, {
  vids: contacts.map(c => c.hubspot_vid)
});

// 3. Update contact properties (bulk)
await hubspotApi.post('/contacts/v1/contact/batch', {
  properties: contacts.map(c => ({
    vid: c.hubspot_vid,
    properties: [{
      property: 'launchpulse_score',
      value: c.score
    }, {
      property: 'launchpulse_band',
      value: c.score_band
    }]
  }))
});
```

### 4.2 CSV Export (Alternative)

```
User clicks "Export to CSV"
        ↓
Generate CSV with columns:
    - Company Name
    - Domain
    - Industry
    - Employee Count
    - Country
    - LaunchPulse Score
    - Score Band
    - Contact Name
    - Contact Email
    - Contact Title
    - Contact Phone
        ↓
Save to campaign_snapshots (exported_emails JSONB)
        ↓
Return download URL (Supabase Storage)
```

### 4.3 API Integration (Zapier, Make, etc.)

```
User configures Zapier integration
        ↓
LaunchPulse webhook triggers on:
    - New A/B account scored
    - Campaign created
    - Account enriched
        ↓
Zapier receives webhook payload
        ↓
User's Zapier workflow:
    - Add to Google Sheets
    - Send Slack notification
    - Create Asana task
    - Update Airtable
```

## Data Consistency & Conflict Resolution

### Conflict Scenarios

**Scenario 1: Account updated in both systems**
```
Last sync: 2025-11-26 10:00:00
CRM update: 2025-11-26 10:05:00 (Industry changed)
LaunchPulse update: 2025-11-26 10:03:00 (Employee count enriched)

Resolution: Merge both changes (both fields updated)
```

**Scenario 2: Duplicate detection**
```
CRM Account A (Id: 001XXX, Domain: acme.com)
CRM Account B (Id: 002YYY, Domain: acme.com)

Resolution: 
  - Create warning in integration_logs
  - Link both to same LaunchPulse account
  - Suggest merge in diagnostics panel
```

### Sync Direction Priority

| Field | CRM → LP | LP → CRM | Winner |
|-------|----------|----------|--------|
| Name | ✓ | ✗ | CRM (source of truth) |
| Industry | ✓ | ✗ | CRM |
| Employee Count | ✓ | ✓ | Most recent |
| Tech Stack | ✗ | ✓ | LaunchPulse only |
| LaunchPulse Score | ✗ | ✓ | LaunchPulse only |

## Performance & Scalability

### Sync Performance

| CRM | Records/Hour | Latency (p95) | Rate Limit |
|-----|--------------|---------------|------------|
| Salesforce | 50,000 | 2.5s | 100 req/min |
| HubSpot | 36,000 | 3.2s | 100 req/10s |

### Batch Processing

**Bulk Upsert Pattern:**
```typescript
// Batch size: 200 records per transaction
const BATCH_SIZE = 200;
const chunks = chunkArray(accounts, BATCH_SIZE);

for (const chunk of chunks) {
  await supabase.from('accounts').upsert(chunk, {
    onConflict: 'org_id,external_id',
    ignoreDuplicates: false
  });
}
```

### Error Handling

**Retry Logic:**
```typescript
async function syncWithRetry(syncFn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await syncFn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Exponential backoff: 2s, 4s, 8s
      const delay = Math.pow(2, attempt) * 1000;
      await sleep(delay);
    }
  }
}
```

## Monitoring & Diagnostics

### Sync Health Metrics

- **Sync Success Rate**: 99.8% (last 7 days)
- **Average Sync Duration**: 8.3 seconds (10,000 records)
- **Failed Syncs**: 2 (automatically retried)
- **Data Drift Detected**: 0 accounts

### Integration Dashboard

Available in Settings → Integrations:
- Last sync timestamp
- Records synced (accounts + leads)
- Success/failure rate
- Error log viewer
- Manual sync trigger

## Related Documentation

- [Salesforce OAuth Setup](../04_Access_Credentials/Salesforce_OAuth_Setup.md)
- [HubSpot OAuth Setup](../04_Access_Credentials/HubSpot_OAuth_Setup.md)
- [Data Model Schema](./Data_Model_Schema.md)
- [API Architecture](./API_Architecture.md)
- [Field Mapping Guide](../05_Integrations/Salesforce/Field_Mapping.md)

## Support

For CRM sync issues:
- **Email**: integrations@launchpulse.ai
- **Slack**: #launchpulse-crm-sync
- **Live Chat**: In-app support (bottom right)

---

**Integration Version:** 2.0  
**Supported CRMs:** Salesforce, HubSpot  
**Sync Frequency:** Hourly (configurable)
