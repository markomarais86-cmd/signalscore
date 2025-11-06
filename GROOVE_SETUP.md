# Groove Setup Guide

## Overview

Groove (formerly Groove for Salesforce) is a sales engagement and productivity platform built natively on Salesforce. This integration allows you to:
- Sync sales activities (emails, calls, tasks) tracked in Groove
- Monitor flow (sequence) enrollment and progression
- Track rep productivity and account engagement
- Calculate engagement scores for ICP analysis

**Use Case:** "See which high-fit accounts have active Groove flows and their engagement metrics"

**Why Groove?**
- **Native Salesforce integration:** Deep Salesforce sync out of the box
- **Flow automation:** Track automated and manual outreach sequences
- **Activity capture:** Automatic email and calendar sync
- **Revenue intelligence:** Connect activities to opportunities
- **Team collaboration:** Shared templates and best practices

---

## Prerequisites

### Required
- **Active Groove account** with API access
  - Professional or Enterprise plan required
  - API access enabled by Groove admin
- **Admin access** to create API keys or OAuth apps
- **Salesforce integration** (Groove requires Salesforce)
  - Groove syncs data through Salesforce
  - Need Salesforce Professional or higher

### Important Notes
- **Groove is tightly integrated with Salesforce**
- Most data flows through Salesforce sync
- Groove API provides additional engagement metrics
- Some features require both Salesforce + Groove APIs

### Verify Your Access
1. Log into Groove at `https://app.groove.co/`
2. Click **Settings** (gear icon)
3. Navigate to **Integrations** → **API**
4. If you don't see API settings, contact your Groove admin

---

## Step 1: Choose Authentication Method

Groove offers two authentication options:

### Option A: API Key (Recommended for Server-to-Server)
**Best for:** Background syncs, scheduled jobs, server integrations

**Pros:**
- Simpler setup
- No OAuth flow needed
- Doesn't expire
- Works for service accounts

**Cons:**
- User-specific (tied to one Groove user)
- Requires manual rotation for security
- Limited to that user's data access

### Option B: OAuth 2.0 (Recommended for User-Facing)
**Best for:** User-initiated connections, multi-user apps

**Pros:**
- More secure (tokens expire)
- User can revoke access
- Standard OAuth flow
- Supports multiple users

**Cons:**
- More complex setup
- Need to handle token refresh
- Requires OAuth callback endpoint

**Recommendation:** Use **API Key** for this integration (simpler, sufficient for background sync)

---

## Step 2A: Get Groove API Key (Recommended)

### Generate API Key
1. **Log into Groove** at https://app.groove.co/

2. **Navigate to API Settings:**
   - Click **Settings** (gear icon, top right)
   - Go to **Integrations**
   - Click **API** or **Developer**
   - Or navigate to: `/settings/integrations/api`

3. **Create API Key:**
   - Look for **"API Keys"** or **"Personal Access Tokens"** section
   - Click **"Generate New Key"** or **"Create Token"**
   - Name it: `ICP Signal Platform Integration`
   - Set permissions (if prompted):
     - ✅ Read activities
     - ✅ Read flows
     - ✅ Read people
     - ✅ Read accounts
   - Click **"Generate"**

4. **Copy Your API Key:**
   - Format: `gk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **IMPORTANT:** Copy immediately - you may not see it again
   - Store securely

### Add API Key to Your Application

**Via Application UI:**
1. **Settings** → **External Integrations** → **Groove**
2. Find **"API Key"** input field
3. Paste your Groove API key
4. Click **"Save"**
5. Click **"Test Connection"**
6. Status should show **"Connected ✓"**

**Via Supabase Secrets:**
1. [Supabase Dashboard](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/settings/functions)
2. **Edge Function Secrets**
3. Add secret:
   - **Name:** `GROOVE_API_KEY`
   - **Value:** Your Groove API key
   - **Save**

---

## Step 2B: Set Up OAuth (Alternative)

If you prefer OAuth authentication:

### Create OAuth Application in Groove
1. **Groove Settings** → **Integrations** → **API** → **OAuth Apps**

2. **Register New Application:**
   - **Name:** `ICP Signal Platform`
   - **Description:** `Sales activity and engagement tracking`
   - **Redirect URI:** `https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/oauth-callback`
   - **Scopes:**
     - `activities:read` - View activities
     - `flows:read` - View flows (sequences)
     - `people:read` - View contacts
     - `accounts:read` - View accounts

3. **Copy Credentials:**
   - **Client ID:** `xxxxxxxxx`
   - **Client Secret:** `yyyyyyyy`
   - Save securely

### Add OAuth Credentials
**Via Application UI:**
1. **Settings** → **Groove** → **OAuth Setup**
2. Enter Client ID and Client Secret
3. Click **"Authorize with Groove"**
4. Complete OAuth flow
5. Grant permissions
6. Redirected back with **"Connected ✓"**

**Via Supabase:**
- Add `GROOVE_CLIENT_ID` and `GROOVE_CLIENT_SECRET` secrets
- Complete OAuth flow in app UI

---

## Step 3: Configure Groove Integration

### Set Sync Preferences
1. **Settings** → **External Integrations** → **Groove**

2. **Configure Data to Sync:**

   **Activities:**
   - ✅ Emails (sent, opened, clicked, replied)
   - ✅ Calls (logged, duration, outcome)
   - ✅ Meetings (scheduled, completed)
   - ⚠️ Tasks (optional - can be noisy)

   **Flows (Sequences):**
   - ✅ Flow enrollment
   - ✅ Flow step progression
   - ✅ Flow completion
   - ✅ Flow exits

   **Sync Frequency:**
   - **Hourly:** Recommended
   - **Every 6 hours:** Medium volume
   - **Daily:** Low volume
   - **Manual:** On-demand only

   **Historical Data:**
   - Last 90 days (default)
   - Custom date range if needed

### Map Groove Data
1. **Settings** → **Groove** → **Field Mapping**

2. **Standard Mappings (Automatic):**
   - Groove Contact → Your Lead (by email)
   - Groove Account → Your Account (by Salesforce ID or domain)
   - Groove User (rep) → Your User (by email)

3. **Salesforce Integration:**
   - Since Groove syncs with Salesforce
   - Map Salesforce IDs to your records
   - Use Salesforce Account ID as key

### Enable Engagement Scoring
1. **Settings** → **Scoring** → **Groove Engagement**
2. Configure point values:
   - Email reply: +5
   - Meeting booked: +10
   - Meeting completed: +15
   - Call logged: +5
   - Flow step completed: +3
   - Flow completed (reached end): +20

---

## How the Integration Works

### 1. Activity Sync (Primary Use Case)
**Purpose:** Import sales activities from Groove

**How it works:**
1. **Scheduled job runs** (e.g., hourly)

2. **Fetch activities from Groove API:**
   ```
   GET https://api.groove.co/v1/activities
   ?updated_after=2024-01-15T00:00:00Z
   &limit=100
   ```

3. **Groove returns activities:**
   ```json
   {
     "activities": [
       {
         "id": "act_123",
         "type": "email",
         "action": "sent",
         "subject": "Quick question about your goals",
         "created_at": "2024-01-15T10:30:00Z",
         "person": {
           "id": "per_456",
           "email": "john@acmecorp.com",
           "salesforce_id": "00300000..."
         },
         "account": {
           "id": "acc_789",
           "name": "Acme Corp",
           "salesforce_id": "00100000..."
         },
         "user": {
           "id": "usr_101",
           "email": "rep@yourcompany.com"
         },
         "metadata": {
           "opened_at": "2024-01-15T10:45:00Z",
           "clicked_at": "2024-01-15T10:47:00Z",
           "replied_at": null
         }
       }
     ],
     "pagination": {
       "next": "https://api.groove.co/v1/activities?cursor=abc123"
     }
   }
   ```

4. **System processes activities:**
   - Match person to Lead (by email or Salesforce ID)
   - Match account to Account (by Salesforce ID or domain)
   - Create activity record in your database
   - Update engagement score

5. **Store in database:**
   ```sql
   INSERT INTO activities (
     account_id,
     lead_id,
     user_id,
     activity_type,
     activity_date,
     data_source,
     metadata
   ) VALUES (
     'account-uuid',
     'lead-uuid',
     'user-uuid',
     'email_sent',
     '2024-01-15T10:30:00Z',
     'groove',
     '{"subject": "...", "opened": true, "clicked": true}'
   );
   ```

### 2. Flow Enrollment Tracking
**Purpose:** See which contacts are in Groove flows (sequences)

**How it works:**
1. **Fetch flow memberships:**
   ```
   GET https://api.groove.co/v1/flow_memberships
   ?status=active
   ```

2. **Groove returns enrollments:**
   ```json
   {
     "flow_memberships": [
       {
         "id": "fm_123",
         "person_id": "per_456",
         "flow_id": "flw_789",
         "status": "active",
         "current_step": 3,
         "total_steps": 8,
         "enrolled_at": "2024-01-10T00:00:00Z",
         "flow": {
           "id": "flw_789",
           "name": "Enterprise Outbound - Discovery",
           "type": "email"
         }
       }
     ]
   }
   ```

3. **Update account status:**
   - Mark account as "In Flow"
   - Show flow name and progress (Step 3 of 8)
   - Display on account detail page
   - Track flow engagement (activities per step)

### 3. Integration with Salesforce Data
**Purpose:** Enrich Groove data with Salesforce context

**How it works:**
- Groove activities include Salesforce IDs
- Use Salesforce IDs to link to your Salesforce sync
- Get full account/contact context from Salesforce
- Combine Groove engagement + Salesforce firmographics

**Example:**
1. Groove activity has `salesforce_account_id: "001xxxx"`
2. Look up account in your database by Salesforce ID
3. If found, link activity to that account
4. Now you have both:
   - Groove engagement data (emails, calls)
   - Salesforce firmographic data (industry, size, revenue)

---

## API Rate Limits

### Groove Rate Limits
- **Rate limit:** 300 requests/minute per API key
- **Daily limit:** 50,000 requests/day per API key
- **Burst:** Up to 60 requests in 10 seconds

### Handling Rate Limits
- Built-in exponential backoff
- Automatic retry on 429 errors
- Pagination (100 records per page)
- Incremental sync (only new data)

**Monitor Usage:**
- Groove → Settings → API → Usage Dashboard
- Shows hourly/daily request counts

---

## Testing Your Integration

### Pre-Test Checklist
- [ ] API key or OAuth credentials added
- [ ] Connection test passed
- [ ] Salesforce integration also set up (if using)
- [ ] At least 1 activity in Groove

### Test 1: Connection Test
1. **Settings** → **Groove**
2. Click **"Test Connection"**
3. **Expected Result:**
   - ✅ "Groove connection successful"
   - Status: Green "Connected"
   - API key masked: `gk_***...***`
4. **If Failed:** See Troubleshooting

### Test 2: Sync Activities
1. **Log Activity in Groove:**
   - Send an email via Groove
   - Or log a call
   - Wait 1-2 minutes

2. **Trigger Sync:**
   - Settings → Groove → **"Sync Now"**

3. **Expected Result:**
   - "Syncing activities from Groove..."
   - "Synced 2 new activities"
   - Go to **Activities** page
   - See your test activity

4. **Verify Details:**
   - Correct activity type
   - Correct date/time
   - Linked to account and lead
   - Source: "Groove"

### Test 3: Flow Enrollment
1. **Add Contact to Flow in Groove:**
   - Select any active flow
   - Enroll a contact
   - Note the account

2. **Sync Flows:**
   - Settings → Groove → **"Sync Flows"**

3. **Expected Result:**
   - Account shows "In Flow: [Flow Name]"
   - Progress: "Step 1 of 8"
   - Enrollment date visible

### Test 4: Engagement Scoring
1. **Create Multiple Activities:**
   - 2 emails (1 replied)
   - 1 call (completed)
   - 1 meeting (scheduled)

2. **Sync:**
   - Settings → Groove → "Sync Now"

3. **Check Score:**
   - Account detail page
   - Engagement breakdown:
     - Email reply: +5
     - Call: +5
     - Meeting: +10
     - **Total: +20 points**

---

## Troubleshooting

### Error: "Invalid API Key"
**Symptoms:**
- Connection test fails
- 401 Unauthorized error

**Solutions:**
1. **Verify API key:**
   - Log into Groove
   - Settings → API
   - Check key is Active (not Revoked)
   - Copy again if needed

2. **Check format:**
   - Should start with `gk_`
   - No spaces or line breaks

3. **Regenerate:**
   - Revoke old key
   - Generate new key
   - Update in your app

### Error: "Rate Limit Exceeded"
**Symptoms:**
- 429 error
- "Too many requests" message

**Solutions:**
1. **System auto-retries** - Wait
2. **Reduce frequency:**
   - Change sync from hourly to every 6 hours
3. **Check usage:**
   - Groove dashboard → API usage
   - See if other apps using same key

### Error: "Account Not Found"
**Symptoms:**
- Activities synced but not linked
- "Could not match Groove account"

**Solutions:**
1. **Check Salesforce integration:**
   - Groove relies on Salesforce IDs
   - Ensure Salesforce sync is working
   - Verify Salesforce IDs in your database

2. **Fallback to domain matching:**
   - If Salesforce ID missing
   - Match by domain instead
   - Settings → Data Mapping → Enable domain fallback

3. **Manual matching:**
   - Settings → Data Mapping
   - Manually link Groove accounts to yours

### Error: "Webhook Not Configured"
**Note:** Groove may not support webhooks. Most integrations use polling (scheduled sync).

**Solutions:**
- Use scheduled sync (hourly recommended)
- Check Groove documentation for webhook availability
- Contact Groove support to confirm webhook support

---

## Best Practices

### 1. Sync Strategy
- **Hourly sync:** Recommended for most teams
- **Daily sync:** Sufficient for low activity volume
- **Combine with Salesforce sync:** Get full picture
- **Incremental only:** Only fetch new/updated data

### 2. Activity Filtering
**Focus on meaningful activities:**
- ✅ Email replies (high intent)
- ✅ Meetings (highest intent)
- ✅ Calls (medium intent)
- ⚠️ Email sends (low intent, optional)
- ❌ Tasks (too granular)

### 3. Salesforce Integration
**Leverage Groove's Salesforce connection:**
- Use Salesforce IDs for matching
- Get firmographic data from Salesforce
- Get engagement data from Groove
- Best of both worlds

### 4. Flow Intelligence
**Use flow data strategically:**
- Active flows = being worked by sales
- Completed flows = exhausted sequence
- High engagement flows = effective sequences
- Low engagement flows = refine messaging

### 5. Data Hygiene
**Keep Groove clean:**
- Archive old flows
- Remove test accounts
- Merge duplicate contacts
- Validate emails regularly

---

## Groove vs Outreach vs SalesLoft

| Feature | Groove | Outreach | SalesLoft |
|---------|--------|----------|-----------|
| **Salesforce Native** | ✅✅ Built-in | ⚠️ Requires sync | ⚠️ Requires sync |
| **Setup Complexity** | ⚠️ Medium (needs SF) | ✅ Easy | ✅ Easy |
| **API Maturity** | ⚠️ Newer | ✅✅ Excellent | ✅✅ Excellent |
| **Flow/Sequence** | ✅ Flows | ✅ Sequences | ✅ Cadences |
| **Activity Tracking** | ✅ Good | ✅✅ Excellent | ✅✅ Excellent |
| **Best For** | Salesforce-heavy orgs | Standalone or multi-CRM | Enterprise teams |

**If you use Salesforce:** Groove is a great choice (native integration)
**If not using Salesforce:** Consider Outreach or SalesLoft instead

---

## Additional Resources

### Groove Documentation
- [Groove API Docs](https://docs.groove.co/api/)
- [Authentication Guide](https://docs.groove.co/api/authentication)
- [Activities API](https://docs.groove.co/api/activities)
- [Flows API](https://docs.groove.co/api/flows)

### Internal Documentation
- [Master Integration Guide](./MASTER_INTEGRATION_GUIDE.md)
- [Salesforce Setup](./SALESFORCE_OAUTH_SETUP.md) - Required for Groove
- [Outreach Setup](./OUTREACH_SETUP.md) - Alternative
- [SalesLoft Setup](./SALESLOFT_SETUP.md) - Alternative

### Support
- **Groove Support:** support@groove.co
- **Help Center:** https://help.groove.co/
- **API Support:** Open ticket in Groove dashboard
- **Application Support:** Settings → Integration Health

---

## Success Checklist

After setup, you should be able to:
- [ ] Connect to Groove with API key or OAuth
- [ ] Sync email, call, meeting activities
- [ ] View activities on account pages
- [ ] Track flow enrollments and progression
- [ ] Calculate engagement scores from activities
- [ ] Link Groove data to Salesforce records
- [ ] Monitor sync health
- [ ] Identify accounts with high engagement

---

## Next Steps

1. **Verify Salesforce Integration** - Groove depends on Salesforce
2. **Configure Engagement Scoring** - Settings → Scoring
3. **Set Up Scheduled Sync** - [CRON Setup](./CRON_SETUP_INSTRUCTIONS.md)
4. **Create Activity Reports** - Flow performance, rep activity
5. **Enable Alerts** - High-fit account activity notifications

---

**Last Updated:** 2025-11-06  
**Version:** 1.0  
**Maintained By:** Integration Team
