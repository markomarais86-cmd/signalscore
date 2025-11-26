# API Architecture

**Version:** 1.0  
**Last Updated:** 2025-11-26  
**Author:** LaunchPulse Engineering Team

## Overview

LaunchPulse's API architecture is built on Supabase Edge Functions, providing serverless, auto-scaling endpoints for all platform operations. The system includes 63 edge functions organized into functional domains, with built-in rate limiting, authentication, and error handling.

## Architecture Principles

### Serverless-First
- **No server management**: Functions scale automatically with demand
- **Pay-per-use**: Costs scale with actual usage
- **Global distribution**: Edge deployment for low latency worldwide

### Domain-Driven Design
Functions are organized by business capability:
- **Scoring**: Account and lead scoring operations
- **Enrichment**: Multi-phase data enrichment
- **CRM Sync**: Bidirectional CRM integration
- **Campaign**: Campaign building and export
- **AI Agents**: Automated workflow execution
- **Data Quality**: Validation and deduplication

### Idempotent Operations
- All mutations accept idempotency keys
- Duplicate requests return cached responses
- Safe for retry logic

## Function Categories

### 1. Scoring Functions (8 functions)

| Function | Purpose | Trigger |
|----------|---------|---------|
| `score-account` | Score single account against ICP | On-demand, CRM webhook |
| `bulk-score-accounts` | Score all accounts in batch | Manual trigger, scheduled |
| `refresh-all-scores` | Recalculate scores after ICP change | ICP update trigger |
| `train-propensity-model` | Train ML model on closed-won deals | Weekly cron |
| `analyze-closed-won` | Compute statistical correlations | Closed-won upload |
| `analyze-correlations` | Feature importance analysis | Monthly cron |
| `analyze-firmographics` | Segment analysis by firmographics | Dashboard query |
| `analyze-cohorts` | Cohort performance tracking | Reporting query |

**Example Request:**
```typescript
// Score single account
const { data, error } = await supabase.functions.invoke('score-account', {
  body: {
    accountExternalId: 'SF_001234567890ABC',
    icpId: 'uuid-of-icp-profile',
    forceRefresh: false
  }
});

// Response:
// {
//   score: 87.5,
//   band: 'A',
//   dimensionScores: {
//     industry: 95,
//     geography: 80,
//     companySize: 90,
//     revenue: 85,
//     technology: 75,
//     funding: 100
//   },
//   dataCompleteness: 0.92
// }
```

### 2. Enrichment Functions (12 functions)

| Function | Purpose | Phase |
|----------|---------|-------|
| `enrich-accounts` | Orchestrate multi-phase enrichment | Entry point |
| `enrich-firmographics` | Basic firmographic enrichment | Phase 2 |
| `enrich-pdl` | People Data Labs contact enrichment | Phase 2 |
| `enrich-clearbit-free` | Clearbit company data (free tier) | Phase 3 |
| `enrich-ai-firmographics` | AI-inferred firmographics | Phase 4 |
| `enrich-tech-stack` | Technology detection | Phase 3 |
| `enrich-funding-data` | Funding and investment data | Phase 3 |
| `enrich-technology-insights` | Deep tech stack analysis | Phase 4 |
| `enrich-contacts-bulk` | Bulk contact enrichment | Phase 2 |
| `enrich-contacts-persona` | Persona-based contact discovery | Phase 3 |
| `deep-enrich-contact` | Deep contact research | Phase 4 |
| `smart-enrich` | Intelligent field selection | All phases |

**Enrichment Waterfall Flow:**
```
User triggers enrichment
        ↓
enrich-accounts (orchestrator)
        ↓
    Phase 1: CRM data (already present)
        ↓
    Phase 2: enrich-pdl + enrich-firmographics (parallel)
        ↓
    Phase 3: enrich-clearbit-free + enrich-tech-stack (parallel)
        ↓
    Phase 4: enrich-ai-firmographics (AI inference)
        ↓
    Update accounts table + enrichment_history
```

**Example Request:**
```typescript
// Smart enrichment (auto-selects missing fields)
const { data, error } = await supabase.functions.invoke('smart-enrich', {
  body: {
    accountExternalId: 'SF_001234567890ABC',
    maxCostUsd: 1.50,
    priorityFields: ['employee_count', 'revenue_range', 'tech_stack']
  }
});
```

### 3. CRM Sync Functions (9 functions)

| Function | Purpose | Integration |
|----------|---------|-------------|
| `salesforce-sync` | Bidirectional Salesforce sync | Salesforce |
| `hubspot-sync` | Bidirectional HubSpot sync | HubSpot |
| `fetch-crm-accounts` | Pull accounts from CRM | Both |
| `push-campaign-to-crm` | Push campaign to CRM | Both |
| `salesforce-webhook` | Receive Salesforce webhooks | Salesforce |
| `scheduled-crm-sync` | Automated sync cron job | Both |
| `oauth-initiate` | Start OAuth flow | Both |
| `oauth-callback` | Handle OAuth callback | Both |
| `oauth-refresh` | Refresh OAuth tokens | Both |

**CRM Sync Flow:**
```
Scheduled trigger (hourly)
        ↓
scheduled-crm-sync
        ↓
fetch-crm-accounts (pull new/updated accounts)
        ↓
Upsert to accounts table
        ↓
match-leads-to-accounts (link contacts to accounts)
        ↓
Trigger scoring (auto-score new accounts)
```

**Example Request:**
```typescript
// Manual CRM sync
const { data, error } = await supabase.functions.invoke('salesforce-sync', {
  body: {
    syncType: 'incremental', // or 'full'
    lastSyncTimestamp: '2025-11-25T10:00:00Z'
  }
});

// Response:
// {
//   accountsSynced: 247,
//   leadsSynced: 1853,
//   errors: [],
//   duration: 8342 // ms
// }
```

### 4. Campaign Functions (5 functions)

| Function | Purpose | Output |
|----------|---------|--------|
| `find-campaign-contacts` | Build campaign from ICP filters | Contact list |
| `generate-campaign-name` | AI-generated campaign naming | Campaign name |
| `estimate-campaign-roi` | Predictive ROI calculation | ROI estimate |
| `push-campaign-to-crm` | Export to CRM | CRM campaign |
| `zapier-sync` | Zapier webhook integration | External system |

**Campaign Building Flow:**
```
User selects ICP + filters
        ↓
find-campaign-contacts
        ↓
Apply persona filters (job titles, seniority, departments)
        ↓
Deduplication (remove duplicates, opt-outs)
        ↓
Reachability scoring (prioritize contactable leads)
        ↓
generate-campaign-name (AI naming)
        ↓
estimate-campaign-roi (predictive analysis)
        ↓
Save to campaign_snapshots
        ↓
push-campaign-to-crm (optional)
```

**Example Request:**
```typescript
// Find campaign contacts
const { data, error } = await supabase.functions.invoke('find-campaign-contacts', {
  body: {
    icpId: 'uuid-of-icp',
    scoreBands: ['A', 'B'],
    personaFilters: {
      jobTitles: ['VP Sales', 'Director Sales', 'CRO'],
      seniorityLevels: ['VP', 'C-Level'],
      departments: ['Sales', 'Revenue Operations']
    },
    maxContactsPerAccount: 3,
    deduplicationStrategy: 'highest_seniority'
  }
});

// Response:
// {
//   totalAccounts: 342,
//   totalContacts: 891,
//   campaignReadyContacts: 783,
//   estimatedReach: 0.88,
//   contacts: [ /* array of contacts */ ]
// }
```

### 5. AI Agent Functions (6 functions)

| Function | Purpose | Agent Type |
|----------|---------|-----------|
| `run-agent` | Execute agent workflow | All |
| `scheduled-agent-runner` | Cron-based agent execution | All |
| `agent-lead-qualification` | Qualify leads automatically | Lead Qualification |
| `agent-follow-up` | Schedule follow-ups | Follow-Up Automation |
| `agent-meeting-scheduler` | Book meetings for high-fit leads | Meeting Scheduler |
| `agent-data-enrichment` | Automated enrichment triggers | Data Enrichment |

**Agent Execution Flow:**
```
Cron trigger (configurable schedule)
        ↓
scheduled-agent-runner
        ↓
Fetch active agents for org
        ↓
For each agent:
    run-agent (execute agent logic)
        ↓
    Log to ai_agent_runs
        ↓
    Update agent.last_run_at
```

**Example Request:**
```typescript
// Run lead qualification agent
const { data, error } = await supabase.functions.invoke('agent-lead-qualification', {
  body: {
    agentId: 'uuid-of-agent',
    filters: {
      scoreBands: ['A'],
      minReachabilityScore: 70,
      notContactedInDays: 30
    }
  }
});

// Response:
// {
//   leadsQualified: 47,
//   tasksCreated: 47,
//   duration: 3421
// }
```

### 6. Data Quality Functions (8 functions)

| Function | Purpose | Frequency |
|----------|---------|-----------|
| `match-leads-to-accounts` | Link contacts to parent accounts | Real-time |
| `deduplicate-contacts` | Remove duplicate contacts | Daily |
| `merge-duplicate-accounts` | Merge duplicate accounts | On-demand |
| `match-external-data` | Match to external databases | On-demand |
| `backfill-contacts` | Contact discovery for accounts | On-demand |
| `verify-contact` | Email/phone verification | Real-time |
| `check-consent` | GDPR consent verification | Real-time |
| `bulk-upload` | CSV/Excel upload processing | On-demand |

### 7. Reporting & Analytics Functions (6 functions)

| Function | Purpose | Use Case |
|----------|---------|----------|
| `generate-icp-insights` | AI-generated ICP insights | Dashboard |
| `generate-icp-recommendations` | AI ICP improvement suggestions | ICP review |
| `generate-scheduled-report` | Automated report generation | Weekly/monthly |
| `weekly-analytics-snapshot` | Snapshot current metrics | Time-series analysis |
| `optimize-sequence` | Optimize email sequences | Campaign optimization |
| `estimate-campaign-roi` | Predictive ROI modeling | Campaign planning |

### 8. Utility Functions (9 functions)

| Function | Purpose | Usage |
|----------|---------|-------|
| `generate-api-key` | Create API keys for external access | Settings |
| `rate-limit-helper` | Rate limiting middleware | All functions |
| `retry-crm-sync` | Retry failed CRM syncs | Error recovery |
| `retry-failed-webhooks` | Retry failed webhook deliveries | Error recovery |
| `send-invitation` | Send user invitations | User management |
| `map-industry-to-zoominfo` | Industry normalization | Data mapping |
| `integration-service` | Integration health monitoring | Diagnostics |
| `process-enrichment` | Enrichment queue processor | Background job |
| `clay-webhook-receiver` | Receive Clay webhooks | Clay integration |

## Authentication & Authorization

### API Key Authentication
```typescript
// All functions require authorization header
const headers = {
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'apikey': SUPABASE_ANON_KEY
};
```

### Row-Level Security (RLS)
- All database queries enforce org_id filtering
- Functions inherit user's organization context
- No cross-tenant data access possible

### API Key Scopes
API keys support granular scopes:
- `read:accounts` - Read account data
- `write:accounts` - Create/update accounts
- `read:scores` - Read scoring data
- `trigger:scoring` - Trigger scoring operations
- `manage:campaigns` - Build and export campaigns

## Rate Limiting

### Global Limits
- **Anonymous requests**: 100 req/min per IP
- **Authenticated requests**: 1000 req/min per org
- **Bulk operations**: 10 req/min per org

### Function-Specific Limits
| Function | Limit | Window |
|----------|-------|--------|
| `score-account` | 500 req/min | Per org |
| `enrich-accounts` | 100 req/min | Per org |
| `bulk-score-accounts` | 5 req/hour | Per org |
| `find-campaign-contacts` | 20 req/min | Per org |

### Rate Limit Headers
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1700000000
```

## Error Handling

### Standard Error Response
```typescript
{
  error: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Rate limit exceeded. Try again in 42 seconds.',
    details: {
      limit: 100,
      remaining: 0,
      resetAt: '2025-11-26T15:30:00Z'
    }
  }
}
```

### Common Error Codes
| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `INVALID_REQUEST` | 400 | Malformed request body |
| `UNAUTHORIZED` | 401 | Missing/invalid auth token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit hit |
| `INTERNAL_ERROR` | 500 | Server error |
| `ENRICHMENT_FAILED` | 502 | Enrichment provider error |
| `CRM_SYNC_FAILED` | 502 | CRM API error |

## Performance Metrics

### Latency Targets
| Operation | P50 | P95 | P99 |
|-----------|-----|-----|-----|
| Score single account | 150ms | 300ms | 500ms |
| Enrich single account | 800ms | 2000ms | 4000ms |
| Find campaign contacts | 500ms | 1500ms | 3000ms |
| CRM sync (100 accounts) | 5s | 12s | 20s |

### Throughput Benchmarks
- **Scoring**: 10,000 accounts/hour/org
- **Enrichment**: 2,000 accounts/hour/org (Phase 2-3)
- **CRM Sync**: 50,000 records/hour/org

## Monitoring & Observability

### Logs
- All function invocations logged to Supabase Logs
- Searchable by function name, org_id, status
- Retention: 7 days (can be exported)

### Metrics
- Function execution time (p50, p95, p99)
- Error rate by function
- Rate limit hit rate
- Integration success rate

### Alerts
- High error rate (>5% for 5 minutes)
- Slow function execution (p95 > 2x target)
- Rate limit exceeded (sustained for 10 minutes)
- Integration failures (>10 consecutive failures)

## Deployment & Versioning

### Automatic Deployment
- Functions auto-deploy on git push
- Zero-downtime deployments
- Instant rollback capability

### Versioning
- Functions versioned in git
- API versions not exposed (backwards compatible changes only)
- Breaking changes require new function name

## Related Documentation

- [Data Model Schema](./Data_Model_Schema.md)
- [Security & Permissions](./Security_Permissions.md)
- [API Reference](../10_API_Reference/Endpoints.md)
- [Integration Guide](../05_Integrations/)

## Support

For API questions or access:
- **Email**: api-support@launchpulse.ai
- **Slack**: #launchpulse-api
- **API Dashboard**: https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/functions

---

**API Version:** 2.0  
**Total Functions:** 63  
**Uptime SLA:** 99.9%
