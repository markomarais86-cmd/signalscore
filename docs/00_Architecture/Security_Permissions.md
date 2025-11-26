# Security & Permissions

**Version:** 1.0  
**Last Updated:** 2025-11-26  
**Author:** LaunchPulse Security Team

## Overview

LaunchPulse implements defense-in-depth security architecture with multiple layers of protection: authentication, authorization, encryption, audit logging, and compliance controls. This document details the security model, Row-Level Security (RLS) policies, permission system, and compliance measures.

## Security Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Network Security (TLS 1.3, WAF, DDoS)        │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 2: Authentication (OAuth, JWT, MFA)              │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 3: Authorization (RLS, RBAC, API Scopes)         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 4: Data Encryption (At-rest, In-transit)         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 5: Audit & Monitoring (Logs, Alerts, SIEM)       │
└─────────────────────────────────────────────────────────┘
```

## Authentication

### User Authentication

**Methods Supported:**
1. **Email/Password** - Supabase Auth with bcrypt hashing
2. **Google OAuth** - Single Sign-On (SSO)
3. **SAML/SSO** - Enterprise SSO (Business/Enterprise plans)
4. **Magic Link** - Passwordless email authentication

**Password Requirements:**
- Minimum 12 characters
- Must include: uppercase, lowercase, number, special character
- Cannot contain user's name or email
- Password history: last 5 passwords cannot be reused
- Expiry: 90 days (Enterprise plans)

**Multi-Factor Authentication (MFA):**
- TOTP-based (Google Authenticator, Authy)
- SMS-based (optional, requires Twilio integration)
- Backup codes (10 single-use codes)
- Required for Admin/Owner roles (Enterprise plans)

### Session Management

**JWT Tokens:**
```typescript
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "app_metadata": {
    "org_id": "org-uuid",
    "role": "admin"
  },
  "iss": "https://dhyfbaptcprxxixgnpby.supabase.co/auth/v1",
  "aud": "authenticated",
  "exp": 1700000000, // Expires in 1 hour
  "iat": 1699996400
}
```

**Session Settings:**
- **Access token lifetime**: 1 hour
- **Refresh token lifetime**: 30 days
- **Absolute session timeout**: 7 days (requires re-authentication)
- **Idle timeout**: 2 hours (configurable per org)

### API Authentication

**API Key Authentication:**
```typescript
// Generate API key in Settings → Integrations → API Keys
const apiKey = 'lp_sk_live_1234567890abcdef';

// Use in requests
fetch('https://api.launchpulse.ai/v1/accounts', {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
});
```

**API Key Types:**
- **Secret Key** (`lp_sk_*`): Full access, server-side only
- **Publishable Key** (`lp_pk_*`): Read-only, client-safe
- **Restricted Key** (`lp_rk_*`): Custom scopes defined

**API Key Scopes:**
| Scope | Description | Risk Level |
|-------|-------------|------------|
| `read:accounts` | Read account data | Low |
| `write:accounts` | Create/update accounts | Medium |
| `read:scores` | Read scoring data | Low |
| `trigger:scoring` | Trigger scoring jobs | Medium |
| `manage:campaigns` | Build/export campaigns | High |
| `admin:*` | Full platform access | Critical |

## Authorization

### Row-Level Security (RLS)

**All tables enforce multi-tenant isolation via RLS policies:**

```sql
-- accounts table RLS policy
CREATE POLICY "tenant_isolation" ON accounts
  FOR ALL
  USING (org_id = auth.jwt() ->> 'app_metadata' ->> 'org_id');

-- Prevents cross-tenant data access
-- User from Org A cannot see/modify Org B's data
```

**RLS Bypass (Service Role):**
- Edge functions use service_role key (bypasses RLS)
- Service account validates org_id programmatically
- All mutations logged to audit_logs

### Role-Based Access Control (RBAC)

**User Roles:**

| Role | Permissions | Use Case |
|------|-------------|----------|
| **Owner** | Full platform access, billing, user management | CEO, Founder |
| **Admin** | All features except billing | RevOps Director |
| **User** | View data, build campaigns, trigger enrichment | Sales Manager |
| **Read-Only** | View-only access to dashboards and reports | Executive, Analyst |
| **API** | Programmatic access via API keys | Integration account |

**Permission Matrix:**

| Action | Owner | Admin | User | Read-Only |
|--------|-------|-------|------|-----------|
| View accounts/leads | ✓ | ✓ | ✓ | ✓ |
| Trigger scoring | ✓ | ✓ | ✓ | ✗ |
| Trigger enrichment | ✓ | ✓ | ✓ | ✗ |
| Build campaigns | ✓ | ✓ | ✓ | ✗ |
| Manage ICPs | ✓ | ✓ | ✓ | ✗ |
| Connect CRM | ✓ | ✓ | ✗ | ✗ |
| Manage API keys | ✓ | ✓ | ✗ | ✗ |
| Invite users | ✓ | ✓ | ✗ | ✗ |
| Manage billing | ✓ | ✗ | ✗ | ✗ |
| Delete organization | ✓ | ✗ | ✗ | ✗ |

**Implementing RBAC:**
```typescript
// Check user role in edge function
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', userId)
  .single();

if (!['owner', 'admin'].includes(profile.role)) {
  return new Response(JSON.stringify({
    error: 'Insufficient permissions'
  }), { status: 403 });
}
```

### Field-Level Permissions

**Sensitive Fields (restricted to Owner/Admin):**
- `integration_configs.credentials` (encrypted)
- `api_keys.key_hash`
- `enrichment_spending.total_spent`
- `profiles.email` (own org users only)

**RLS Policy Example:**
```sql
-- Hide API key hashes from non-admins
CREATE POLICY "api_keys_visibility" ON api_keys
  FOR SELECT
  USING (
    org_id = current_setting('app.current_org_id')::uuid
    AND (
      -- Admins see all keys
      current_setting('app.current_role') IN ('owner', 'admin')
      -- Users see only their own keys
      OR created_by = auth.uid()
    )
  );
```

## Data Encryption

### Encryption at Rest

**Database Encryption:**
- **Algorithm**: AES-256-GCM
- **Key Management**: Supabase-managed keys (rotating every 90 days)
- **Scope**: All tables, indexes, backups

**Application-Level Encryption:**
```typescript
// Encrypt sensitive fields before storage
import { createCipheriv, createDecipheriv } from 'crypto';

function encryptCredentials(credentials: object): string {
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  return cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
}

// Store encrypted in integration_configs.credentials
await supabase.from('integration_configs').insert({
  credentials: encryptCredentials({
    access_token: salesforceToken,
    refresh_token: refreshToken
  })
});
```

**Fields Encrypted at Application Layer:**
- `integration_configs.credentials` - OAuth tokens, API keys
- `api_keys.key_hash` - SHA-256 hashed
- `consent_registry.email` - Hashed for deduplication

### Encryption in Transit

**TLS Configuration:**
- **Protocol**: TLS 1.3 (minimum TLS 1.2)
- **Cipher Suites**: 
  - TLS_AES_256_GCM_SHA384
  - TLS_CHACHA20_POLY1305_SHA256
  - TLS_AES_128_GCM_SHA256
- **Certificate**: Let's Encrypt (auto-renewed)
- **HSTS**: Enabled (max-age=31536000)

**API Endpoints:**
- All API calls require HTTPS
- HTTP requests automatically redirected to HTTPS
- Certificate pinning available for mobile apps

## Audit Logging

### Audit Log Schema

**audit_logs table:**
```typescript
interface AuditLog {
  id: string;
  org_id: string;
  actor: string; // user_id or 'system'
  action: string; // e.g., 'account.enriched', 'icp.created'
  resource_type: string; // 'account', 'icp', 'campaign'
  resource_id: string;
  metadata: {
    before?: object; // State before change
    after?: object; // State after change
    ip_address: string;
    user_agent: string;
  };
  created_at: timestamp;
}
```

**Logged Actions:**
- User authentication (login, logout, MFA)
- Data mutations (create, update, delete)
- Bulk operations (scoring, enrichment, export)
- Permission changes (role assignment, API key creation)
- Configuration changes (ICP updates, integration settings)
- Sensitive data access (view PII, export contacts)

**Example Audit Log Entry:**
```json
{
  "id": "log_abc123",
  "org_id": "org_xyz789",
  "actor": "user_john_doe",
  "action": "campaign.exported",
  "resource_type": "campaign",
  "resource_id": "campaign_456",
  "metadata": {
    "export_type": "salesforce",
    "accounts_exported": 247,
    "contacts_exported": 891,
    "ip_address": "203.0.113.42",
    "user_agent": "Mozilla/5.0..."
  },
  "created_at": "2025-11-26T10:30:00Z"
}
```

### Audit Log Retention

- **Storage**: 2 years (configurable to 7 years for Enterprise)
- **Access**: Owner/Admin roles only
- **Export**: CSV/JSON export available
- **SIEM Integration**: Webhook to external SIEM (Splunk, DataDog)

## Compliance & Data Privacy

### GDPR Compliance

**Right to Access:**
```typescript
// User requests their data
const { data } = await supabase.rpc('export_user_data', {
  user_id: requestingUserId
});
// Returns JSON with all user data
```

**Right to Erasure (Right to be Forgotten):**
```typescript
// Delete user and all associated data
await supabase.rpc('gdpr_delete_user', {
  user_id: userToDelete,
  reason: 'User requested deletion'
});
// Cascades to:
// - profiles
// - audit_logs (anonymized)
// - campaign_snapshots (email removed)
// - consent_registry (marked opted-out)
```

**Consent Management:**
- `consent_registry` table tracks email consent
- Opt-out respected in all campaigns
- Consent source tracked (web form, email, CRM)

### SOC 2 Type II (In Progress)

**Control Objectives:**
- **Security**: Unauthorized access prevention
- **Availability**: 99.9% uptime SLA
- **Processing Integrity**: Data accuracy and completeness
- **Confidentiality**: Encryption and access controls
- **Privacy**: GDPR/CCPA compliance

### Data Residency

**Current Region:** US-East (AWS us-east-1)

**Coming Soon:**
- EU-West (Frankfurt) - GDPR compliance
- APAC (Singapore) - Asia-Pacific customers

**Data Sovereignty:**
- Customer data stored in selected region
- No cross-region replication (unless requested)
- Backups stored in same region

## Security Best Practices

### For Administrators

1. **Enable MFA** for all users (required for Admin/Owner)
2. **Review audit logs weekly** for suspicious activity
3. **Rotate API keys quarterly** (automated reminder)
4. **Use restricted API keys** (scope to minimum required permissions)
5. **Regular access reviews** (quarterly user/role audit)

### For Developers

1. **Never commit API keys** to version control
2. **Use environment variables** for secrets
3. **Validate all user input** (XSS, SQL injection prevention)
4. **Implement rate limiting** on public endpoints
5. **Log security events** (failed auth, permission denied)

### For Users

1. **Use strong passwords** (min 12 characters, unique)
2. **Enable MFA** (TOTP preferred)
3. **Report suspicious emails** (phishing attempts)
4. **Don't share API keys** via email/Slack
5. **Review session activity** monthly

## Incident Response

### Security Incident Workflow

```
Incident detected (automated alert or user report)
        ↓
Security team notified (Slack + PagerDuty)
        ↓
Assess severity (P0: Critical, P1: High, P2: Medium, P3: Low)
        ↓
Contain threat (revoke keys, block IPs, disable accounts)
        ↓
Investigate root cause
        ↓
Remediate vulnerability
        ↓
Notify affected customers (if data breach)
        ↓
Post-mortem review (within 48 hours)
```

### Response Times

| Severity | Response Time | Resolution Target |
|----------|---------------|-------------------|
| P0 (Critical) | 15 minutes | 4 hours |
| P1 (High) | 1 hour | 24 hours |
| P2 (Medium) | 4 hours | 7 days |
| P3 (Low) | 24 hours | 30 days |

### Breach Notification

If a data breach affects >500 users or includes sensitive PII:
1. **Notify affected users** within 72 hours
2. **Report to authorities** (ICO for GDPR, state AGs for CCPA)
3. **Publish incident report** (public blog post)
4. **Offer credit monitoring** (if SSN/financial data exposed)

## Security Contacts

**Report a vulnerability:**
- **Email**: security@launchpulse.ai
- **PGP Key**: https://launchpulse.ai/.well-known/pgp-key.asc
- **Bug Bounty**: https://launchpulse.ai/security/bug-bounty

**Security Team:**
- **CISO**: security-ciso@launchpulse.ai
- **Security Engineer**: security-eng@launchpulse.ai
- **Compliance Officer**: compliance@launchpulse.ai

## Related Documentation

- [Data Model Schema](./Data_Model_Schema.md)
- [API Architecture](./API_Architecture.md)
- [Deployment Model](./Deployment_Model.md)
- [GDPR Compliance Guide](../03_Things_To_Know/GDPR_Compliance.md)

---

**Security Version:** 2.0  
**Last Audit:** 2025-11-01  
**Next Audit:** 2026-02-01  
**Certifications:** SOC 2 Type II (pending), GDPR Compliant
