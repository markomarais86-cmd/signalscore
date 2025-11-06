# Gong Setup Guide

## Overview

Gong is a Revenue Intelligence platform that captures and analyzes customer interactions (calls, meetings, emails) to provide insights into deals, coaching opportunities, and revenue risks. This integration allows you to:
- Import call and meeting data for account engagement tracking
- Access conversation insights and sentiment analysis
- Track deal intelligence and risk signals
- Calculate engagement scores based on call activity
- Identify champion relationships and stakeholder engagement

**Use Case:** "Show me which high-fit accounts have had recent discovery calls and their sentiment trends"

**Why Gong?**
- **Conversation intelligence:** AI-powered call analysis
- **Deal insights:** Risk signals, next steps, competitive mentions
- **Relationship mapping:** Identify champions, blockers, decision-makers
- **Coaching intelligence:** Rep performance and best practices
- **Revenue insights:** Pipeline health and forecast accuracy

---

## Prerequisites

### Required
- **Active Gong subscription** with API access
  - Professional or Enterprise plan (API included)
  - Elite plan for advanced features
- **Admin access** to create technical users and API credentials
- **CRM integration** (Salesforce or HubSpot)
  - Gong syncs opportunity data from your CRM
  - Needed to link calls to accounts/deals

### Verify Your Access
1. Log into Gong at `https://app.gong.io/`
2. Click **Settings** (gear icon, bottom left)
3. Navigate to **Company Settings** → **API**
4. If you don't see API settings, contact your Gong admin
5. Verify your plan includes API access (Professional or higher)

---

## Step 1: Create API Credentials in Gong

Gong uses **API Key + Access Key Secret** for authentication (not standard OAuth).

### Create Technical User (Recommended)
1. **Navigate to Users:**
   - Gong Settings → **Ecosystem** → **Users**
   - Or go to: `/settings/users`

2. **Add Technical User:**
   - Click **"+ Add Users"**
   - Email: `api-integration@yourcompany.com` (or similar)
   - First name: `API`
   - Last name: `Integration`
   - Role: **Technical User** (specifically for API access)
   - **IMPORTANT:** Select "Technical User" role, not regular user

3. **Assign Permissions:**
   - **Workspace:** All workspaces (or specific ones you want to sync)
   - **Call Access:** All calls (or filtered by team/tags)
   - **Features:**
     - ✅ View all calls
     - ✅ View call transcripts
     - ✅ View users
     - ✅ View deals
     - ✅ View accounts

4. **Save and note the user ID**

### Generate API Credentials
1. **Navigate to API Settings:**
   - Settings → **Company Settings** → **API**
   - Or go to: `/settings/api`

2. **Create New API Key:**
   - Click **"Create"** or **"+ New API Key"**
   - **Name:** `ICP Signal Platform Integration`
   - **Description:** `Integration for call data and deal insights`
   - **User:** Select the technical user you just created
   - **Scopes/Permissions:**
     - ✅ `api:calls:read:basic` - Read call metadata
     - ✅ `api:calls:read:extensive` - Read transcripts and insights
     - ✅ `api:calls:read:transcript` - Access call transcripts
     - ✅ `api:users:read` - Read user information
     - ✅ `api:crm:read` - Read CRM data (accounts, opportunities)
     - ✅ `api:stats:read` - Read analytics and stats
   
3. **Generate Credentials:**
   - Click **"Create"**
   - Gong will display:
     - **Access Key:** `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (UUID format)
     - **Access Key Secret:** `yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy` (UUID format)
   
4. **Copy Credentials Immediately:**
   - **CRITICAL:** The Access Key Secret is shown only once
   - Copy both Access Key and Secret
   - Store securely (you'll need both for authentication)
   - If you lose the secret, you'll need to regenerate

### Note Your Gong Instance URL
- Your Gong URL format: `https://yourcompany.gong.io/`
- API base URL will be: `https://yourcompany.api.gong.io/`
- Note your company subdomain (e.g., `yourcompany`)

---

## Step 2: Add API Credentials to Your Application

### Option A: Via Application UI (Recommended)
1. **Navigate to Settings**
   - In your application, click **Settings** (left sidebar)
   - Go to **External Integrations** tab

2. **Find Gong Section**
   - Scroll to **"Gong"** card
   - Click **"Connect"**

3. **Enter API Credentials:**
   - **Access Key:** Paste the Access Key from Gong
   - **Access Key Secret:** Paste the Secret from Gong
   - **Gong Domain:** Enter your subdomain (e.g., `yourcompany`)
     - Just the subdomain, NOT the full URL
     - Example: If your URL is `acme.gong.io`, enter `acme`
   - Click **"Save"**

4. **Test Connection:**
   - Click **"Test Connection"**
   - Should show: **"Connected ✓"**
   - Displays: API key status, permission scopes

### Option B: Via Supabase Secrets (Manual)
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/settings/functions)
2. Click **"Edge Function Secrets"**
3. Add these secrets:
   
   **Secret 1:**
   - **Name:** `GONG_ACCESS_KEY`
   - **Value:** Your Gong Access Key
   - Click "Save"
   
   **Secret 2:**
   - **Name:** `GONG_ACCESS_KEY_SECRET`
   - **Value:** Your Gong Access Key Secret
   - Click "Save"

4. Test connection via application UI (Step 2A, point 4)

---

## Step 3: Configure Gong Integration

### Set Sync Preferences
1. **Settings** → **External Integrations** → **Gong**

2. **Configure Data to Import:**

   **Call Data:**
   - ✅ Call metadata (date, duration, participants)
   - ✅ Call purpose/type (discovery, demo, negotiation, etc.)
   - ✅ Call outcomes (next steps, action items)
   - ⚠️ Call transcripts (optional - uses more storage)
   - ⚠️ Call recordings (optional - very large files)

   **Insights & Intelligence:**
   - ✅ Sentiment analysis (positive, neutral, negative)
   - ✅ Topic tracking (pricing, competition, features discussed)
   - ✅ Talk ratio (customer talk time vs rep talk time)
   - ✅ Engagement score (questions, monologues, interactivity)
   - ✅ Risk signals (competitor mentions, stalled deals)

   **Deal Intelligence:**
   - ✅ Deal stage from CRM
   - ✅ Next steps identified in calls
   - ✅ Champion mentions
   - ✅ Decision criteria discussed

   **Sync Frequency:**
   - **Daily:** Recommended (calls are analyzed overnight)
   - **Every 12 hours:** For very active teams
   - **Weekly:** Minimum recommended
   - **Manual:** On-demand only

   **Historical Data:**
   - Last 90 days (default)
   - Last 180 days (for trend analysis)
   - All time (initial setup - can take hours)

### Map Gong Data to Your Schema
1. **Settings** → **Gong** → **Field Mapping**

2. **Standard Mappings (Automatic):**
   - Gong Call → Your Activity (type: call)
   - Gong Party (participant) → Your Lead (by email)
   - Gong Opportunity → Your Opportunity (by CRM ID)
   - Gong Account → Your Account (by CRM Account ID or domain)

3. **Participant Role Mapping:**
   - Map Gong participant roles to your schema
   - Internal (your reps) → Users
   - External (customers) → Leads/Contacts
   - Identify champions, decision-makers, users

### Enable Call-Based Engagement Scoring
1. **Settings** → **Scoring** → **Gong Call Signals**

2. **Configure Point Values:**
   - **Discovery call completed:** +10 points
   - **Demo call completed:** +15 points
   - **Pricing discussion:** +20 points (high intent)
   - **Champion identified:** +10 points
   - **Decision-maker on call:** +15 points
   - **Positive sentiment:** +5 points
   - **Competitive mention (handled well):** +3 points
   - **Risk signal (objections):** -5 points
   - **Negative sentiment:** -10 points

3. **Call Recency Weighting:**
   - Calls < 30 days: 100% weight
   - Calls 30-60 days: 75% weight
   - Calls 60-90 days: 50% weight
   - Calls > 90 days: 25% weight

---

## How the Integration Works

### 1. Authentication
**Purpose:** Authenticate API requests to Gong

**How it works:**
- Gong uses Basic Authentication with Access Key + Secret
- Every API request includes:
  ```
  Authorization: Basic base64(access_key:access_key_secret)
  ```
- Example:
  ```bash
  curl -X GET 'https://yourcompany.api.gong.io/v2/calls' \
    -u 'access_key:access_key_secret'
  ```

**Security:**
- Credentials stored encrypted in database
- Never exposed to frontend
- Only used in edge functions (server-side)

### 2. Call Data Sync
**Purpose:** Import call metadata and insights

**How it works:**
1. **Scheduled Job Runs** (e.g., daily at 2 AM)

2. **Fetch Calls from Gong:**
   ```
   GET https://yourcompany.api.gong.io/v2/calls
   ?fromDateTime=2024-01-15T00:00:00Z
   &toDateTime=2024-01-16T00:00:00Z
   ```

3. **Gong Returns Call Data:**
   ```json
   {
     "calls": [
       {
         "id": "123456789",
         "url": "https://yourcompany.gong.io/call?id=123456789",
         "title": "Discovery Call - Acme Corp",
         "scheduled": "2024-01-15T10:00:00Z",
         "started": "2024-01-15T10:02:30Z",
         "duration": 3600,
         "primaryUserId": "user-001",
         "direction": "Outbound",
         "system": "Zoom",
         "purpose": "Discovery",
         "meetingUrl": "https://zoom.us/j/123456",
         "parties": [
           {
             "id": "party-001",
             "emailAddress": "john@acmecorp.com",
             "name": "John Smith",
             "title": "VP of Sales",
             "affiliation": "External",
             "methods": ["Web"],
             "speakerId": "speaker-001"
           },
           {
             "id": "party-002",
             "emailAddress": "rep@yourcompany.com",
             "name": "Sales Rep",
             "affiliation": "Internal",
             "userId": "user-001"
           }
         ],
         "content": {
           "topics": [
             {"name": "Pricing", "duration": 450},
             {"name": "Implementation", "duration": 600},
             {"name": "Competition", "duration": 120}
           ],
           "trackers": [
             {"name": "Next Steps", "count": 3},
             {"name": "Pricing Discussion", "count": 1},
             {"name": "Champion Identified", "count": 1}
           ]
         }
       }
     ],
     "records": {
       "totalRecords": 1,
       "currentPageSize": 1,
       "currentPageNumber": 1
     }
   }
   ```

4. **Fetch Call Details (if needed):**
   ```
   GET https://yourcompany.api.gong.io/v2/calls/{callId}
   ```
   Returns:
   - Full transcript
   - Speaker analytics (talk time, monologues, questions)
   - Sentiment by speaker
   - Action items identified
   - Keywords and topics

5. **Process Each Call:**
   - Match parties (participants) to Leads (by email)
   - Match to Account (via CRM opportunity or domain)
   - Extract insights (topics, sentiment, next steps)
   - Create activity record

6. **Store in Database:**
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
     'discovery_call',
     '2024-01-15T10:00:00Z',
     'gong',
     '{
       "duration": 3600,
       "sentiment": "positive",
       "topics": ["Pricing", "Implementation"],
       "champions": ["John Smith"],
       "next_steps": ["Send proposal", "Schedule demo"],
       "gong_call_url": "https://..."
     }'
   );
   ```

### 3. Deal Intelligence Sync
**Purpose:** Import deal-level insights from Gong

**How it works:**
1. **Fetch Deal Data:**
   ```
   GET https://yourcompany.api.gong.io/v2/stats/activity/aggregate
   ?filter.opportunityId=opp-123
   ```

2. **Gong Returns Deal Insights:**
   ```json
   {
     "opportunityId": "opp-123",
     "accountId": "acc-456",
     "stats": {
       "callsCount": 8,
       "emailsCount": 23,
       "meetingsCount": 5,
       "averageSentiment": 0.72,
       "championsIdentified": 2,
       "decisionMakersEngaged": 1,
       "competitorMentions": ["Competitor A"],
       "riskSignals": [
         {"type": "stalled", "severity": "medium"},
         {"type": "budget_concerns", "severity": "low"}
       ],
       "nextSteps": [
         "Schedule executive sponsor meeting",
         "Send security questionnaire"
       ]
     }
   }
   ```

3. **Update Opportunity:**
   - Add Gong insights to opportunity record
   - Calculate engagement score
   - Flag risks
   - Identify champions

### 4. Relationship Mapping
**Purpose:** Identify key stakeholders and their roles

**How it works:**
1. **Analyze Call Participants:**
   - Track who from customer side is on calls
   - Identify roles (decision-maker, champion, user, blocker)
   - Track engagement frequency

2. **Build Relationship Map:**
   ```json
   {
     "account_id": "acc-456",
     "stakeholders": [
       {
         "name": "John Smith",
         "title": "VP of Sales",
         "role": "Champion",
         "engagement_score": 85,
         "calls_attended": 4,
         "sentiment": "positive",
         "influence_level": "high"
       },
       {
         "name": "Sarah Johnson",
         "title": "CRO",
         "role": "Decision Maker",
         "engagement_score": 60,
         "calls_attended": 2,
         "sentiment": "neutral",
         "influence_level": "very_high"
       }
     ]
   }
   ```

3. **Display on Account Page:**
   - Org chart view of stakeholders
   - Relationship strength indicators
   - Engagement trends per stakeholder

---

## API Rate Limits

### Gong Rate Limits
- **Rate limit:** 3 requests/second per API key
- **Daily limit:** 10,000 requests/day per API key
- **Burst:** Short bursts allowed, but sustained >3/sec throttled

### Handling Rate Limits
- Built-in rate limiting (2.5 req/sec to stay safe)
- Automatic retry with exponential backoff
- Pagination (100 calls per page max)
- Batch processing for large datasets

**Best Practices:**
- Schedule syncs during off-peak hours (overnight)
- Use date filters to minimize data fetched
- Cache call data (calls don't change once analyzed)
- Request only fields you need

---

## Testing Your Integration

### Pre-Test Checklist
- [ ] API credentials added to application
- [ ] Connection test passed
- [ ] CRM integration set up (Gong needs CRM data)
- [ ] At least 1 recorded call in Gong

### Test 1: Connection Test
1. **Settings** → **Gong**
2. Click **"Test Connection"**
3. **Expected Result:**
   - ✅ "Gong connection successful"
   - Shows: API key status, scopes
   - Permission check: ✓ Calls, ✓ Users, ✓ CRM
4. **If Failed:** See Troubleshooting

### Test 2: Sync Single Call
1. **Record or Find Test Call in Gong:**
   - Ensure call is fully processed (usually 1-2 hours after call ends)
   - Note the call participants' emails

2. **Trigger Call Sync:**
   - Settings → Gong → **"Sync Recent Calls"**
   - Or set date range for specific day

3. **Expected Result:**
   - Progress: "Syncing calls from Gong..."
   - Result: "Synced 3 calls"
   - Go to **Activities** page
   - See call activity listed

4. **Verify Call Details:**
   - Activity type: "Call" or specific (Discovery, Demo, etc.)
   - Date/time matches Gong
   - Duration correct
   - Participants linked to Leads
   - Account linked correctly
   - Source: "Gong"
   - Gong call URL link works

### Test 3: View Call Insights
1. **Click on Synced Call Activity**
2. **Expected to See:**
   - Call summary
   - Duration and participants
   - **Topics discussed:** Pricing, Features, Competition
   - **Sentiment:** Positive/Neutral/Negative (with score)
   - **Talk ratio:** Rep 40% vs Customer 60%
   - **Questions asked:** 15
   - **Next steps identified:** List of action items
   - **Link to Gong:** "View in Gong" button

3. **Click "View in Gong":**
   - Opens Gong call page in new tab
   - Should be the correct call

### Test 4: Deal Intelligence
1. **Sync Opportunity Data:**
   - Settings → Gong → **"Sync Deal Insights"**

2. **Find Opportunity with Calls:**
   - Go to **Pipeline** or **Opportunities** page
   - Find opp that has Gong calls

3. **Expected to See:**
   - **Gong Insights Panel:**
     - Total calls: X
     - Average sentiment: 75% positive
     - Champions identified: 2
     - Decision-makers engaged: 1
     - Risk signals: None or listed
     - Next steps: List from latest calls

4. **Engagement Score:**
   - Account ICP score includes Gong bonus
   - Breakdown shows: +X points from Gong calls

### Test 5: Stakeholder Mapping
1. **Go to Account with Multiple Calls**
2. **View "Stakeholders" Tab**
3. **Expected to See:**
   - List of all participants from Gong calls
   - Each stakeholder shows:
     - Name, Title, Company
     - Role: Champion/Decision Maker/User
     - Calls attended: X of Y total
     - Engagement score: 0-100
     - Sentiment trend: ↗ Improving / → Stable / ↘ Declining
   - Org chart visualization (if enabled)

---

## Troubleshooting

### Error: "Invalid API Credentials"
**Symptoms:**
- Connection test fails
- 401 Unauthorized error
- "Invalid access key or secret"

**Solutions:**
1. **Verify credentials copied correctly:**
   - No spaces or line breaks
   - Both Access Key AND Secret provided
   - Check in Gong → Settings → API

2. **Check API key status:**
   - Log into Gong
   - Settings → API
   - Verify key is Active (not Revoked or Expired)

3. **Verify scopes/permissions:**
   - Key needs `api:calls:read:basic` at minimum
   - Check permissions in Gong API settings

4. **Regenerate credentials:**
   - Revoke old key in Gong
   - Create new key with same permissions
   - Update in your application

### Error: "Rate Limit Exceeded"
**Symptoms:**
- 429 error
- "Rate limit exceeded" message
- Sync slows dramatically

**Solutions:**
1. **System auto-retries** - No action needed
2. **Reduce sync frequency:**
   - Change from hourly to daily
   - Sync during off-peak hours only
3. **Check concurrent syncs:**
   - Ensure only one sync job running at a time
4. **Contact Gong:**
   - Request higher rate limits if needed
   - Explain use case

### Error: "Call Not Found" or Empty Results
**Symptoms:**
- Sync completes but no calls imported
- "No calls found for date range"

**Solutions:**
1. **Verify date range:**
   - Calls only available after they're processed (1-2 hours post-call)
   - Check you're querying correct dates

2. **Check technical user permissions:**
   - Technical user needs access to workspaces
   - Verify call access permissions
   - Gong Settings → Users → [Your Technical User]

3. **Verify CRM sync:**
   - Gong needs CRM data to link calls to accounts
   - Check Gong's Salesforce/HubSpot integration
   - Ensure opportunities synced to Gong

4. **Filter issues:**
   - Some calls may be private/restricted
   - Check call privacy settings in Gong

### Error: "Cannot Match Call to Account"
**Symptoms:**
- Calls synced but not linked to accounts
- "Account not found for call participants"

**Solutions:**
1. **Check CRM account mapping:**
   - Gong uses CRM Account ID to link
   - Ensure your accounts have CRM IDs
   - Run CRM sync first, then Gong sync

2. **Fallback to email domain matching:**
   - Enable domain-based matching
   - Settings → Data Mapping → Enable domain fallback
   - Match participant email domain to account domain

3. **Manual matching:**
   - Settings → Data Mapping → Manual Links
   - Manually link Gong participants to accounts

### Error: "Transcript Not Available"
**Symptoms:**
- Call metadata synced but no transcript
- "Transcript not accessible"

**Solutions:**
1. **Check transcript permissions:**
   - API key needs `api:calls:read:transcript` scope
   - Verify in Gong API settings

2. **Transcript processing time:**
   - Transcripts take 1-4 hours to process
   - Retry sync after waiting

3. **Privacy settings:**
   - Some calls may have transcript disabled
   - Check Gong privacy settings
   - Admin may have restricted transcript access

---

## Best Practices

### 1. Sync Strategy
- **Daily sync:** Best for most teams (overnight processing)
- **Focus on recent data:** Last 90 days is sufficient
- **Incremental sync:** Only fetch new/updated calls
- **Cache aggressively:** Call data doesn't change after processing

### 2. Data Prioritization
**Focus on high-value insights:**
- ✅ Call sentiment and topics
- ✅ Champion identification
- ✅ Next steps and action items
- ✅ Risk signals
- ⚠️ Full transcripts (optional - use lots of storage)
- ❌ Call recordings (rarely needed, very large)

### 3. Engagement Scoring
**Weight Gong signals appropriately:**
- Discovery call: +10 (early stage)
- Demo call: +15 (mid stage)
- Pricing discussion: +20 (late stage, high intent)
- Champion on call: +10 (relationship strength)
- Executive on call: +15 (decision-maker engagement)
- Negative sentiment: -10 (risk signal)

### 4. CRM Integration
**Leverage Gong's CRM sync:**
- Let Gong handle CRM → Gong sync
- You handle Gong → Your App sync
- Use CRM IDs as primary matching key
- Keeps data lineage clean

### 5. Privacy & Compliance
**Respect privacy settings:**
- Honor Gong's privacy controls
- Some calls may be restricted
- Don't store full transcripts if not needed
- Follow your company's data retention policies

---

## Additional Resources

### Gong Documentation
- [Gong API Documentation](https://help.gong.io/hc/en-us/articles/360038949091)
- [Authentication Guide](https://help.gong.io/hc/en-us/articles/360038949111)
- [Calls API Reference](https://help.gong.io/hc/en-us/articles/360038949131)
- [Rate Limits](https://help.gong.io/hc/en-us/articles/360038949151)

### Internal Documentation
- [Master Integration Guide](./MASTER_INTEGRATION_GUIDE.md)
- [Salesforce Setup](./SALESFORCE_OAUTH_SETUP.md) - Prerequisite for Gong
- [Clari Setup](./CLARI_SETUP.md) - Alternative forecasting tool
- [Troubleshooting](./TROUBLESHOOTING_INTEGRATIONS.md)

### Support
- **Gong Support:** support@gong.io
- **Help Center:** https://help.gong.io/
- **API Support:** Open ticket in Gong dashboard
- **Application Support:** Settings → Integration Health

---

## Success Checklist

After setup, you should be able to:
- [ ] Connect to Gong with API credentials
- [ ] Sync call metadata and insights
- [ ] View call topics and sentiment on account pages
- [ ] Track stakeholder engagement
- [ ] Identify champions and decision-makers
- [ ] Calculate engagement scores from calls
- [ ] View deal intelligence and risk signals
- [ ] Link Gong insights to opportunities
- [ ] Monitor sync health

---

## Next Steps

1. **Set Up Clari** - [Clari Setup Guide](./CLARI_SETUP.md) - Forecasting platform
2. **Configure Call-Based Scoring** - Settings → Scoring → Gong Signals
3. **Enable Scheduled Sync** - [CRON Setup](./CRON_SETUP_INSTRUCTIONS.md)
4. **Create Call Activity Reports** - Rep performance, account engagement
5. **Set Up Alerts** - Notify when high-fit account has discovery call

---

**Last Updated:** 2025-11-06  
**Version:** 1.0  
**Maintained By:** Integration Team
