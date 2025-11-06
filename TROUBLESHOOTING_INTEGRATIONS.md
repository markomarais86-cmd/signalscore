# Integration Troubleshooting Guide

## Overview

This guide provides solutions to common issues across all 11 integrations. For integration-specific troubleshooting, see individual setup guides.

**Version:** 1.0  
**Last Updated:** 2025-11-06

---

## Table of Contents

1. [General Troubleshooting](#general-troubleshooting)
2. [CRM Integration Issues](#crm-integration-issues)
3. [Data Enrichment Issues](#data-enrichment-issues)
4. [Sales Engagement Issues](#sales-engagement-issues)
5. [Forecasting Integration Issues](#forecasting-integration-issues)
6. [Cross-Platform Issues](#cross-platform-issues)
7. [Debugging Tools](#debugging-tools)

---

## General Troubleshooting

### Issue: "Connection Test Failed" for Any Integration

**Symptoms:**
- Test connection button shows error
- "Unable to connect" or "Connection timed out"
- 401/403 errors

**Root Causes & Solutions:**

**1. Invalid or Expired Credentials**
```
✅ Solution:
- Go to integration settings
- Click "View Credentials" (shows masked version)
- Re-enter or regenerate credentials
- For OAuth: Click "Reconnect" and re-authorize
- For API Keys: Generate new key and update
```

**2. Credentials Not Saved in Supabase**
```
✅ Solution:
- Go to Supabase Dashboard → Edge Function Secrets
- Verify secret exists (e.g., `SALESFORCE_CLIENT_ID`)
- If missing, add the secret
- Format:
  - Name: Exact name from setup guide
  - Value: Your actual credential (no spaces)
```

**3. Network/Firewall Issues**
```
✅ Solution:
- Check Supabase Edge Functions have outbound access
- Verify no corporate firewall blocking API calls
- Test API endpoint directly with curl:
  curl -H "Authorization: Bearer YOUR_KEY" https://api.provider.com/test
- If curl works but app doesn't: Issue is in edge function
```

**4. Incorrect Subdomain/Domain**
```
✅ Solution (for providers with subdomains):
- Salesforce: Verify correct instance (na1, eu1, etc.)
- Outreach: Verify subdomain: yourcompany.outreach.io
- Gong: Verify subdomain: yourcompany.gong.io
- Clari: Verify subdomain: yourcompany.clari.com
```

---

### Issue: "Rate Limit Exceeded" Across Multiple Integrations

**Symptoms:**
- 429 errors in logs
- Sync slows down dramatically
- "Too many requests" messages

**Root Causes & Solutions:**

**1. Multiple Syncs Running Simultaneously**
```
✅ Solution:
- Check Integration Health dashboard
- Look for multiple jobs with status "Running"
- Cancel duplicate jobs
- Schedule syncs at different times:
  - CRM sync: Top of hour (:00)
  - Enrichment: Quarter past (:15)
  - Sales engagement: Half past (:30)
  - Forecasting: Quarter to (:45)
```

**2. Sync Frequency Too High**
```
✅ Solution:
- Reduce sync frequency:
  - Hourly → Every 6 hours
  - Every 6 hours → Daily
  - Daily → Weekly
- Most data doesn't need real-time sync
- Use webhooks for real-time when available
```

**3. Batch Size Too Large**
```
✅ Solution:
- Reduce batch size in sync settings
- Default 100 → Reduce to 50 or 25
- Slower but stays under rate limits
- Edge function: Look for batch_size parameter
```

**4. Approaching Provider Limits**
```
✅ Solution:
- Check usage in provider dashboard
- Salesforce: Setup → System Overview → API Usage
- HubSpot: Settings → Billing → API Limit
- ZoomInfo/Apollo/etc.: Dashboard → Usage
- Contact provider to increase limits if needed
```

---

### Issue: "Sync Completed But No Data Imported"

**Symptoms:**
- Sync job shows "Completed" status
- But accounts/leads table unchanged
- No errors in logs

**Root Causes & Solutions:**

**1. Date Filter Too Restrictive**
```
✅ Solution:
- Check sync date range
- Settings → [Integration] → Date Filter
- Expand range: Last 7 days → Last 90 days
- Or: Remove date filter for initial sync
```

**2. No Data Matches Filters**
```
✅ Solution:
- Review any filters applied to sync
- Example: "Only sync accounts in USA"
- But all your accounts are in UK
- Remove filters temporarily to test
- Re-apply filters once you see data flowing
```

**3. Data Already Exists (Dedupe Working)**
```
✅ Solution:
- This is actually GOOD - prevents duplicates
- Check if accounts already exist:
  SELECT * FROM accounts WHERE data_source = 'crm' LIMIT 10;
- System may be deduping by domain or external_id
- Force re-import: Delete test account, then sync again
```

**4. RLS Policy Blocking Inserts**
```
✅ Solution:
- Check RLS policies on accounts/leads tables
- Supabase Dashboard → Database → Tables → RLS
- Verify org_id is set correctly
- Check edge function is setting org_id on insert
```

---

## CRM Integration Issues

### Salesforce-Specific Issues

#### Error: "Invalid Grant" During OAuth
```
Symptom: OAuth redirect fails with "invalid_grant"

✅ Solutions:
1. Check Redirect URI in Connected App:
   - Must match EXACTLY: https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/oauth-callback
   - No trailing slash
   - https not http

2. Verify IP Restrictions:
   - Salesforce Setup → Connected App → Relax IP Restrictions
   - Set to "Relax IP restrictions" for now
   - Later: Add Supabase IP ranges

3. Check OAuth Policies:
   - Salesforce Setup → Session Settings
   - "Enable clickjack protection" → Disable temporarily
   - "Enable HTTPS requirement" → Ensure enabled

4. Regenerate Credentials:
   - Salesforce Setup → Connected App → Edit
   - Manage Consumer Details → Reset Secret
   - Update in your app

5. User Permissions:
   - User doing OAuth must have "API Enabled" permission
   - Profile → System Permissions → API Enabled ✓
```

#### Error: "Insufficient Privileges" During Sync
```
Symptom: OAuth works but sync fails with permission errors

✅ Solutions:
1. Check Profile Permissions:
   - User needs Read access to:
     - Accounts
     - Contacts
     - Opportunities
     - Custom objects you're syncing
   
2. Field-Level Security:
   - User needs Read access to all fields being synced
   - Setup → Object Manager → [Object] → Fields → Set FLS

3. Org-Wide Defaults:
   - Accounts/Contacts set to "Public Read/Write" or
   - User has "View All" permission on these objects

4. Connected App Scope:
   - Ensure these scopes selected:
     - api
     - refresh_token
     - offline_access
     - full (if writing back to Salesforce)
```

#### Webhooks Not Received
```
Symptom: Set up Outbound Messages but no webhooks arrive

✅ Solutions:
1. Check Workflow Rule:
   - Salesforce Setup → Workflow Rules
   - Verify rule is ACTIVE
   - Check evaluation criteria (every time vs. created only)
   - Test: Edit a record, see if webhook fires

2. Remote Site Settings:
   - Setup → Remote Site Settings
   - Add: https://dhyfbaptcprxxixgnpby.supabase.co
   - Mark as Active

3. Check Outbound Message Delivery:
   - Setup → Monitoring → Outbound Messages
   - Find your message
   - Check "Delivery Status"
   - If failed, see error message

4. Test Webhook Endpoint:
   curl -X POST https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/salesforce-webhook \
     -H "Content-Type: application/xml" \
     -d '<?xml version="1.0"?><soapenv:Envelope>...</soapenv:Envelope>'
   
   Should return 200 OK

5. Check Edge Function Logs:
   - Supabase → Functions → salesforce-webhook → Logs
   - Look for incoming requests
   - Check for parsing errors
```

---

### HubSpot-Specific Issues

#### Error: "Missing Required Scopes"
```
Symptom: OAuth or API calls fail with scope errors

✅ Solutions:
1. Private App Scopes:
   - HubSpot Settings → Integrations → Private Apps
   - Edit your app
   - Ensure these scopes checked:
     ✓ crm.objects.companies.read
     ✓ crm.objects.companies.write
     ✓ crm.objects.contacts.read
     ✓ crm.objects.contacts.write
     ✓ crm.objects.deals.read
     ✓ crm.objects.deals.write
   - Save

2. OAuth App Scopes:
   - Similar to above but in OAuth app settings
   - User must approve all scopes during OAuth

3. Regenerate Token:
   - After adding scopes, regenerate token
   - HubSpot Apps → Private Apps → [Your App] → Regenerate
   - Update token in your app
```

#### Rate Limit Exceeded (HubSpot)
```
Symptom: 429 errors, "daily limit exceeded"

HubSpot Limits:
- Professional: 500,000/day
- Enterprise: 1,000,000/day
- Per-second: 100 requests/10 seconds

✅ Solutions:
1. Reduce Sync Frequency:
   - Change from hourly to every 6 hours or daily
   - HubSpot data doesn't change that fast

2. Optimize API Calls:
   - Use batch endpoints where available
   - Request only needed properties
   - Use pagination wisely (max 100 per page)

3. Contact HubSpot:
   - Request limit increase
   - enterprise@hubspot.com
   - Explain use case

4. Monitor Usage:
   - HubSpot Dashboard → Settings → Billing → API Limit
   - See daily usage and trends
```

---

## Data Enrichment Issues

### Common Enrichment Issues (All Providers)

#### No Data Returned (404) for Many Companies
```
Symptom: Enrichment runs but most companies return "Not Found"

This is NORMAL for some companies. Coverage varies:

Provider Coverage:
- ZoomInfo: 80-90% for US companies 1000+ employees, 40-60% for SMBs
- Apollo: 70-85% for SMBs, 60-70% for enterprises
- Clearbit: 60-75% global coverage
- PDL: 85% for people, 60% for companies

✅ Solutions:
1. Verify Domains Correct:
   - Check domain format: "acmecorp.com" not "www.acmecorp.com"
   - No http:// or https://
   - No trailing slashes
   - Correct TLD (.com vs .io vs .co.uk)

2. Use Waterfall Enrichment:
   - Enable multiple providers
   - Try ZoomInfo → Apollo → Clearbit → PDL
   - Increases coverage to 90-95%

3. Check Company Eligibility:
   - Very small companies (<10 employees): Limited coverage
   - Very new companies (<6 months): Not yet indexed
   - Non-B2B companies: Often not in B2B databases
   - Stealth startups: Intentionally hidden

4. Accept Some Will Fail:
   - 5-15% failure rate is normal
   - Focus enrichment on high-priority accounts
   - Manually research critical accounts
```

#### Credits Exhausted Mid-Job
```
Symptom: Enrichment stops halfway, "insufficient credits"

✅ Solutions:
1. Check Credit Balance:
   - Provider dashboard → Billing → Credits
   - See remaining credits and reset date

2. Set Monthly Limits:
   - Settings → Data Enrichment → [Provider] → Advanced
   - Set "Monthly limit" to 90% of plan quota
   - System stops before overage

3. Prioritize High-Fit Accounts:
   - Only enrich accounts with ICP score > 60
   - Settings → Enrichment → Enable "High-fit only"
   - Saves credits for accounts that matter

4. Buy Credits or Upgrade:
   - Most providers sell credit packs
   - Or upgrade to higher tier plan
   - Consider annual plans for discount

5. Pause Low-Priority Enrichment:
   - Disable auto-enrichment temporarily
   - Manual-only enrichment for high-value accounts
   - Resume when credits reset
```

---

### ZoomInfo-Specific Issues

#### Error: "Invalid API Key"
```
✅ Solutions:
1. Regenerate Key:
   - ZoomInfo → Admin → API Management
   - Revoke old key
   - Create new key
   - Update in app within 5 minutes

2. Check Key Format:
   - Should be JWT-style: eyJhbGci...
   - Very long (~500+ characters)
   - If short, you copied wrong value

3. Verify Subscription:
   - ZoomInfo dashboard → Check subscription status
   - API access requires Professional or higher
   - Contact ZoomInfo CSM if API not enabled
```

---

### Apollo-Specific Issues

#### Error: "Quota Exceeded" (Apollo)
```
Apollo Limits by Plan:
- Free: 60 credits/month
- Basic: 120 credits/month
- Professional: 600 credits/month

✅ Solutions:
1. Check Usage:
   - Apollo Dashboard → Settings → Billing
   - See credits used this month

2. Upgrade Plan:
   - Free → Basic ($49/mo)
   - Basic → Professional ($99/mo)
   - Professional → Organization (custom)

3. Use Apollo Strategically:
   - Only for SMBs (10-200 employees)
   - Use ZoomInfo for larger companies
   - Saves Apollo credits
```

---

## Sales Engagement Issues

### Outreach/SalesLoft/Groove Common Issues

#### Activities Synced But Not Linked to Accounts
```
Symptom: Activities appear in database but account_id is null

✅ Solutions:
1. Check Domain Matching:
   - Outreach participant email: john@acmecorp.com
   - Extract domain: acmecorp.com
   - Match to account: SELECT * FROM accounts WHERE domain = 'acmecorp.com'
   - If no match, account_id = null

2. Enable Salesforce ID Matching:
   - If using Salesforce + sales engagement
   - Match by Salesforce Account ID instead of domain
   - More reliable

3. Manual Account Matching:
   - Settings → Data Mapping → Manual Matches
   - Link sales engagement accounts to your accounts
   - One-time setup

4. Create Missing Accounts:
   - If company exists in sales engagement but not CRM
   - Create account in CRM first
   - Then sync sales engagement
```

---

## Forecasting Integration Issues

### Gong-Specific Issues

#### Calls Not Syncing
```
Symptom: Gong connection works but no calls imported

✅ Solutions:
1. Check Call Processing Time:
   - Gong takes 1-2 hours to process calls after they end
   - Sync again 2+ hours after calls
   - Or set sync time to 3 AM (all calls processed overnight)

2. Verify Technical User Permissions:
   - Gong Settings → Users → [Technical User]
   - Needs access to:
     ✓ All workspaces
     ✓ All calls
     ✓ View transcripts

3. Check Date Range:
   - Calls only returned for date range queried
   - Expand sync range: Last 7 days → Last 30 days

4. Private/Restricted Calls:
   - Some calls may be marked private
   - Technical user can't see private calls
   - Check Gong privacy settings
```

---

### Clari-Specific Issues

#### Forecast Data Stale
```
Symptom: Forecast numbers don't match Clari UI

✅ Solutions:
1. Clari Updates Overnight:
   - Forecast refreshes around midnight PST
   - Sync after 6 AM PST for latest data
   - Schedule sync: Daily at 7 AM PST

2. Check Last Sync Time:
   - Settings → Clari → "Last synced: 2 days ago"
   - If > 24 hours, trigger manual sync
   - Verify cron job running correctly

3. Verify Sync Includes Current Quarter:
   - Edge function may be filtering old quarters
   - Check: GET /v4/forecasts/current
   - Ensure "current" forecast being fetched
```

---

## Cross-Platform Issues

### Issue: Data Conflicts Between Systems

**Scenario:** Salesforce says account is in Boston, ZoomInfo says San Francisco

**Solution:**
```
Data Source Priority (Recommended):
1. CRM data (most recent, manually verified)
2. Enrichment data (if CRM field is empty)
3. Never overwrite CRM data with enrichment

Implementation:
- Only enrich if field is null:
  UPDATE accounts 
  SET city = enrichment_data.city 
  WHERE city IS NULL;

- Track data source:
  UPDATE accounts 
  SET 
    city = enrichment_data.city,
    city_source = 'zoominfo',
    city_updated_at = NOW()
  WHERE city IS NULL;
```

---

### Issue: Duplicate Accounts from Multiple Sources

**Scenario:** Account exists in Salesforce AND from enrichment provider

**Solution:**
```
Deduplication Strategy:

1. Use external_id as Primary Key:
   - CRM accounts: external_id = Salesforce ID
   - Enriched accounts: external_id = domain
   - INSERT ... ON CONFLICT (external_id) DO UPDATE

2. Unique Constraint:
   ALTER TABLE accounts 
   ADD CONSTRAINT accounts_org_domain_unique 
   UNIQUE (org_id, domain);

3. Merge Logic:
   - CRM data takes precedence
   - Enrichment fills in blanks
   - Never overwrite CRM with enrichment

4. Mark Data Source:
   - data_source = 'crm' or 'enrichment'
   - enriched_from = provider name
   - enriched_at = timestamp
```

---

## Debugging Tools

### 1. Integration Health Dashboard
**Location:** Settings → Integration Health

**What to Check:**
- ✅ Connection status (green = good)
- ✅ Last sync time (< 24 hours = good)
- ✅ Success rate (> 95% = good)
- ✅ Error count (< 5% = acceptable)
- ❌ Any "Disconnected" status
- ❌ Last sync > 7 days ago
- ❌ Success rate < 80%

### 2. Edge Function Logs
**Location:** Supabase Dashboard → Functions → [Function Name] → Logs

**How to Use:**
```
1. Navigate to function:
   - salesforce-sync
   - enrichment-waterfall
   - outreach-webhook
   - etc.

2. Filter logs:
   - Time range: Last hour / Last 24 hours
   - Search: "error" or "failed"
   - Level: Error / Warning

3. Look for:
   - "401 Unauthorized" → Credentials issue
   - "429 Rate Limit" → Too many requests
   - "404 Not Found" → Wrong endpoint or data doesn't exist
   - "500 Server Error" → Provider having issues
   - Stack traces → Code bugs

4. Common Patterns:
   - Repeated 401s → Refresh token expired
   - Intermittent 503s → Provider API down temporarily
   - Timeout errors → Increase function timeout
```

### 3. Webhook Activity Viewer
**Location:** Settings → External Integrations → Webhook Activity

**What to Check:**
- Recent webhook events (last 100)
- Delivery status: Success / Failed / Pending
- Response time (should be < 2 seconds)
- Error messages for failed deliveries

**Common Issues:**
```
❌ No webhooks received:
   - Check webhook URL in provider
   - Verify endpoint is public (not behind auth)

❌ All webhooks failing:
   - Check edge function logs for errors
   - Test endpoint with curl

❌ Some webhooks failing:
   - Check payload format
   - May be edge case not handled
```

### 4. Database Query Tools
**Location:** Supabase Dashboard → SQL Editor

**Useful Queries:**

```sql
-- Check recent syncs
SELECT 
  integration_config_id,
  status,
  records_processed,
  records_failed,
  started_at,
  completed_at
FROM integration_sync_logs
ORDER BY started_at DESC
LIMIT 20;

-- Find accounts with enrichment failures
SELECT 
  name,
  domain,
  enriched_from,
  enriched_at
FROM accounts
WHERE enriched_from IS NULL
  AND domain IS NOT NULL
ORDER BY created_at DESC
LIMIT 50;

-- Check for duplicate accounts
SELECT domain, COUNT(*)
FROM accounts
WHERE org_id = 'your-org-id'
GROUP BY domain
HAVING COUNT(*) > 1;

-- Find orphaned activities (not linked to accounts)
SELECT COUNT(*)
FROM activities
WHERE account_id IS NULL
  AND data_source = 'outreach';
```

### 5. API Testing Tools

**Test Provider APIs Directly:**
```bash
# Test ZoomInfo
curl -X GET 'https://api.zoominfo.com/search/company' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d '{"companyName": "Acme Corp"}'

# Test Apollo
curl -X POST 'https://api.apollo.io/v1/organizations/search' \
  -H 'Content-Type: application/json' \
  -H 'X-Api-Key: YOUR_API_KEY' \
  -d '{"page": 1, "per_page": 10}'

# Test Salesforce
curl -X GET 'https://yourinstance.salesforce.com/services/data/v58.0/sobjects/Account' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

**If direct API works but integration doesn't:**
- Issue is in edge function code
- Check edge function logs
- Verify credentials in Supabase secrets match what works in curl

---

## Still Having Issues?

### Escalation Path

**Level 1: Self-Service (Try First)**
1. Check this troubleshooting guide
2. Review integration-specific setup guide
3. Check Integration Health dashboard
4. Review edge function logs

**Level 2: Community Support**
1. Search existing issues on GitHub/forum
2. Post question with:
   - Integration name
   - Error message
   - Steps taken so far
   - Edge function logs (sanitize credentials!)

**Level 3: Technical Support**
1. Settings → Integration Health → "Report Issue"
2. Include:
   - Integration name
   - Organization ID
   - Timestamp of issue
   - Edge function logs
   - Steps to reproduce
3. Support team will investigate edge functions and database

---

**Last Updated:** 2025-11-06  
**Version:** 1.0  
**Maintained By:** Integration Team
