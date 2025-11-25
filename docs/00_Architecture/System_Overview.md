# System Overview

**Version:** 1.0  
**Last Updated:** 2025-11-25  
**Author:** LaunchPulse Engineering Team

## Overview

LaunchPulse is a comprehensive B2B account intelligence and lead scoring platform built on Supabase, React, and TypeScript. It ingests data from CRMs (Salesforce, HubSpot), enriches accounts through multiple providers, applies statistical scoring models, and pushes actionable campaigns back to CRMs.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                            │
│  Salesforce │ HubSpot │ Apollo │ ZoomInfo │ Clay │ Webhooks   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      INGESTION LAYER                            │
│  • OAuth Handlers (Salesforce, HubSpot, Outreach, SalesLoft)  │
│  • Webhook Receivers (Clay, Zapier, Salesforce)                │
│  • Scheduled Sync Jobs (Cron: 4hr, 24hr intervals)             │
│  • Bulk Upload Processing                                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA PROCESSING LAYER                        │
│  • Lead-Account Matching (fuzzy domain matching)               │
│  • Duplicate Detection & Merging                                │
│  • Data Validation & Quality Checks                             │
│  • Domain Normalization                                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ENRICHMENT LAYER                             │
│  Phase 1: PDL API (People Data Labs)                           │
│  Phase 2: Clearbit Free Tier                                    │
│  Phase 3: AI Estimation (GPT-4 based)                          │
│  Phase 4: Deep Research (high-value accounts only)             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SCORING ENGINE                             │
│  • ICP Fit Scoring (multi-dimensional)                         │
│  • Statistical V2.0 Algorithm (weighted dimensions)             │
│  • Propensity Model (ML-based)                                  │
│  • Score Band Assignment (A/B/C)                                │
│  • Bulk Scoring Jobs (chunked processing)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AI AGENTS                                │
│  Agent 1: Lead Qualification                                    │
│  Agent 2: Follow-Up Automation                                  │
│  Agent 3: Meeting Scheduler                                     │
│  Agent 4: Data Enrichment Triggers                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAMPAIGN BUILDER                             │
│  • ICP-based Filtering                                          │
│  • Persona Matching                                             │
│  • Contact Discovery                                            │
│  • Deduplication                                                │
│  • Export to CRM/CSV                                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     OUTPUT LAYER                                │
│  • CRM Push (Salesforce, HubSpot)                              │
│  • CSV Export                                                   │
│  • API Webhooks                                                 │
│  • Zapier Integration                                           │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: React Router v6
- **State Management**: TanStack Query (React Query)
- **UI Components**: Shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS with custom design system
- **Charts**: Recharts, D3.js
- **Build Tool**: Vite

### Backend
- **Platform**: Supabase (PostgreSQL + Edge Functions)
- **Database**: PostgreSQL 15 with 62 tables
- **Edge Functions**: Deno-based serverless functions (63 functions)
- **Authentication**: Supabase Auth with Row Level Security (RLS)
- **Storage**: Supabase Storage for file uploads
- **Cron Jobs**: pg_cron for scheduled tasks

### Infrastructure
- **Hosting**: Supabase Cloud (managed PostgreSQL + edge runtime)
- **CDN**: Automatic edge caching via Supabase
- **Monitoring**: Sentry for error tracking
- **Logs**: Supabase Analytics (Postgres logs, Auth logs, Function logs)

## Core Components

### 1. Accounts & Leads
- **accounts**: 12,413 records with enriched firmographics
- **Leads**: 13,412 contacts linked to accounts
- **Matching Algorithm**: Fuzzy domain matching with 99.96% link rate

### 2. ICP Management
- **icp_profiles**: Multi-dimensional ICP definitions
- **icp_feature_weights**: Statistical correlation analysis
- **icp_templates**: Pre-built industry templates

### 3. Scoring System
- **scores**: Current ICP fit scores (11,618 scored accounts)
- **score_history**: Time-series score tracking
- **propensity_scores**: ML-based conversion prediction

### 4. Integration System
- **integration_configs**: OAuth tokens and sync configuration
- **integration_sync_logs**: Sync history and errors
- **webhook_retry_queue**: Automatic retry for failed webhooks

### 5. Enrichment System
- **enrichment_jobs**: Batch enrichment tracking
- **enrichment_history**: Provider-level enrichment logs
- **enrichment_spending**: Cost tracking by provider

### 6. Campaign System
- **campaign_snapshots**: Historical campaign exports
- **campaign_templates**: Reusable persona criteria
- **campaign_naming_registry**: Unique campaign name generation

### 7. AI Agents
- **ai_agents**: Agent definitions and schedules
- **ai_agent_runs**: Execution history and results

## Data Flow

### Inbound: CRM → LaunchPulse

1. **OAuth Connection**: User connects Salesforce/HubSpot via OAuth 2.0
2. **Initial Sync**: Full account/contact/opportunity sync (30-120 min)
3. **Incremental Sync**: Every 4 hours via cron job `crm-sync-periodic`
4. **Webhook Events**: Real-time updates from Salesforce webhooks
5. **Data Processing**:
   - Domain normalization
   - Lead-account matching
   - Duplicate detection
   - Data quality scoring

### Enrichment: LaunchPulse Internal

1. **Smart Enrichment Waterfall**:
   - PDL API: $0.005/call, 40% coverage
   - Clearbit Free: $0.001/call, 30% coverage
   - AI Estimation: $0.01/account, 80% coverage
   - Deep Research: $0.10/account (high-value only)

2. **Enrichment Triggers**:
   - New account creation
   - Manual enrichment request
   - Scheduled bulk enrichment (weekly)
   - Pre-campaign enrichment

### Scoring: LaunchPulse Internal

1. **ICP Fit Scoring**:
   - Multi-dimensional weighted algorithm
   - Dimensions: Industry, Geography, Size, Revenue, Tech Stack
   - Output: 0-100 score + A/B/C band

2. **Scoring Triggers**:
   - New account after enrichment
   - ICP profile changes
   - Manual re-score request
   - Scheduled bulk scoring (daily)

### Outbound: LaunchPulse → CRM

1. **Campaign Creation**: User builds campaign in Campaign Builder
2. **Filtering**: Accounts filtered by ICP, score threshold, persona
3. **Contact Discovery**: Find contacts matching persona criteria
4. **Deduplication**: Remove contacts already in active campaigns
5. **Export Options**:
   - **CSV Export**: Download for manual upload
   - **Salesforce Campaign**: Push to SFDC campaign members
   - **HubSpot List**: Create static list in HubSpot
   - **Outreach Sequence**: Add to Outreach sequence

## Security Architecture

### Authentication
- **Method**: Supabase Auth (email/password + magic links)
- **Multi-tenancy**: Organization-based with `org_id` isolation
- **Row Level Security (RLS)**: All tables enforce org_id policies

### Authorization
- **Roles**: Platform Admin, Org Admin, User, Viewer
- **Permissions**: Granular access control per feature
- **API Keys**: SHA-256 hashed with rate limiting

### Data Protection
- **Encryption at Rest**: PostgreSQL native encryption
- **Encryption in Transit**: TLS 1.3 for all connections
- **Secret Management**: Supabase Secrets (encrypted Vault)
- **Audit Logs**: Full audit trail in `audit_logs` table

## Scalability

### Current Capacity
- **Accounts**: 12.4K (tested to 100K+)
- **Leads**: 13.4K (tested to 500K+)
- **Scores**: 11.6K (bulk scoring: 10K/hour)
- **API Rate Limits**: 100 req/sec per org

### Optimization Strategies
- **Cursor Pagination**: Infinite scroll for large datasets
- **Chunked Processing**: Bulk jobs processed in 100-record chunks
- **Materialized Views**: Pre-computed analytics tables
- **Edge Caching**: CDN caching for static assets
- **Database Indexing**: Optimized indexes on high-query columns

## Monitoring & Observability

### Metrics Tracked
- **System Health**: Database connections, function execution times
- **Data Quality**: Completeness scores, enrichment coverage
- **Scoring Performance**: Scores per hour, success rates
- **Integration Health**: Sync success rates, API errors
- **User Activity**: Page views, feature usage

### Alerting
- **Critical**: Database down, auth failures, scoring stopped
- **Warning**: Enrichment failures, sync delays >24hr
- **Info**: New user signup, large exports

## Related Documentation

- [Data Model Schema](./Data_Model_Schema.md) - Complete database schema
- [Scoring Engine Architecture](./Scoring_Engine_Architecture.md) - Scoring deep-dive
- [API Architecture](./API_Architecture.md) - Edge functions and endpoints
- [Security & Permissions](./Security_Permissions.md) - Security model
- [Deployment Model](./Deployment_Model.md) - Infrastructure details

## Support

For technical questions:
- **Engineering Team**: engineering@launchpulse.ai
- **Documentation Issues**: docs@launchpulse.ai
- **Slack**: #launchpulse-engineering
