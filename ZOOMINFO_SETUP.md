# ZoomInfo Setup Guide

## Overview

ZoomInfo is a leading B2B contact and company intelligence database with over 100 million business contacts and 14 million companies. This integration allows you to:
- Calculate total available accounts matching your ICP
- Enrich existing accounts with firmographic data
- Discover new contacts at target accounts
- Track ZoomInfo coverage vs your CRM

**Use Case:** "Show me how many high-fit accounts exist in ZoomInfo's database that match my ICP criteria"

---

## Prerequisites

### Required
- **Active ZoomInfo subscription** with API access
  - Professional or Advanced plan required
  - Elite plan recommended for full API features
- **Admin or Super Admin role** in ZoomInfo
- **API credits allocation** in your subscription

### Verify Your Access
1. Log into [ZoomInfo](https://www.zoominfo.com/)
2. Navigate to **Settings** (gear icon, top right)
3. Look for **"API Management"** or **"Integrations"** section
4. If you don't see this, contact your ZoomInfo account manager to enable API access

---

## Step 1: Generate ZoomInfo API Key

### Method 1: Via ZoomInfo Dashboard (Recommended)
1. **Log into ZoomInfo** at https://www.zoominfo.com/
2. **Navigate to Settings**
   - Click the gear icon in the top right corner
   - Or go to https://app.zoominfo.com/#/apps/settings

3. **Access API Management**
   - In the left sidebar, click **"API Management"**
   - Or look for **"Integrations"** → **"API Keys"**

4. **Create New API Key**
   - Click **"Create API Key"** or **"Generate New Key"**
   - Name it: `ICP Signal Platform Integration`
   - Set permissions:
     - ✅ Search API (required)
     - ✅ Company API (required)
     - ✅ Contact API (optional - for contact enrichment)
   - Set expiration: **Never** (or 1 year if required by policy)

5. **Copy Your API Key**
   - Click **"Generate"**
   - **IMPORTANT:** Copy the key immediately
   - Store it securely - you won't be able to see it again
   - Format: `eyJhbGci...` (long JWT-style token)

### Method 2: Via ZoomInfo Account Manager
If you don't see API Management:
1. Contact your ZoomInfo Customer Success Manager
2. Request API access and credentials
3. Specify you need:
   - Search API access
   - Company Enrichment API access
   - Contact API access (optional)
4. They'll provide your API key via secure email

---

## Step 2: Add API Key to Your Application

### Option A: Via Application UI (Recommended)
1. **Navigate to Settings**
   - In your application, click **Settings** in the left sidebar
   - Go to **Data Enrichment** tab

2. **Find ZoomInfo Section**
   - Scroll to **"ZoomInfo"** card
   - Click **"Configure"** or look for the API key input field

3. **Enter Your API Key**
   - Paste the API key you copied from ZoomInfo
   - Click **"Save"**
   - Click **"Test Connection"** to verify

4. **Verify Connection Status**
   - Status should change to **"Connected ✓"**
   - If you see an error, check the Troubleshooting section below

### Option B: Via Supabase Secrets (Manual)
If you prefer to add the secret directly to Supabase:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/settings/functions)
2. Click **"Edge Function Secrets"**
3. Click **"Add new secret"**
4. Enter:
   - **Name:** `ZOOMINFO_API_KEY`
   - **Value:** Your ZoomInfo API key
5. Click **"Save"**
6. Restart edge functions (automatic after secret added)

---

## Step 3: Configure ZoomInfo Integration

### Enable Total Available Count Tracking
This calculates how many accounts in ZoomInfo match your ICP criteria.

1. **Define Your ICP First**
   - Go to **ICP Manager** in your application
   - Create or edit your ICP with criteria:
     - Employee count range
     - Revenue range
     - Industries
     - Countries
     - Technologies used

2. **Trigger Total Count Calculation**
   - Go to **Settings** → **External Integrations**
   - Find **"ZoomInfo"** card
   - Click **"Calculate Available Accounts"**
   - This queries ZoomInfo's Search API with your ICP filters

3. **View Results**
   - Total available accounts will appear on the ZoomInfo card
   - Also visible on **Executive Dashboard**:
     - "CRM Accounts" vs "Database Accounts"
     - Database = total available in ZoomInfo matching your ICP

### Enable Auto-Enrichment
Automatically enrich new accounts with ZoomInfo data:
1. **Settings** → **Data Enrichment** → **ZoomInfo**
2. Toggle **"Auto-enrich new accounts"** to ON
3. Configure enrichment rules:
   - **Trigger:** When new account added with domain
   - **Fields to enrich:** Employee count, revenue, industry, technologies
   - **Fallback:** Use Clearbit if ZoomInfo has no data

---

## How the Integration Works

### 1. Total Available Count Calculation
**Purpose:** Show "What's available in the market that matches our ICP?"

**How it works:**
1. Your ICP criteria are converted to ZoomInfo Search API parameters:
   ```json
   {
     "employeeCountMin": 50,
     "employeeCountMax": 500,
     "revenueMin": 5000000,
     "revenueMax": 50000000,
     "industries": ["Software", "Technology"],
     "countries": ["United States", "Canada"]
   }
   ```

2. The system calls ZoomInfo Search API with these filters
3. ZoomInfo returns total count of matching companies
4. This number is stored in `external_data_sources.total_accounts`
5. Displayed on Executive Dashboard as "Database" count

**Refresh Frequency:** Weekly automatic refresh, or manual via "Refresh Counts" button

### 2. Account Enrichment
**Purpose:** Fill in missing firmographic data for accounts in your CRM

**Enrichment Process:**
1. New account added to your system (from CRM sync or manual entry)
2. System checks if `employee_count` or `revenue_range` is missing
3. Calls ZoomInfo Company API with domain: `/company/{domain}`
4. ZoomInfo returns enrichment data:
   ```json
   {
     "name": "Acme Corp",
     "employees": 250,
     "revenue": 15000000,
     "industry": "Software",
     "phone": "+1-555-0100",
     "address": "123 Main St, San Francisco, CA"
   }
   ```
5. System updates account record with enriched data
6. Triggers ICP scoring with new data

**Waterfall Logic:**
- Try ZoomInfo first (most comprehensive)
- If no data, try Apollo.io
- If no data, try Clearbit
- If no data, use AI estimation

### 3. Contact Discovery
**Purpose:** Find contacts at high-fit accounts

**How it works:**
1. High-fit account identified (ICP score > 70)
2. System checks if account has any contacts/leads
3. If no contacts, calls ZoomInfo Contact Search API:
   ```json
   {
     "companyDomain": "acmecorp.com",
     "jobTitles": ["VP Sales", "Director Sales Operations", "CRO"],
     "seniorityLevels": ["VP", "Director", "C-Level"]
   }
   ```
4. ZoomInfo returns list of contacts with email, phone, title
5. Contacts inserted into your `leads` table
6. Contact discovery job marked complete

---

## API Rate Limits & Quotas

### Rate Limits (API Calls)
- **Search API:** 10 requests/second, 1,000 requests/hour
- **Company API:** 20 requests/second, 2,000 requests/hour
- **Contact API:** 10 requests/second, 500 requests/hour

**Handling in App:**
- Built-in rate limiting with exponential backoff
- Batch processing to stay under limits
- Queue system for large enrichment jobs

### Credit Quotas (Data Credits)
ZoomInfo charges credits for data exports:
- **Company search:** 1 credit per company viewed
- **Contact export:** 1 credit per contact email revealed
- **Enrichment API:** 0.5 credits per company enriched

**Your Subscription:**
- Check your credit balance: ZoomInfo Dashboard → Billing
- Set alerts at 80% usage
- Credits reset monthly on your billing date

**Managing Credits:**
- Set enrichment limits in Settings: "Max 1,000 enrichments/month"
- Prioritize high-fit accounts (ICP score > 70)
- Use waterfall enrichment to save ZoomInfo credits

---

## Testing Your Integration

### Pre-Test Checklist
- [ ] ZoomInfo API key added to application
- [ ] Connection status shows "Connected ✓"
- [ ] ICP defined with specific criteria
- [ ] At least 1 account in your database with a domain

### Test 1: Connection Test
1. **Settings** → **Data Enrichment** → **ZoomInfo**
2. Click **"Test Connection"**
3. **Expected Result:** 
   - ✅ Success message: "ZoomInfo connection successful"
   - Status badge turns green
   - Last tested timestamp updates
4. **If Failed:** See Troubleshooting section

### Test 2: Total Available Count
1. **Settings** → **External Integrations** → **ZoomInfo**
2. Click **"Calculate Available Accounts"**
3. **Expected Result:**
   - Progress indicator shows "Calculating..."
   - After 5-10 seconds: "Found 1,234 accounts matching your ICP"
   - Number appears on ZoomInfo card
4. **Verify on Dashboard:**
   - Go to **Executive Dashboard**
   - "Database" count in "CRM vs Database" card should match
5. **If Zero Results:** Check your ICP criteria aren't too restrictive

### Test 3: Single Account Enrichment
1. **Create a test account:**
   - Go to **Accounts** page
   - Click **"Add Account"**
   - Enter:
     - Name: `Test Company`
     - Domain: `microsoft.com` (known good domain)
     - Leave employee_count and revenue blank
   - Click **"Save"**

2. **Trigger Enrichment:**
   - Click **"Enrich"** button on the account row
   - Or wait for auto-enrichment (if enabled)

3. **Expected Result:**
   - Progress indicator shows "Enriching..."
   - After 3-5 seconds, account updates with:
     - ✅ Employee count filled in
     - ✅ Revenue range filled in
     - ✅ Industry updated (if blank)
     - ✅ "Last enriched" timestamp updates
     - ✅ Badge shows "Enriched by ZoomInfo"

4. **Verify Data Quality:**
   - Check if employee count is reasonable (e.g., Microsoft = 180,000+)
   - Check if revenue is in correct range
   - If data looks wrong, see Troubleshooting

### Test 4: Contact Discovery
1. **Find a high-fit account** (ICP score > 70) with no contacts
2. Click **"Discover Contacts"** button
3. **Expected Result:**
   - Modal shows "Searching ZoomInfo for contacts..."
   - After 5-10 seconds: List of discovered contacts
   - Each contact shows: Name, Title, Email (if available), Phone
4. **Import Contacts:**
   - Select contacts you want to import
   - Click **"Import Selected"**
   - Contacts appear in **Leads** table linked to the account
5. **Verify:**
   - Go to **Leads** page
   - Filter by account name
   - Verify contacts are listed with correct data

### Test 5: Bulk Enrichment
1. **Go to Settings** → **Data Enrichment** → **Bulk Enrichment**
2. Click **"Enrich All Accounts Missing Data"**
3. **Expected Result:**
   - Job status: "Processing"
   - Progress bar shows: "15 of 50 accounts enriched"
   - Estimated time remaining displayed
4. **Monitor Progress:**
   - Refresh page to see updates
   - Check **Integration Health** dashboard for any errors
5. **Verify Results:**
   - Job completes with summary: "Enriched 48 accounts, 2 failed"
   - Click "View Failed" to see which accounts failed and why
   - Go to **Accounts** page and verify data is filled in

---

## Troubleshooting

### Error: "Invalid API Key"
**Symptoms:**
- Connection test fails
- Error message: "Authentication failed" or "Invalid API key"

**Solutions:**
1. **Verify API key is correct:**
   - Copy key again from ZoomInfo → API Management
   - Make sure you copied the entire key (no spaces or line breaks)
   - Check for any special characters that got corrupted

2. **Check API key status in ZoomInfo:**
   - Log into ZoomInfo
   - Settings → API Management
   - Verify key status is "Active" (not Expired or Revoked)
   - Check expiration date

3. **Regenerate API key:**
   - In ZoomInfo, revoke old key
   - Create new API key
   - Update in your application
   - Test again

4. **Check Supabase secret:**
   - Go to Supabase Dashboard → Edge Function Secrets
   - Verify `ZOOMINFO_API_KEY` exists and has correct value
   - Delete and re-add if unsure

### Error: "Quota Exceeded" or "Insufficient Credits"
**Symptoms:**
- Enrichment jobs fail halfway through
- Error message: "Credit limit reached"

**Solutions:**
1. **Check credit balance in ZoomInfo:**
   - Log into ZoomInfo
   - Dashboard → Billing → Credit Usage
   - See remaining credits

2. **Wait for credit reset:**
   - Credits reset monthly on your billing date
   - Check when your next reset occurs
   - Temporarily disable auto-enrichment

3. **Prioritize enrichment:**
   - In Settings → Data Enrichment
   - Enable "Only enrich high-fit accounts (ICP score > 70)"
   - This saves credits for accounts most likely to convert

4. **Use waterfall enrichment:**
   - Enable multiple providers (Apollo, Clearbit)
   - ZoomInfo only called if cheaper providers fail
   - Settings → Data Enrichment → Enable waterfall

5. **Upgrade your ZoomInfo plan:**
   - Contact your ZoomInfo CSM
   - Request additional credits
   - Consider annual plan for better rates

### Error: "Rate Limit Exceeded"
**Symptoms:**
- Enrichment slows down significantly
- Error message: "Too many requests, try again in X seconds"

**Solutions:**
1. **This is expected behavior** - The app automatically handles rate limits
2. **Reduce concurrent enrichment:**
   - Settings → Data Enrichment → Advanced
   - Set "Max concurrent requests" to 5 (default: 10)
3. **Increase batch processing time:**
   - Settings → Scheduled Jobs
   - Change enrichment frequency to "Daily" instead of "Hourly"

### Error: "No Data Found" for Many Companies
**Symptoms:**
- Enrichment completes but fields are still empty
- Error: "Company not found in ZoomInfo database"

**Solutions:**
1. **Check domain format:**
   - Ensure domain is correct: `acmecorp.com` (not `www.acmecorp.com`)
   - No http:// or https://
   - No trailing slashes

2. **ZoomInfo coverage varies by:**
   - **Geography:** Best coverage in US/Canada/UK
   - **Company size:** Better for 50+ employees
   - **Industry:** Best for B2B tech, finance, healthcare
   - **Age:** May not have very new companies (<1 year old)

3. **Try alternative providers:**
   - Apollo.io has better coverage for SMBs
   - Clearbit has better global coverage
   - Enable waterfall enrichment

4. **Check company is public-facing:**
   - ZoomInfo focuses on B2B companies
   - May not have data on:
     - Non-profits
     - Government agencies
     - Stealth startups
     - Private equity firms

### Error: "Connection Timeout"
**Symptoms:**
- Enrichment jobs fail with timeout errors
- Takes >30 seconds with no response

**Solutions:**
1. **Check ZoomInfo API status:**
   - Visit https://status.zoominfo.com/
   - Check if there's an ongoing incident

2. **Reduce batch size:**
   - Settings → Data Enrichment → Advanced
   - Set "Batch size" to 25 (default: 50)
   - This reduces load on API

3. **Check your internet connection:**
   - Verify Supabase edge functions have outbound access
   - Check firewall rules

4. **Try again later:**
   - ZoomInfo may be experiencing high load
   - Try during off-peak hours (early morning US time)

### Error: "Incorrect Data Returned"
**Symptoms:**
- Employee count or revenue seems wrong
- Industry doesn't match
- Company name is different

**Solutions:**
1. **Verify domain is correct:**
   - Check if you entered the right domain
   - Some companies have multiple domains (e.g., parent company vs subsidiary)

2. **ZoomInfo may have outdated data:**
   - ZoomInfo updates quarterly for most fields
   - Check "Data as of" date in ZoomInfo dashboard
   - If data is >6 months old, it may be stale

3. **Company may have changed:**
   - Acquisitions, mergers, rebrand
   - Check company's website for current info
   - Manually correct data in your system

4. **Report data quality issue:**
   - Log into ZoomInfo
   - Navigate to the company profile
   - Click "Suggest an Edit"
   - ZoomInfo will review and update

---

## Best Practices

### 1. Credit Management
- **Set monthly enrichment limits** to avoid overage charges
- **Prioritize high-fit accounts** (ICP score > 70) for enrichment
- **Use waterfall enrichment** to try cheaper providers first
- **Schedule enrichment during off-peak hours** for better performance

### 2. Data Quality
- **Verify domains are correct** before enriching (garbage in = garbage out)
- **Enable duplicate detection** to avoid enriching the same company twice
- **Review enrichment results** weekly to catch data quality issues
- **Set up alerts** for failed enrichments

### 3. Contact Discovery
- **Define your persona criteria** clearly (titles, seniority levels)
- **Limit contacts per account** to 3-5 to save credits
- **Focus on accounts with high propensity scores** (most likely to engage)
- **Verify emails before outreach** using a separate email verification tool

### 4. Integration Health
- **Monitor daily enrichment volumes** in Integration Health dashboard
- **Check error rates** - should be <5%
- **Review API usage** against your ZoomInfo quota
- **Set up Slack/email alerts** for integration failures

### 5. Security
- **Rotate API keys every 90 days** as best practice
- **Never commit API keys to code** - use Supabase secrets only
- **Limit API key permissions** to only what's needed
- **Audit API access logs** in ZoomInfo dashboard monthly

---

## Cost Estimation

### Typical Usage Example
**Scenario:** 1,000 accounts in CRM, want to enrich all missing data

**ZoomInfo Costs:**
- Total available count query: 1 credit (one-time per ICP change)
- Company enrichment: 500 accounts × 0.5 credits = 250 credits
- Contact discovery: 100 high-fit accounts × 5 contacts × 1 credit = 500 credits
- **Total: ~750 credits**

**Monthly Costs by Plan:**
- Professional: 2,000 credits/month = $X/month (check with ZoomInfo)
- Advanced: 5,000 credits/month = $X/month
- Elite: 10,000 credits/month = $X/month

**Tip:** Start with waterfall enrichment to reduce ZoomInfo credit usage by 50-70%

---

## Additional Resources

### ZoomInfo Documentation
- [ZoomInfo API Documentation](https://api-docs.zoominfo.com/)
- [Search API Reference](https://api-docs.zoominfo.com/search-api)
- [Company Enrichment API](https://api-docs.zoominfo.com/enrichment)
- [Rate Limits & Quotas](https://api-docs.zoominfo.com/rate-limits)

### Internal Documentation
- [Master Integration Guide](./MASTER_INTEGRATION_GUIDE.md)
- [Troubleshooting Integrations](./TROUBLESHOOTING_INTEGRATIONS.md)
- [Field Mapping Guide](./FIELD_MAPPING_GUIDE.md)

### Support
- **ZoomInfo Support:** support@zoominfo.com
- **API Issues:** api-support@zoominfo.com
- **Your CSM:** Contact via ZoomInfo dashboard
- **Application Support:** Settings → Integration Health → "Report Issue"

---

## Success Checklist

After completing this setup, you should be able to:
- [ ] Connect to ZoomInfo with valid API key
- [ ] Calculate total available accounts matching your ICP
- [ ] See "Database" count on Executive Dashboard
- [ ] Enrich a single account with missing data
- [ ] Run bulk enrichment on all accounts
- [ ] Discover contacts at high-fit accounts
- [ ] Monitor credit usage and stay within limits
- [ ] Troubleshoot common errors independently
- [ ] View enrichment attribution (which data came from ZoomInfo)

---

## Next Steps

1. **Complete Apollo.io Setup** - [Apollo Setup Guide](./APOLLO_SETUP.md)
2. **Enable Waterfall Enrichment** - Try multiple providers in sequence
3. **Set Up Scheduled Jobs** - [CRON Setup Guide](./CRON_SETUP_INSTRUCTIONS.md)
4. **Configure ICP Scoring** - Settings → Scoring Configuration

---

**Last Updated:** 2025-11-06  
**Version:** 1.0  
**Maintained By:** Integration Team
