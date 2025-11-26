# Deployment Model

**Version:** 1.0  
**Last Updated:** 2025-11-26  
**Author:** LaunchPulse DevOps Team

## Overview

LaunchPulse uses a modern, cloud-native deployment architecture built on Supabase (PostgreSQL + Edge Functions), Vercel (frontend hosting), and managed services for enrichment providers. This document describes the deployment topology, infrastructure, scaling strategy, and operational procedures.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       User's Browser                         │
│                   (React + TypeScript)                       │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS (TLS 1.3)
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                  Vercel CDN (Frontend)                       │
│           - Global Edge Network (275+ locations)             │
│           - Automatic HTTPS, Caching, Compression           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              Supabase Platform (Backend)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database (Primary + Replicas)            │  │
│  │  - Multi-AZ deployment                                │  │
│  │  - Auto-failover (< 30s)                             │  │
│  │  - Point-in-time recovery (7 days)                   │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Edge Functions (Deno Runtime)                        │  │
│  │  - 63 serverless functions                           │  │
│  │  - Auto-scaling (0-∞ instances)                      │  │
│  │  - Global deployment                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Supabase Auth                                        │  │
│  │  - JWT-based authentication                          │  │
│  │  - OAuth providers (Google, SAML)                    │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Supabase Storage                                     │  │
│  │  - S3-compatible object storage                      │  │
│  │  - Campaign exports, file uploads                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────────┐
│              External Services (3rd Party APIs)              │
│  - PDL (People Data Labs)                                   │
│  - ZoomInfo                                                  │
│  - Clearbit                                                  │
│  - Apollo                                                    │
│  - Salesforce / HubSpot (CRM)                               │
│  - OpenAI (GPT-4 for AI insights)                           │
└─────────────────────────────────────────────────────────────┘
```

## Infrastructure Components

### Frontend (Vercel)

**Hosting:**
- **Platform**: Vercel Edge Network
- **Framework**: React 18.3 + Vite 5
- **Build Time**: ~45 seconds
- **Deploy Frequency**: On every `git push` (automatic)

**Performance:**
- **First Contentful Paint (FCP)**: < 1.5s (p95)
- **Time to Interactive (TTI)**: < 3.0s (p95)
- **Lighthouse Score**: 95+ (Performance, Accessibility, Best Practices)

**CDN Configuration:**
```typescript
// vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://dhyfbaptcprxxixgnpby.supabase.co/:path*" }
  ]
}
```

### Backend (Supabase)

**Database:**
- **Engine**: PostgreSQL 15.6
- **Instance Type**: db.t3.medium (2 vCPU, 4 GB RAM) → scales to db.m5.xlarge
- **Storage**: 100 GB SSD (auto-scales to 1 TB)
- **Connections**: 100 max concurrent (pooled via PgBouncer)
- **Replication**: 1 primary + 1 read replica (async replication)

**Connection Pooling:**
```typescript
// PgBouncer configuration
{
  pool_mode: 'transaction', // Release connection after each transaction
  max_client_conn: 100,
  default_pool_size: 20,
  reserve_pool_size: 5,
  server_idle_timeout: 600 // 10 minutes
}
```

**Edge Functions:**
- **Runtime**: Deno 1.38 (V8 JavaScript engine)
- **Deployment**: Git-based (auto-deploy on push to `main`)
- **Cold Start**: < 200ms
- **Warm Instances**: Maintained for 15 minutes after last request
- **Concurrency**: 10 concurrent requests per function instance
- **Timeout**: 60 seconds (configurable to 300s for bulk jobs)

**Storage:**
- **Provider**: Supabase Storage (S3-compatible)
- **Buckets**: 
  - `campaign-exports` - CSV/Excel exports (retention: 30 days)
  - `bulk-uploads` - User-uploaded CSV files (retention: 7 days)
  - `enrichment-logs` - Enrichment history exports (retention: 90 days)
- **Access Control**: RLS policies enforce org-level isolation

### Database Scaling Strategy

**Vertical Scaling (Compute):**
```
Trigger: CPU > 80% for 10 minutes
Action: Scale from t3.medium → t3.large → m5.xlarge → m5.2xlarge
Downtime: ~30 seconds (automatic failover)
```

**Horizontal Scaling (Read Replicas):**
```
Trigger: Read query latency > 500ms (p95)
Action: Add read replica
Routing: 
  - Write queries → Primary
  - Dashboard/reporting queries → Replica
```

**Storage Auto-Scaling:**
```
Trigger: Storage > 90% capacity
Action: Increase storage by 50 GB increments
Max: 1 TB (contact support for higher)
```

## Deployment Pipeline

### CI/CD Workflow

```
Developer pushes code to GitHub
        ↓
GitHub Actions triggered
        ↓
    Run tests (unit + integration)
        ↓
    Build frontend (Vite)
        ↓
    Deploy to Vercel (preview environment)
        ↓
    Run E2E tests (Playwright)
        ↓
    ✅ All tests pass?
        │
        ├─ Yes → Deploy to production
        │   ├─ Vercel (frontend)
        │   └─ Supabase (edge functions, migrations)
        │
        └─ No → Notify developer (Slack alert)
```

**GitHub Actions Configuration:**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build frontend
        run: npm run build
      
      - name: Deploy to Vercel
        uses: vercel/action@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
      
      - name: Deploy Supabase Functions
        run: npx supabase functions deploy --project-ref dhyfbaptcprxxixgnpby
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

### Database Migrations

**Migration Strategy:**
```
Developer writes SQL migration
        ↓
Save to supabase/migrations/YYYYMMDDHHMMSS_description.sql
        ↓
Test locally with supabase db reset
        ↓
Commit to git
        ↓
CI/CD pipeline applies migration to staging
        ↓
QA approval
        ↓
Apply to production (automatic on merge to main)
```

**Example Migration:**
```sql
-- supabase/migrations/20251126120000_add_propensity_scores.sql
CREATE TABLE propensity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  account_external_id TEXT NOT NULL,
  propensity_score NUMERIC(5,2) CHECK (propensity_score BETWEEN 0 AND 100),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  model_version TEXT NOT NULL,
  UNIQUE (org_id, account_external_id)
);

CREATE INDEX idx_propensity_scores_org_account 
  ON propensity_scores(org_id, account_external_id);

-- Enable RLS
ALTER TABLE propensity_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON propensity_scores
  FOR ALL
  USING (org_id = auth.jwt() ->> 'app_metadata' ->> 'org_id');
```

**Rollback Procedure:**
```bash
# Revert last migration
supabase db reset --project-ref dhyfbaptcprxxixgnpby

# Or apply specific migration
psql -h db.dhyfbaptcprxxixgnpby.supabase.co -U postgres \
  -f supabase/migrations/rollback_20251126120000.sql
```

## Monitoring & Observability

### Metrics Collection

**Frontend (Vercel Analytics):**
- **Web Vitals**: LCP, FID, CLS, TTFB
- **Page Views**: Pageviews per route
- **Traffic Sources**: Referrers, countries, devices

**Backend (Supabase Metrics):**
- **Database**: CPU, memory, connections, query latency
- **Edge Functions**: Invocations, errors, duration, cold starts
- **Storage**: Request count, bandwidth, storage used

**Custom Metrics (PostHog):**
- User actions (button clicks, form submissions)
- Feature adoption rates
- Conversion funnels (signup → first campaign)

### Logging

**Application Logs:**
```typescript
// All edge functions log to Supabase Logs
console.log('INFO: Scoring account', { accountId, icpId });
console.error('ERROR: Enrichment failed', { error, accountId });
```

**Log Retention:**
- **Supabase Logs**: 7 days (free tier) → 90 days (Pro tier)
- **Audit Logs**: 2 years (stored in `audit_logs` table)
- **Integration Logs**: 90 days (stored in `integration_logs` table)

**Log Aggregation:**
```bash
# Query logs via Supabase CLI
supabase logs --project-ref dhyfbaptcprxxixgnpby \
  --type edge-functions \
  --filter "score-account" \
  --tail

# Or via API
curl https://api.supabase.com/v1/projects/dhyfbaptcprxxixgnpby/logs \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

### Alerting

**Alert Channels:**
- **Email**: Engineering team (critical alerts only)
- **Slack**: #launchpulse-alerts (all alerts)
- **PagerDuty**: On-call engineer (P0/P1 incidents)

**Alert Rules:**

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| High Error Rate | >5% errors for 5min | P1 | Page on-call |
| Database CPU High | >90% CPU for 10min | P1 | Auto-scale + alert |
| Function Timeout | >10 timeouts/min | P2 | Investigate |
| API Latency High | p95 > 2s for 5min | P2 | Investigate |
| CRM Sync Failed | 3 consecutive failures | P2 | Alert integrations team |
| Disk Space Low | >85% used | P3 | Auto-scale storage |

### Health Checks

**Frontend Health:**
```typescript
// /health endpoint
export default function Health() {
  return Response.json({
    status: 'healthy',
    version: import.meta.env.VITE_APP_VERSION,
    uptime: process.uptime()
  });
}
```

**Backend Health:**
```sql
-- Database health check
SELECT 
  current_database() as db_name,
  pg_database_size(current_database()) as size_bytes,
  (SELECT count(*) FROM pg_stat_activity) as active_connections,
  (SELECT max(now() - query_start) FROM pg_stat_activity WHERE state = 'active') as oldest_query_age;
```

**External Dependencies:**
```typescript
// Check external services
async function checkDependencies() {
  const checks = await Promise.allSettled([
    fetch('https://api.peopledatalabs.com/v5/health'),
    fetch('https://api.zoominfo.com/health'),
    fetch('https://login.salesforce.com/services/oauth2/token')
  ]);
  
  return checks.map((result, i) => ({
    service: ['PDL', 'ZoomInfo', 'Salesforce'][i],
    status: result.status === 'fulfilled' ? 'up' : 'down'
  }));
}
```

## Backup & Disaster Recovery

### Automated Backups

**Database Backups:**
- **Frequency**: Every 24 hours (full backup)
- **Incremental**: WAL archiving (every 5 minutes)
- **Retention**: 7 days (free tier) → 30 days (Pro tier)
- **Storage**: S3 (encrypted at rest)
- **Recovery Time Objective (RTO)**: 1 hour
- **Recovery Point Objective (RPO)**: 5 minutes

**Point-in-Time Recovery (PITR):**
```bash
# Restore database to specific timestamp
supabase db restore --project-ref dhyfbaptcprxxixgnpby \
  --timestamp "2025-11-26T10:30:00Z"
```

### Disaster Recovery Plan

**Scenario 1: Primary Database Failure**
```
Primary database becomes unavailable
        ↓
Automatic failover to read replica (< 30s)
        ↓
Promote replica to primary
        ↓
Update DNS records (if necessary)
        ↓
Notify engineering team
        ↓
Investigate root cause
        ↓
Provision new replica
```

**Scenario 2: Region-Wide Outage (AWS us-east-1)**
```
AWS region outage detected
        ↓
Failover to secondary region (manual trigger)
        ↓
Restore latest backup to new region
        ↓
Update application configuration
        ↓
Deploy frontend to new CDN edge locations
        ↓
Test critical workflows
        ↓
Update DNS to point to new region
        ↓
Notify customers of temporary degradation
```

**RTO/RPO Targets:**
| Scenario | RTO | RPO |
|----------|-----|-----|
| Database instance failure | 30 seconds | 0 (sync replication) |
| Database corruption | 1 hour | 5 minutes |
| Region-wide outage | 4 hours | 1 hour |
| Complete data center loss | 24 hours | 1 hour |

## Security Considerations

### Network Security
- **TLS 1.3**: All traffic encrypted in transit
- **WAF (Web Application Firewall)**: Cloudflare (DDoS protection, bot mitigation)
- **IP Allowlisting**: Database accessible only from Supabase edge functions

### Secrets Management
```typescript
// Secrets stored in Supabase Secrets (encrypted at rest)
const pdlApiKey = Deno.env.get('PDL_API_KEY');
const salesforceClientSecret = Deno.env.get('SALESFORCE_CLIENT_SECRET');

// Never commit secrets to git
// Set via: supabase secrets set PDL_API_KEY=xxx --project-ref dhyfbaptcprxxixgnpby
```

### Compliance
- **SOC 2 Type II**: In progress (expected Q1 2026)
- **GDPR**: Compliant (data residency options available)
- **CCPA**: Compliant (user data export/deletion)

## Cost Optimization

### Current Monthly Costs (Estimated)

| Service | Usage | Cost |
|---------|-------|------|
| Supabase (Pro) | Database + Edge Functions | $25/month |
| Vercel (Pro) | Frontend hosting + CDN | $20/month |
| Enrichment APIs | ~10,000 enrichments/month | $500/month |
| Storage (S3) | 50 GB | $1.15/month |
| **Total** | | **~$546/month** |

### Scaling Costs

**100 customers (avg 5,000 accounts each):**
- Database: $25 (Pro tier) → $99 (Team tier)
- Edge Functions: Included
- Enrichment: $5,000/month (50k enrichments)
- Total: ~$5,100/month

**1,000 customers:**
- Database: $99 (Team) → $599 (Enterprise)
- Edge Functions: Included
- Enrichment: $50,000/month (500k enrichments)
- Total: ~$50,600/month

## Related Documentation

- [System Overview](./System_Overview.md)
- [Security & Permissions](./Security_Permissions.md)
- [API Architecture](./API_Architecture.md)
- [Data Model Schema](./Data_Model_Schema.md)

## Support

For infrastructure questions:
- **Email**: devops@launchpulse.ai
- **Slack**: #launchpulse-infra
- **Status Page**: https://status.launchpulse.ai

---

**Infrastructure Version:** 2.0  
**Last Updated:** 2025-11-26  
**Uptime SLA:** 99.9% (measured monthly)
