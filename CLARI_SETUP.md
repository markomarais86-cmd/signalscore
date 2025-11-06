# Clari Setup Guide

## Overview

Clari is a Revenue Operations platform that provides AI-powered forecasting, pipeline management, and revenue insights. This integration allows you to:
- Import forecast data and pipeline snapshots
- Track deal health and risk signals
- Monitor revenue projections and forecast accuracy
- Calculate account prioritization based on close probability
- Analyze pipeline trends and conversion rates

**Use Case:** "Show me which high-fit accounts are in our forecast and their probability of closing this quarter"

**Why Clari?**
- **AI-powered forecasting:** Machine learning for revenue predictions
- **Pipeline intelligence:** Health scores, risks, and next actions
- **Activity insights:** Email, meeting, and CRM activity correlation
- **Forecast accuracy:** Track and improve forecast reliability
- **Revenue analytics:** Waterfall reports, deal slippage, conversion metrics

---

## Prerequisites

### Required
- **Active Clari subscription** with API access
  - Growth or Enterprise plan (API included)
  - Must have admin or API user role
- **CRM integration** (Salesforce or HubSpot)
  - Clari syncs opportunity data from your CRM
  - Needed for pipeline and forecast data
- **Clari subdomain:** Your organization's URL (e.g., `yourcompany.clari.com`)

### Verify Your Access
1. Log into Clari at `https://yourcompany.clari.com/`
2. Click **Settings** (gear icon, top right)
3. Navigate to **Integrations** → **API Access**
4. If you don't see API settings, contact your Clari admin
5. Verify your plan includes API access

---

## Step 1: Generate Clari API Token

Clari uses **API Tokens** for authentication (not OAuth).

### Create API Token
1. **Log into Clari** at `https://yourcompany.clari.com/`

2. **Navigate to API Settings:**
   - Click **Settings** (gear icon, top right)
   - Go to **Integrations**
   - Click **API Tokens** or **API Access**
   - Or navigate to: `/settings/integrations/api`

3. **Create New Token:**
   - Click **"+ Generate New Token"** or **"Create Token"**
   - **Token Name:** `ICP Signal Platform Integration`
   - **Description:** `Integration for forecast and pipeline data`
   - **User/Service Account:** Select user or create service account
     - **Recommended:** Create dedicated service account for integrations
     - Ensures token doesn't break if user leaves
   
   **Permissions/Scopes:**
   - ✅ `forecasts:read` - View forecast data
   - ✅ `opportunities:read` - View opportunity data
   - ✅ `accounts:read` - View account data
   - ✅ `activities:read` - View activity data
   - ✅ `analytics:read` - View analytics and reports
   - ✅ `users:read` - View user information
   - ⚠️ `forecasts:write` - Only if you want to push data back to Clari

4. **Generate and Copy Token:**
   - Click **"Generate Token"**
   - Token displayed: `clari_xxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **CRITICAL:** Copy immediately - you won't see it again
   - Store securely
   - Token format: `clari_` prefix + long alphanumeric string

5. **Note Token Expiration:**
   - Some orgs set token expiration (30/60/90 days)
   - Check expiration date
   - Set calendar reminder to regenerate before expiry

---

## Step 2: Add API Token to Your Application

### Option A: Via Application UI (Recommended)
1. **Navigate to Settings**
   - In your application, click **Settings** (left sidebar)
   - Go to **External Integrations** tab

2. **Find Clari Section**
   - Scroll to **"Clari"** card
   - Click **"Connect"**

3. **Enter API Token:**
   - **API Token:** Paste your Clari token
   - **Clari Domain:** Enter your subdomain (e.g., `yourcompany`)
     - Just the subdomain, NOT full URL
     - Example: If URL is `acme.clari.com`, enter `acme`
   - Click **"Save"**

4. **Test Connection:**
   - Click **"Test Connection"**
   - Should show: **"Connected ✓"**
   - Displays: Token status, permissions, expiration date

### Option B: Via Supabase Secrets (Manual)
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/settings/functions)
2. Click **"Edge Function Secrets"**
3. Add secret:
   - **Name:** `CLARI_API_TOKEN`
   - **Value:** Your Clari API token
   - Click "Save"

4. Test connection via application UI

---

## Step 3: Configure Clari Integration

### Set Sync Preferences
1. **Settings** → **External Integrations** → **Clari**

2. **Configure Data to Import:**

   **Forecast Data:**
   - ✅ Current quarter forecast
   - ✅ Next quarter forecast
   - ✅ Forecast categories (Commit, Best Case, Pipeline)
   - ✅ Deal-level forecast values
   - ⚠️ Historical forecasts (optional - for trend analysis)

   **Pipeline Data:**
   - ✅ Open opportunities
   - ✅ Deal health scores
   - ✅ Close probability (Clari's AI score)
   - ✅ Risk signals and alerts
   - ✅ Next best actions

   **Activity Insights:**
   - ✅ Activity scores (email, meeting, CRM updates)
   - ✅ Engagement trends
   - ✅ Stagnation alerts
   - ⚠️ Detailed activity logs (optional - redundant if you have CRM/Gong)

   **Analytics:**
   - ✅ Pipeline snapshots (weekly)
   - ✅ Conversion rates by stage
   - ✅ Average deal cycle time
   - ✅ Win/loss rates

   **Sync Frequency:**
   - **Daily:** Recommended (Clari updates overnight)
   - **Weekly:** For weekly forecast cycles
   - **Before forecast calls:** Trigger sync before leadership reviews
   - **Manual:** On-demand only

   **Historical Data:**
   - Last 2 quarters (default)
   - Current fiscal year
   - All time (initial setup - can take a while)

### Map Clari Data to Your Schema
1. **Settings** → **Clari** → **Field Mapping**

2. **Standard Mappings (Automatic):**
   - Clari Opportunity → Your Opportunity (by CRM Opp ID)
   - Clari Account → Your Account (by CRM Account ID)
   - Clari Owner → Your User (by email or CRM User ID)

3. **Clari-Specific Fields:**
   - `clari_close_probability` → `close_probability`
   - `clari_health_score` → `deal_health_score`
   - `clari_forecast_category` → `forecast_category`
   - `clari_risk_signals` → `risk_flags`

4. **Forecast Categories:**
   - Map Clari forecast buckets to your schema:
     - Closed → Won
     - Commit → High confidence
     - Best Case → Medium confidence
     - Pipeline → Low confidence
     - Omitted → Not forecasted

### Enable Forecast-Based Prioritization
1. **Settings** → **Scoring** → **Clari Signals**

2. **Configure Point Adjustments:**
   - **In forecast (Commit):** +20 points
   - **In forecast (Best Case):** +10 points
   - **High close probability (>70%):** +15 points
   - **Deal health: Healthy:** +10 points
   - **Deal health: At Risk:** -10 points
   - **Deal health: Critical:** -20 points
   - **Stagnant (no activity 14+ days):** -15 points
   - **Active engagement:** +5 points

3. **Deal Stage Weighting:**
   - Discovery: 1x multiplier
   - Demo/Evaluation: 1.5x multiplier
   - Proposal/Negotiation: 2x multiplier
   - Closed: 0x (don't re-score closed deals)

---

## How the Integration Works

### 1. Authentication
**Purpose:** Authenticate API requests to Clari

**How it works:**
- Clari uses Bearer token authentication
- Every API request includes:
  ```
  Authorization: Bearer clari_xxxxxxxxxxxxxxxxx
  ```
- Example:
  ```bash
  curl -X GET 'https://api.clari.com/v4/forecasts' \
    -H 'Authorization: Bearer clari_xxxxx'
  ```

**Security:**
- Token stored encrypted in database
- Never exposed to frontend
- Used only in edge functions (server-side)

### 2. Forecast Data Sync
**Purpose:** Import current and future quarter forecasts

**How it works:**
1. **Scheduled Job Runs** (e.g., daily at 6 AM)

2. **Fetch Current Forecast:**
   ```
   GET https://api.clari.com/v4/forecasts/current
   ?include=opportunities,categories,rollups
   ```

3. **Clari Returns Forecast:**
   ```json
   {
     "forecast": {
       "id": "fc-q1-2024",
       "quarter": "Q1 2024",
       "fiscalQuarter": "FY24Q1",
       "startDate": "2024-01-01",
       "endDate": "2024-03-31",
       "status": "Open",
       "categories": {
         "closed": {
           "amount": 2500000,
           "count": 15
         },
         "commit": {
           "amount": 1800000,
           "count": 12
         },
         "bestCase": {
           "amount": 3200000,
           "count": 24
         },
         "pipeline": {
           "amount": 5500000,
           "count": 45
         }
       },
       "totalPipeline": 13000000,
       "quota": 10000000,
       "attainment": 0.42
     },
     "opportunities": [
       {
         "id": "opp-123",
         "crmOpportunityId": "006xxxx",
         "accountId": "acc-456",
         "accountName": "Acme Corp",
         "amount": 150000,
         "closeDate": "2024-02-28",
         "stage": "Negotiation",
         "forecastCategory": "commit",
         "clariProbability": 85,
         "crmProbability": 90,
         "healthScore": 82,
         "healthStatus": "Healthy",
         "riskSignals": [],
         "nextBestAction": "Schedule executive sponsor meeting",
         "daysInStage": 14,
         "lastActivityDate": "2024-01-14",
         "activityScore": 78
       }
     ]
   }
   ```

4. **Process Forecast Data:**
   - Store forecast summary in `forecasts` table
   - Update each opportunity with Clari insights
   - Calculate forecast-based ICP adjustments

5. **Store in Database:**
   ```sql
   -- Store forecast summary
   INSERT INTO forecasts (
     org_id,
     quarter,
     fiscal_period,
     start_date,
     end_date,
     committed_amount,
     best_case_amount,
     pipeline_amount,
     quota,
     attainment,
     data_source
   ) VALUES (
     'org-uuid',
     'Q1 2024',
     'FY24Q1',
     '2024-01-01',
     '2024-03-31',
     4300000, -- closed + commit
     7500000, -- + best case
     13000000, -- + pipeline
     10000000,
     0.43,
     'clari'
   );
   
   -- Update opportunity with Clari data
   UPDATE opportunities
   SET 
     clari_close_probability = 85,
     clari_health_score = 82,
     clari_health_status = 'Healthy',
     clari_forecast_category = 'commit',
     clari_next_action = 'Schedule executive sponsor meeting',
     clari_risk_signals = '[]',
     last_synced_at = NOW()
   WHERE crm_opportunity_id = '006xxxx';
   ```

### 3. Deal Health Monitoring
**Purpose:** Track deal health and identify risks

**How it works:**
1. **Fetch Deal Intelligence:**
   ```
   GET https://api.clari.com/v4/opportunities/{opportunityId}/insights
   ```

2. **Clari Returns Health Details:**
   ```json
   {
     "opportunityId": "opp-123",
     "healthScore": 82,
     "healthStatus": "Healthy",
     "healthFactors": [
       {
         "factor": "Activity Level",
         "score": 85,
         "status": "positive",
         "description": "Consistent activity with multiple stakeholders"
       },
       {
         "factor": "Deal Velocity",
         "score": 78,
         "status": "positive",
         "description": "Progressing through stages on schedule"
       },
       {
         "factor": "Forecast Stability",
         "score": 90,
         "status": "positive",
         "description": "Close date hasn't slipped"
       }
     ],
     "riskSignals": [
       {
         "type": "champion_not_engaged",
         "severity": "low",
         "description": "Champion hasn't been on recent calls",
         "recommendedAction": "Schedule 1:1 with champion"
       }
     ],
     "nextBestActions": [
       "Schedule executive sponsor meeting",
       "Send security questionnaire",
       "Confirm budget approval"
     ],
     "trendingUp": true,
     "momentumScore": 72
   }
   ```

3. **Update Opportunity:**
   - Store health factors
   - Flag risk signals
   - Display recommended actions
   - Track momentum trend

4. **Display on Account Page:**
   - Deal health scorecard
   - Risk alerts with severity
   - Recommended next actions
   - Momentum indicator (↗ ↘)

### 4. Pipeline Analytics
**Purpose:** Track pipeline trends and conversion metrics

**How it works:**
1. **Fetch Weekly Snapshots:**
   ```
   GET https://api.clari.com/v4/analytics/pipeline-snapshots
   ?startWeek=2024-W01
   &endWeek=2024-W04
   ```

2. **Clari Returns Pipeline Trends:**
   ```json
   {
     "snapshots": [
       {
         "week": "2024-W01",
         "date": "2024-01-01",
         "totalPipeline": 12500000,
         "weightedPipeline": 6200000,
         "newPipeline": 850000,
         "slippedDeals": 250000,
         "convertedDeals": 450000,
         "lostDeals": 150000,
         "byStage": {
           "Discovery": 3500000,
           "Demo": 2800000,
           "Evaluation": 2600000,
           "Proposal": 2200000,
           "Negotiation": 1400000
         }
       }
     ],
     "metrics": {
       "averageDealSize": 125000,
       "averageCycleTime": 87,
       "conversionRates": {
         "Discovery-to-Demo": 0.65,
         "Demo-to-Evaluation": 0.48,
         "Evaluation-to-Proposal": 0.42,
         "Proposal-to-Closed": 0.38
       },
       "winRate": 0.28
     }
   }
   ```

3. **Display Analytics:**
   - Pipeline trend charts
   - Conversion funnel visualization
   - Benchmark against historical data
   - Identify bottleneck stages

---

## API Rate Limits

### Clari Rate Limits
- **Rate limit:** 100 requests/minute per token
- **Daily limit:** 10,000 requests/day per token
- **Burst:** Up to 200 requests in short burst

### Handling Rate Limits
- Built-in rate limiting (80 req/min to stay safe)
- Automatic retry on 429 errors
- Pagination (100 records per page)
- Incremental sync (only changed data)

**Best Practices:**
- Schedule syncs during off-peak hours
- Cache forecast data (updates daily, not real-time)
- Batch opportunity requests

---

## Testing Your Integration

### Pre-Test Checklist
- [ ] API token added to application
- [ ] Connection test passed
- [ ] CRM integration working (Clari needs CRM data)
- [ ] At least 1 forecasted opportunity in Clari

### Test 1: Connection Test
1. **Settings** → **Clari**
2. Click **"Test Connection"**
3. **Expected Result:**
   - ✅ "Clari connection successful"
   - Shows: Token status, expiration date
   - Permissions: ✓ Forecasts, ✓ Opportunities, ✓ Analytics
4. **If Failed:** See Troubleshooting

### Test 2: Sync Forecast Data
1. **Ensure Current Forecast Exists in Clari:**
   - Log into Clari
   - Verify you have an active forecast
   - Note the forecast quarter

2. **Trigger Forecast Sync:**
   - Settings → Clari → **"Sync Forecast"**

3. **Expected Result:**
   - Progress: "Syncing forecast from Clari..."
   - Result: "Synced Q1 2024 forecast: 45 opportunities"
   - Go to **Forecast** page (if you have one)
   - Or **Dashboard** → Forecast widget

4. **Verify Forecast Data:**
   - Forecast quarter correct
   - Committed, Best Case, Pipeline amounts match Clari
   - Quota and attainment correct
   - Number of opps matches

### Test 3: View Deal Intelligence
1. **Find Opportunity in Clari:**
   - Select one with good Clari data
   - Note the opportunity name

2. **Find Same Opp in Your App:**
   - Go to **Opportunities** or **Pipeline** page
   - Search for opportunity

3. **Expected to See:**
   - **Clari Health Score:** 82/100
   - **Health Status:** Healthy (green) / At Risk (yellow) / Critical (red)
   - **Close Probability:** 85% (Clari's AI prediction)
   - **Forecast Category:** Commit
   - **Risk Signals:** List or "None"
   - **Next Best Action:** Recommended next steps
   - **Momentum:** ↗ Trending up / ↘ Trending down

4. **Click Opportunity:**
   - View full Clari insights
   - Health factors breakdown
   - Risk details
   - Activity score

### Test 4: Pipeline Analytics
1. **Sync Pipeline Data:**
   - Settings → Clari → **"Sync Analytics"**

2. **View Pipeline Dashboard:**
   - Go to **Analytics** or **Pipeline** page

3. **Expected to See:**
   - **Pipeline Trend Chart:** Weekly/monthly pipeline growth
   - **Conversion Funnel:** Discovery → Demo → Proposal → Closed
   - **Win Rate:** % of deals won
   - **Average Deal Size:** $125K
   - **Average Cycle Time:** 87 days
   - **Stage Conversion Rates:** By stage

4. **Compare to Clari:**
   - Numbers should match Clari dashboards
   - Trends should align

### Test 5: ICP Scoring with Clari Data
1. **Find High-Fit Account with Forecasted Opp:**
   - ICP score: 75 (before Clari adjustment)
   - Opportunity in "Commit" forecast

2. **After Clari Sync:**
   - ICP score should increase: 75 + 20 = 95
   - Breakdown shows: "+20 points from Clari forecast"

3. **Find Account with At-Risk Deal:**
   - ICP score: 80 (before)
   - Clari health: At Risk

4. **After Clari Sync:**
   - ICP score decreases: 80 - 10 = 70
   - Breakdown shows: "-10 points from deal health risk"

---

## Troubleshooting

### Error: "Invalid API Token"
**Symptoms:**
- Connection test fails
- 401 Unauthorized error

**Solutions:**
1. **Verify token copied correctly:**
   - Should start with `clari_`
   - No spaces or line breaks
   - Full token string

2. **Check token status:**
   - Log into Clari
   - Settings → API Tokens
   - Verify token is Active (not Expired or Revoked)

3. **Check expiration:**
   - Some tokens expire after X days
   - Regenerate if expired

4. **Regenerate token:**
   - Revoke old token
   - Create new token
   - Update in your app

### Error: "Insufficient Permissions"
**Symptoms:**
- Connection works but data sync fails
- 403 Forbidden error
- "Missing required scope"

**Solutions:**
1. **Verify token scopes:**
   - Clari → API Tokens → [Your Token] → Permissions
   - Ensure all required scopes checked:
     - forecasts:read
     - opportunities:read
     - analytics:read

2. **Check user permissions:**
   - Token inherits creating user's permissions
   - User must have access to forecasts and opportunities
   - Contact Clari admin if missing permissions

3. **Recreate token with correct scopes:**
   - Delete old token
   - Create new with all scopes
   - Update in app

### Error: "Rate Limit Exceeded"
**Symptoms:**
- 429 error during sync
- "Too many requests" message

**Solutions:**
1. **System auto-retries** - Wait
2. **Reduce sync frequency:**
   - Change from daily to weekly
3. **Check concurrent syncs:**
   - Ensure only one sync running
4. **Contact Clari support:**
   - Request higher rate limits if needed

### Error: "Opportunity Not Found"
**Symptoms:**
- Forecast synced but opportunities missing
- "No matching CRM opportunity ID"

**Solutions:**
1. **Verify CRM sync:**
   - Clari must be synced with your CRM first
   - Check Clari's Salesforce/HubSpot integration
   - Ensure opps exist in CRM

2. **Check CRM ID mapping:**
   - Clari uses CRM Opportunity IDs
   - Ensure your opportunities have CRM IDs
   - Run CRM sync before Clari sync

3. **Manual matching:**
   - Settings → Data Mapping
   - Manually link Clari opps to yours

### Error: "Forecast Data Stale"
**Symptoms:**
- Forecast numbers don't match Clari UI
- Data seems outdated

**Solutions:**
1. **Clari updates overnight:**
   - Forecast refreshes daily around midnight
   - Sync after 6 AM for latest data

2. **Check last sync time:**
   - Settings → Clari → Last synced timestamp
   - If >24 hours, trigger manual sync

3. **Verify sync schedule:**
   - Cron job running correctly
   - Check Integration Health dashboard

---

## Best Practices

### 1. Sync Strategy
- **Daily sync:** Best (after Clari's overnight refresh)
- **Pre-forecast call sync:** Before weekly forecast reviews
- **Weekly minimum:** At least once per week
- **Cache aggressively:** Forecast data changes slowly

### 2. Data Prioritization
**Focus on high-value insights:**
- ✅ Forecast categories and amounts
- ✅ Close probability (Clari AI vs CRM)
- ✅ Deal health scores and risk signals
- ✅ Next best actions
- ⚠️ Historical forecasts (for trends, optional)
- ❌ Detailed activity logs (redundant with CRM/Gong)

### 3. ICP Scoring Integration
**Use Clari signals wisely:**
- Forecasted opps = high priority (+20 points)
- High close probability = likely to close (+15)
- Healthy deal = good engagement (+10)
- At-risk deal = flag for attention (-10)
- Don't over-weight Clari data (cap at ±25 points)

### 4. Deal Health Monitoring
**Act on risk signals:**
- Critical health → Immediate intervention
- At risk → Review with sales manager
- Stagnant → Trigger re-engagement sequence
- Champion not engaged → Schedule call

### 5. Forecast Accuracy
**Track over time:**
- Compare committed forecast to actual closed
- Identify consistently accurate vs inaccurate reps
- Use for coaching and process improvement
- Feed accuracy data back to Clari

---

## Additional Resources

### Clari Documentation
- [Clari API Documentation](https://developer.clari.com/docs)
- [Authentication Guide](https://developer.clari.com/docs/authentication)
- [Forecasts API](https://developer.clari.com/docs/forecasts-api)
- [Opportunities API](https://developer.clari.com/docs/opportunities-api)

### Internal Documentation
- [Master Integration Guide](./MASTER_INTEGRATION_GUIDE.md)
- [Salesforce Setup](./SALESFORCE_OAUTH_SETUP.md) - Prerequisite
- [Gong Setup](./GONG_SETUP.md) - Complementary integration
- [Troubleshooting](./TROUBLESHOOTING_INTEGRATIONS.md)

### Support
- **Clari Support:** support@clari.com
- **Help Center:** https://help.clari.com/
- **Developer Portal:** https://developer.clari.com/
- **Application Support:** Settings → Integration Health

---

## Success Checklist

After setup, you should be able to:
- [ ] Connect to Clari with API token
- [ ] Sync current and next quarter forecasts
- [ ] View forecast categories and amounts
- [ ] See deal health scores on opportunities
- [ ] Identify risk signals and next actions
- [ ] Calculate ICP scores with forecast adjustments
- [ ] Track pipeline trends and conversion rates
- [ ] Monitor forecast accuracy over time
- [ ] Identify high-priority accounts based on forecast status

---

## Next Steps

1. **Configure Forecast-Based Prioritization** - Settings → Scoring → Clari
2. **Enable Scheduled Sync** - [CRON Setup](./CRON_SETUP_INSTRUCTIONS.md)
3. **Create Pipeline Dashboards** - Forecast attainment, deal health
4. **Set Up Risk Alerts** - Notify when deals go at-risk
5. **Track Forecast Accuracy** - Compare predicted vs actual closed

---

**Last Updated:** 2025-11-06  
**Version:** 1.0  
**Maintained By:** Integration Team
