# Data Model & Schema Documentation

**Version:** 1.0  
**Last Updated:** 2025-11-26  
**Author:** LaunchPulse Engineering Team

## Overview

LaunchPulse's data model consists of 62 interconnected tables designed to support account intelligence, scoring, enrichment, CRM synchronization, and campaign management. This document provides a comprehensive reference of the database schema, relationships, and design patterns.

## Schema Organization

The database is organized into the following functional domains:

| Domain | Tables | Purpose |
|--------|--------|---------|
| **Core Entities** | accounts, Leads, organizations, profiles | Primary business objects |
| **Scoring** | scores, icp_profiles, icp_feature_weights, propensity_scores | Multi-dimensional scoring engine |
| **Enrichment** | enrichment_jobs, enrichment_history, enrichment_field_coverage | Data enrichment workflows |
| **Integrations** | integration_configs, integration_logs, crm_field_mappings | CRM and external system connections |
| **Campaigns** | campaign_snapshots, campaign_templates, campaign_naming_registry | Campaign building and export tracking |
| **AI Agents** | ai_agents, ai_agent_runs, agent_configurations | Automated workflow agents |
| **Data Quality** | data_quality_history, duplicate_accounts, domain_aliases | Data hygiene and monitoring |
| **Security** | audit_logs, api_keys, consent_registry | Security, compliance, audit trail |

## Core Entity Relationships

```
organizations (tenant)
    ├── accounts (1:many)
    │   ├── Leads (1:many)
    │   ├── scores (1:many)
    │   └── enrichment_history (1:many)
    │
    ├── icp_profiles (1:many)
    │   ├── scores (1:many)
    │   └── icp_feature_weights (1:many)
    │
    ├── integration_configs (1:many)
    ├── ai_agents (1:many)
    └── campaign_snapshots (1:many)
```

## Table Details

### accounts

Primary table for company/account data with enrichment tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `org_id` | UUID | Tenant identifier (FK → organizations) |
| `external_id` | TEXT | CRM identifier (e.g., Salesforce Account ID) |
| `name` | TEXT | Company name |
| `domain` | TEXT | Primary website domain |
| `industry_norm` | TEXT | Normalized industry classification |
| `industry_raw` | TEXT | Original industry from source system |
| `employee_count` | INTEGER | Number of employees |
| `revenue_range` | TEXT | Revenue bracket (e.g., "$1M-$10M") |
| `country` | TEXT | ISO country code |
| `state_province` | TEXT | State or province |
| `tech_stack` | TEXT[] | Array of detected technologies |
| `total_raised_usd` | NUMERIC | Total funding raised |
| `last_funding_round` | TEXT | Most recent funding round type |
| `last_funding_date` | DATE | Date of last funding |
| `enriched_at` | TIMESTAMP | Last enrichment timestamp |
| `enriched_from` | TEXT | Source of enrichment (PDL, Clearbit, AI) |
| `enrichment_phase` | TEXT | Current enrichment phase (1-4) |
| `enrichment_confidence` | NUMERIC | Confidence score (0-1) |
| `data_source` | TEXT | Origin system (CRM, API, manual) |
| `updated_at` | TIMESTAMP | Last modification timestamp |

**Indexes:**
- `idx_accounts_org_external` on (org_id, external_id) - Fast CRM lookups
- `idx_accounts_domain` on (domain) - Domain matching
- `idx_accounts_enrichment_phase` on (enrichment_phase) - Enrichment queue processing

### Leads

Contact-level data linked to accounts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `org_id` | UUID | Tenant identifier |
| `account_external_id` | TEXT | Parent account reference |
| `external_id` | TEXT | CRM contact/lead ID |
| `email` | TEXT | Primary email address |
| `first_name` | TEXT | First name |
| `last_name` | TEXT | Last name |
| `title` | TEXT | Job title |
| `seniority` | TEXT | Seniority level (C-Level, VP, Director, etc.) |
| `department` | TEXT | Functional department |
| `phone` | TEXT | Phone number |
| `mobile` | TEXT | Mobile number |
| `linkedin_url` | TEXT | LinkedIn profile URL |
| `reachability_score` | NUMERIC | Contact reachability score (0-100) |
| `persona_match_score` | NUMERIC | ICP persona alignment score |
| `last_enriched_at` | TIMESTAMP | Last persona enrichment |
| `created_at` | TIMESTAMP | Record creation |

**Indexes:**
- `idx_leads_account` on (org_id, account_external_id) - Account rollup
- `idx_leads_email` on (email) - Deduplication
- `idx_leads_persona_score` on (persona_match_score) - Campaign filtering

### scores

Multi-dimensional account scores with versioning.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `org_id` | UUID | Tenant identifier |
| `account_external_id` | TEXT | Account reference |
| `icp_id` | UUID | ICP profile reference (FK → icp_profiles) |
| `icp_version` | INTEGER | ICP version at scoring time |
| `overall_score` | NUMERIC | Final weighted score (0-100) |
| `score_band` | TEXT | Score band (A/B/C/D) |
| `dimension_scores` | JSONB | Individual dimension scores |
| `base_score` | NUMERIC | Pre-boost score |
| `boost_applied` | NUMERIC | Closed-won boost amount |
| `data_completeness` | NUMERIC | Data quality factor |
| `scored_at` | TIMESTAMP | Scoring timestamp |
| `scoring_duration_ms` | INTEGER | Execution time |

**Indexes:**
- `idx_scores_account_icp` on (org_id, account_external_id, icp_id) - Unique constraint
- `idx_scores_band` on (score_band) - Band filtering
- `idx_scores_overall` on (overall_score DESC) - Leaderboard queries

### icp_profiles

Ideal Customer Profile definitions with persona and firmographic criteria.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `org_id` | UUID | Tenant identifier |
| `name` | TEXT | ICP name |
| `description` | TEXT | ICP description |
| `is_primary` | BOOLEAN | Primary ICP flag |
| `version` | INTEGER | Version number |
| `industries` | TEXT[] | Target industries |
| `sub_industries` | TEXT[] | Sub-industry targets |
| `geographies` | TEXT[] | Target countries |
| `regions` | TEXT[] | Target regions |
| `company_sizes` | INTEGER[] | Employee count ranges |
| `revenue_ranges` | TEXT[] | Revenue brackets |
| `tech_stack` | TEXT[] | Required/preferred technologies |
| `funding_status` | TEXT[] | Funding stage filters |
| `persona_job_titles` | TEXT[] | Target job titles |
| `persona_seniority_levels` | TEXT[] | Seniority levels |
| `persona_departments` | TEXT[] | Target departments |
| `match_count` | INTEGER | Current matching account count |
| `created_at` | TIMESTAMP | Creation timestamp |

### integration_configs

CRM and external system connection configurations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `org_id` | UUID | Tenant identifier |
| `integration_type` | TEXT | salesforce, hubspot, apollo, etc. |
| `is_active` | BOOLEAN | Active status |
| `credentials` | JSONB | Encrypted credentials |
| `field_mappings` | JSONB | Field mapping configuration |
| `sync_frequency` | TEXT | Sync schedule (hourly, daily, etc.) |
| `last_sync_at` | TIMESTAMP | Last successful sync |
| `sync_status` | TEXT | Current sync status |
| `created_at` | TIMESTAMP | Configuration creation |

## Data Flow Patterns

### 1. Account Ingestion

```
CRM/API → accounts (upsert)
          ↓
    Lead matching → Leads (link to account)
          ↓
    Enrichment queue → enrichment_jobs
          ↓
    Scoring trigger → scores (calculate)
```

### 2. Enrichment Waterfall

```
Phase 1: CRM data → accounts (native fields)
Phase 2: PDL lookup → enrichment_history (contact data)
Phase 3: Clearbit → enrichment_history (firmographics)
Phase 4: AI inference → enrichment_history (advanced signals)
```

### 3. Campaign Export

```
ICP filter → accounts (match criteria)
     ↓
Persona filter → Leads (match personas)
     ↓
Deduplication → campaign_snapshots (export record)
     ↓
CRM push → integration_logs (sync tracking)
```

## Key Design Patterns

### Multi-Tenancy
- All tables include `org_id` for tenant isolation
- Row-Level Security (RLS) policies enforce org_id filtering
- Indexes include org_id as first column for partition pruning

### Soft Deletes
- No hard deletes on core entities
- `deleted_at` timestamps preserve audit trail
- Queries filter `WHERE deleted_at IS NULL`

### Versioning
- ICPs and scores track version numbers
- Historical versions retained for audit
- Scoring references specific ICP version

### Audit Trail
- `audit_logs` table captures all mutations
- Trigger-based logging on sensitive tables
- Stores actor, action, timestamp, metadata

### Idempotency
- `external_id` provides natural keys from source systems
- Upserts use ON CONFLICT (org_id, external_id)
- Deduplication at ingestion prevents drift

## Performance Considerations

### Indexing Strategy
- Composite indexes lead with org_id for tenant filtering
- Covering indexes reduce table lookups
- Partial indexes on status fields reduce index size

### Partitioning
- `audit_logs` partitioned by month (retention = 2 years)
- `enrichment_history` partitioned by created_at (retention = 1 year)
- Campaign snapshots partitioned by exported_at (retention = 6 months)

### Caching Layers
- Scores cached in-memory for dashboard queries
- ICP profiles cached per tenant
- Integration configs cached with 5-minute TTL

## Data Retention Policies

| Table | Retention | Archival Strategy |
|-------|-----------|-------------------|
| accounts | Indefinite | None |
| Leads | Indefinite | None |
| scores | 2 years | Archive to cold storage |
| enrichment_history | 1 year | Archive to S3 |
| audit_logs | 2 years | Partition drop |
| integration_logs | 90 days | Partition drop |
| campaign_snapshots | 6 months | Archive to S3 |

## Security & Compliance

### Row-Level Security (RLS)
All tables enforce RLS policies:
```sql
CREATE POLICY tenant_isolation ON accounts
  USING (org_id = current_setting('app.current_org_id')::uuid);
```

### Encryption
- At-rest: PostgreSQL native encryption
- In-transit: SSL/TLS required
- Credentials: AES-256 encrypted in integration_configs

### PII Handling
- Email addresses hashed for deduplication
- Consent tracked in consent_registry
- GDPR deletion via cascade_delete function

## Related Documentation

- [Scoring Engine Architecture](./Scoring_Engine_Architecture.md)
- [API Architecture](./API_Architecture.md)
- [Security & Permissions](./Security_Permissions.md)
- [CRM Flow Documentation](./CRM_LaunchPulse_CRM_Flow.md)

## Support

For schema questions or access requests:
- **Email**: engineering@launchpulse.ai
- **Slack**: #launchpulse-data-team
- **Database Access**: Request via Settings → Integrations → Supabase

---

**Schema Version:** 2.0  
**Total Tables:** 62  
**Last Migration:** 2025-11-20
