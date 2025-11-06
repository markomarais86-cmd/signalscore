# Apollo.io Setup Guide

## Overview

Apollo.io is an all-in-one B2B sales intelligence and engagement platform with over 275 million contacts and 73 million companies. This integration allows you to:
- Calculate total available accounts matching your ICP in Apollo's database
- Enrich accounts with firmographic data (better coverage for SMBs than ZoomInfo)
- Discover and verify contact information
- Track Apollo coverage vs your CRM

**Use Case:** "Show me all available SMB software companies in Apollo that match our ICP"

**Why Apollo?**
- **Best for SMBs:** Better coverage for companies with 10-200 employees
- **Cost-effective:** Lower credit costs than ZoomInfo
- **Global coverage:** Strong coverage in APAC, EMEA, LATAM
- **Built-in verification:** Email verification included
- **Intent signals:** Technographic data and buying intent signals

---

## Prerequisites

### Required
- **Active Apollo.io account** with API access
  - Free tier: 60 credits/month (limited API access)
  - Basic: 120 credits/month + API
  - Professional: 600 credits/month + API (recommended)
  - Organization: Custom credits + API
- **API access enabled** on your plan
  - Free tier has limited API endpoints
  - Professional or higher recommended for full integration

### Verify Your Access
1. Log into [Apollo.io](https://app.apollo.io/)
2. Click your profile picture (bottom left)
3. Go to **Settings** → **API**
4. If you see "API access not available", upgrade to Professional plan
5. Contact support@apollo.io to enable API if you have a paid plan

---

## Step 1: Generate Apollo.io API Key

### Via Apollo.io Dashboard
1. **Log into Apollo.io** at https://app.apollo.io/

2. **Navigate to Settings**
   - Click your profile picture in the bottom left
   - Select **"Settings"**
   - Or go directly to https://app.apollo.io/#/settings

3. **Access API Section**
   - In the left sidebar, click **"API"**
   - Or scroll down to **"Integrations"** → **"API"**

4. **Generate API Key**
   - You should see a section called **"Your API Key"**
   - If no key exists, click **"Generate API Key"**
   - If a key already exists, you can:
     - Copy the existing key
     - Or click "Regenerate" for a new one (this will invalidate the old key)
   
5. **Copy Your API Key**
   - Click the **"Copy"** icon next to your API key
   - **IMPORTANT:** Save this key securely
   - Format: `XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` (32 alphanumeric characters)
   - You can always come back to view this key (unlike some providers)

### API Key Permissions
Apollo.io API keys have access to:
- ✅ Search API (organization search, people search)
- ✅ Enrichment API (company and contact enrichment)
- ✅ Export API (bulk data export)
- ✅ Email verification API

**Note:** API keys inherit the permissions of your user account. If you have admin access, the key has admin access.

---

## Step 2: Add API Key to Your Application

### Option A: Via Application UI (Recommended)
1. **Navigate to Settings**
   - In your application, click **Settings** in the left sidebar
   - Go to **Data Enrichment** tab

2. **Find Apollo.io Section**
   - Scroll to **"Apollo.io"** card
   - Click **"Configure"**

3. **Enter Your API Key**
   - Paste the API key you copied from Apollo
   - Click **"Save"**
   - Click **"Test Connection"** to verify

4. **Verify Connection Status**
   - Status should change to **"Connected ✓"**
   - Shows your plan type and available credits
   - If you see an error, check Troubleshooting section below

### Option B: Via Supabase Secrets (Manual)
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/settings/functions)
2. Click **"Edge Function Secrets"**
3. Click **"Add new secret"**
4. Enter:
   - **Name:** `APOLLO_API_KEY`
   - **Value:** Your Apollo.io API key
5. Click **"Save"**
6. Restart edge functions (automatic)

---

## Step 3: Configure Apollo.io Integration

### Enable Total Available Count Tracking
Calculate how many companies in Apollo's database match your ICP.

1. **Define Your ICP First**
   - Go to **ICP Manager**
   - Create or edit your ICP with criteria:
     - Employee count range (e.g., 10-200 for SMBs)
     - Revenue range
     - Industries
     - Countries
     - Technologies used (Apollo has strong technographic data)
     - Keywords in company description

2. **Trigger Total Count Calculation**
   - Go to **Settings** → **External Integrations**
   - Find **"Apollo.io"** card
   - Click **"Calculate Available Accounts"**
   - System queries Apollo's organization search API with your ICP filters

3. **View Results**
   - Total available accounts appear on Apollo.io card
   - Also visible on **Executive Dashboard**:
     - "CRM Accounts" vs "Database Accounts"
     - Database count includes Apollo results

### Enable Auto-Enrichment
Automatically enrich new accounts with Apollo data:
1. **Settings** → **Data Enrichment** → **Apollo.io**
2. Toggle **"Auto-enrich new accounts"** to ON
3. Configure enrichment rules:
   - **Trigger:** When new account added with domain
   - **Priority:** Second priority (after ZoomInfo) in waterfall
   - **Fields to enrich:** Employee count, revenue, industry, technologies
   - **Verify emails:** Enable to verify contact emails during enrichment

### Configure Waterfall Enrichment
Use Apollo as a fallback when ZoomInfo has no data:
1. **Settings** → **Data Enrichment** → **Waterfall Settings**
2. Set enrichment order:
   - 1️⃣ ZoomInfo (try first - most comprehensive)
   - 2️⃣ **Apollo.io (fallback)**
   - 3️⃣ Clearbit (last resort)
3. **Benefits:**
   - Saves ZoomInfo credits for larger companies
   - Uses Apollo for SMB coverage
   - Maximizes data coverage

---

## How the Integration Works

### 1. Total Available Count Calculation
**Purpose:** "How many companies in Apollo match our ICP?"

**How it works:**
1. Your ICP criteria are converted to Apollo Search API parameters:
   ```json
   {
     "person_titles": [],
     "q_organization_domains": [],
     "organization_num_employees_ranges": ["10,50", "51,200"],
     "organization_locations": ["United States"],
     "organization_industry_tag_ids": ["5567cd4773696439b10b0000"],
     "per_page": 1,
     "page": 1
   }
   ```

2. System calls Apollo Organization Search API
3. Apollo returns `pagination.total_entries` (total matching companies)
4. This count is stored in `external_data_sources.total_accounts`
5. Displayed on Executive Dashboard

**Refresh Frequency:** Weekly automatic refresh, or manual via "Refresh Counts" button

### 2. Account Enrichment
**Purpose:** Fill in missing firmographic data, especially for SMBs

**Enrichment Process:**
1. Account identified as needing enrichment (missing employee_count or revenue)
2. System calls Apollo Organization Enrichment API with domain:
   ```
   POST https://api.apollo.io/v1/organizations/enrich
   {
     "domain": "acmecorp.com"
   }
   ```

3. Apollo returns enrichment data:
   ```json
   {
     "organization": {
       "name": "Acme Corp",
       "website_url": "acmecorp.com",
       "industry": "Computer Software",
       "estimated_num_employees": 75,
       "annual_revenue": 5000000,
       "phone": "+1-555-0100",
       "founded_year": 2015,
       "technologies": ["React", "AWS", "Salesforce"],
       "keywords": ["B2B SaaS", "Marketing Automation"]
     }
   }
   ```

4. System updates account record with enriched data
5. Triggers ICP scoring with new data

**Credit Cost:** 1 credit per company enriched

### 3. Contact Discovery
**Purpose:** Find verified contacts at target accounts

**How it works:**
1. High-fit account identified (ICP score > 70) with no contacts
2. System calls Apollo People Search API:
   ```json
   {
     "organization_domains": ["acmecorp.com"],
     "person_titles": ["VP Sales", "Director of Sales", "Chief Revenue Officer"],
     "person_seniority": ["VP", "Director", "C-Suite"],
     "per_page": 10
   }
   ```

3. Apollo returns list of contacts:
   ```json
   {
     "people": [
       {
         "name": "John Smith",
         "title": "VP of Sales",
         "email": "john.smith@acmecorp.com",
         "email_status": "verified",
         "linkedin_url": "https://linkedin.com/in/johnsmith",
         "phone_numbers": ["+1-555-0123"]
       }
     ]
   }
   ```

4. Contacts inserted into `leads` table
5. Email verification status tracked

**Credit Cost:** 1 credit per contact email exported

### 4. Technographic Enrichment
**Unique to Apollo:** Technology stack tracking

**How it works:**
1. During company enrichment, Apollo provides `technologies` array
2. System stores technologies in `account_technologies` table
3. Used for:
   - ICP scoring bonus (uses our tech stack = higher fit)
   - Competitive analysis (uses competitor's product)
   - Sales intelligence (know their tools before outreach)

**Example Technologies Tracked:**
- CRM: Salesforce, HubSpot, Pipedrive
- Marketing: Marketo, Pardot, Mailchimp
- Infrastructure: AWS, Google Cloud, Azure
- Analytics: Google Analytics, Mixpanel, Amplitude

---

## API Rate Limits & Quotas

### Rate Limits (API Calls)
Apollo has generous rate limits compared to other providers:
- **Search API:** 200 requests/minute
- **Enrichment API:** 200 requests/minute
- **People Search:** 200 requests/minute

**Handling in App:**
- Built-in rate limiting with exponential backoff
- Batch processing to optimize API usage
- Automatic retry on rate limit errors

### Credit Quotas
Apollo charges credits for data exports (not searches):
- **Organization Search:** Free (no credits charged)
- **Organization Enrichment:** 1 credit per company
- **People Search (view only):** Free
- **People Email Export:** 1 credit per email
- **Email Verification:** Included free

**Credit Allocation by Plan:**
- Free: 60 credits/month
- Basic: 120 credits/month ($49/month)
- Professional: 600 credits/month ($99/month)
- Organization: Custom (starts at 2,000+)

**Check Credit Balance:**
- Apollo Dashboard → Settings → Billing → Credit Usage
- Or in app: Settings → External Integrations → Apollo card shows remaining credits

**Managing Credits:**
- Set monthly enrichment limits in app
- Prioritize high-fit accounts (ICP score > 70)
- Use Apollo for SMBs, ZoomInfo for enterprises
- Contact discovery uses more credits - be selective

---

## Testing Your Integration

### Pre-Test Checklist
- [ ] Apollo.io API key added to application
- [ ] Connection status shows "Connected ✓"
- [ ] Credit balance visible and >50 credits remaining
- [ ] ICP defined with specific criteria
- [ ] At least 1 test account with domain

### Test 1: Connection Test
1. **Settings** → **Data Enrichment** → **Apollo.io**
2. Click **"Test Connection"**
3. **Expected Result:**
   - ✅ Success: "Apollo.io connection successful"
   - Shows plan type (Professional, Basic, etc.)
   - Shows remaining credits (e.g., "450 of 600 credits remaining")
   - Status badge turns green
4. **If Failed:** See Troubleshooting section

### Test 2: Total Available Count
1. **Settings** → **External Integrations** → **Apollo.io**
2. Click **"Calculate Available Accounts"**
3. **Expected Result:**
   - Progress: "Querying Apollo database..."
   - Result: "Found 3,452 companies matching your ICP"
   - Number appears on Apollo card
   - Updates Executive Dashboard "Database" count
4. **Typical Results by ICP:**
   - Very restrictive ICP: 500-2,000 companies
   - Moderate ICP: 5,000-20,000 companies
   - Broad ICP: 50,000+ companies
5. **If Zero Results:** Your ICP may be too restrictive, or Apollo doesn't cover that segment well

### Test 3: Single Account Enrichment
1. **Create Test Account:**
   - Go to **Accounts** page → **Add Account**
   - Enter:
     - Name: `Test SMB Company`
     - Domain: `shopify.com` (known good domain in Apollo)
     - Leave employee_count and revenue blank
   - Save

2. **Trigger Enrichment:**
   - Click **"Enrich"** button on the account row
   - Select "Apollo.io" as provider (or use auto-select)

3. **Expected Result:**
   - Progress: "Enriching via Apollo..."
   - After 3-5 seconds:
     - ✅ Employee count filled (e.g., ~7,000)
     - ✅ Revenue filled (e.g., $500M-$1B)
     - ✅ Industry: "E-commerce"
     - ✅ Technologies: React, Ruby, MySQL, etc.
     - ✅ Badge: "Enriched by Apollo.io"
     - ✅ Credit count decreases by 1
   
4. **Verify Enrichment Quality:**
   - Check if data is reasonable
   - View enrichment source: Click account → "Data Sources" tab
   - See enrichment timestamp

### Test 4: Contact Discovery
1. **Find High-Fit Account** (ICP score > 70) with no contacts
   - Or use your test account from Test 3

2. **Discover Contacts:**
   - Click **"Discover Contacts"** button
   - Modal opens: "Define your target persona"
   - Select titles: "VP Sales", "Director Sales Operations"
   - Select seniority: "VP", "Director"
   - Click **"Search Apollo"**

3. **Expected Result:**
   - Progress: "Searching Apollo for contacts..."
   - Result: List of 5-10 contacts found
   - Each contact shows:
     - Name
     - Title
     - Email (with verification status: ✅ Verified, ⚠️ Likely, ❌ Invalid)
     - LinkedIn URL
     - Phone number (if available)

4. **Import Contacts:**
   - Select 2-3 contacts to import
   - Click **"Import Selected"** (costs 1 credit per email)
   - Contacts added to **Leads** table
   - Credit count decreases

5. **Verify Contacts:**
   - Go to **Leads** page
   - Filter by account name
   - Verify contact data imported correctly
   - Check email verification status

### Test 5: Technographic Enrichment
1. **Enrich Account with Known Tech Stack:**
   - Use domain: `hubspot.com` (known to use many tools)
   - Click **"Enrich"** → Select Apollo

2. **View Technologies:**
   - Click on the account
   - Go to **"Technologies"** tab
   - Expected: List of 20+ technologies
     - Salesforce (CRM)
     - Marketo (Marketing)
     - AWS (Infrastructure)
     - Google Analytics
     - Etc.

3. **Verify ICP Scoring:**
   - If your ICP includes "Uses Salesforce"
   - Account should get bonus points for tech match
   - Check ICP score breakdown

---

## Troubleshooting

### Error: "Invalid API Key"
**Symptoms:**
- Connection test fails
- Error: "Authentication failed" or "Invalid API key"

**Solutions:**
1. **Verify API key is correct:**
   - Log into Apollo → Settings → API
   - Copy key again (watch for extra spaces)
   - Paste into app and save

2. **Check API access enabled:**
   - Apollo Settings → Billing
   - Verify you have Professional plan or higher
   - Free/Basic plans have limited API access
   - Upgrade if necessary

3. **Regenerate API key:**
   - Apollo Settings → API → "Regenerate Key"
   - Update in your application
   - Test again

4. **Check Supabase secret:**
   - Supabase Dashboard → Edge Function Secrets
   - Verify `APOLLO_API_KEY` exists
   - Value should be 32 characters, alphanumeric

### Error: "Credit Limit Reached"
**Symptoms:**
- Enrichment stops mid-job
- Error: "Insufficient credits"
- Credit balance shows 0

**Solutions:**
1. **Check credit balance:**
   - Apollo Dashboard → Settings → Billing → Credit Usage
   - See when credits reset (monthly on billing date)

2. **Purchase additional credits:**
   - Apollo Settings → Billing → Buy Credits
   - One-time credit packs available
   - Or upgrade to higher plan

3. **Temporarily disable auto-enrichment:**
   - Settings → Data Enrichment → Apollo
   - Toggle OFF "Auto-enrich"
   - Wait for monthly credit reset

4. **Prioritize enrichment:**
   - Only enrich accounts with ICP score > 70
   - Use Apollo for SMBs only (10-200 employees)
   - Use ZoomInfo for larger companies

### Error: "No Data Found" for Company
**Symptoms:**
- Enrichment completes but no data filled in
- Message: "Company not found in Apollo database"

**Solutions:**
1. **Check domain format:**
   - Should be: `acmecorp.com` (no www, no https)
   - No trailing slashes
   - Correct TLD (.com, .io, .co.uk, etc.)

2. **Apollo coverage gaps:**
   - **Best coverage:** US/Canada B2B tech companies, 10-500 employees
   - **Good coverage:** EU, APAC B2B companies
   - **Limited coverage:** 
     - Very small companies (<10 employees)
     - Non-B2B businesses (retail, restaurants)
     - Government, non-profits
     - Very new companies (<6 months old)

3. **Try alternative domain:**
   - Some companies use multiple domains
   - Try parent company domain
   - Try international domain (e.g., .co.uk instead of .com)

4. **Use waterfall enrichment:**
   - Enable ZoomInfo or Clearbit as backup
   - Settings → Data Enrichment → Enable waterfall
   - System automatically tries next provider if Apollo fails

### Error: "Rate Limit Exceeded"
**Symptoms:**
- Enrichment slows down
- Error: "Too many requests, retry in X seconds"

**Solutions:**
1. **This is rare with Apollo** (200 req/min is very high)
2. **If it happens:**
   - System automatically retries after delay
   - No action needed from you
3. **If persistent:**
   - Check if you're running multiple enrichment jobs simultaneously
   - Settings → Data Enrichment → Advanced
   - Set "Max concurrent requests" to 10 (default: 20)

### Error: "Email Verification Failed"
**Symptoms:**
- Contact imported but email status shows "Invalid"
- Warning: "Email may be incorrect"

**Solutions:**
1. **This is expected behavior:**
   - Apollo verifies emails in real-time
   - Some emails are invalid (job changes, typos)
   - Invalid emails marked with ❌ status

2. **Filtering invalid emails:**
   - Leads page → Filter → Email Status → "Verified only"
   - Don't use invalid emails for outreach
   - Consider re-searching for that account

3. **Re-verify emails:**
   - Select lead(s) with "Likely" status
   - Click "Re-verify Email"
   - Apollo does fresh verification check

4. **Update email in Apollo:**
   - If you know correct email
   - Log into Apollo
   - Find the person, suggest edit
   - Helps improve data quality

### Error: "Organization Not Found" on Search
**Symptoms:**
- Total available count returns 0
- Can't find companies that should exist

**Solutions:**
1. **Check ICP criteria:**
   - May be too restrictive
   - Try widening employee range
   - Remove country filter temporarily
   - Test with broader industry tags

2. **Apollo industry tags differ:**
   - Apollo uses custom industry taxonomy
   - "Computer Software" instead of just "Software"
   - Review available industries: Apollo Settings → Saved Searches → Industry dropdown
   - Update ICP with correct Apollo industry names

3. **Test in Apollo directly:**
   - Go to Apollo → Search → Organizations
   - Enter your ICP criteria manually
   - See what results you get
   - Adjust criteria in app to match

---

## Best Practices

### 1. Credit Management
- **Monitor credits daily** in peak usage periods
- **Set alerts** at 20% remaining credits
- **Buy credit packs** during promotions (Apollo runs sales)
- **Use Apollo strategically:**
  - SMBs and mid-market (10-500 employees)
  - APAC/EMEA companies (better coverage than ZoomInfo)
  - Technographic intelligence (unique to Apollo)

### 2. Data Quality
- **Verify domains** before enriching (use domain normalizer)
- **Enable duplicate detection** to avoid wasting credits
- **Review enrichment accuracy** weekly
- **Report bad data** to Apollo (helps improve their DB)

### 3. Contact Discovery
- **Define personas clearly** (specific titles, not generic)
- **Limit to 3-5 contacts per account** to save credits
- **Prioritize verified emails** (✅ status)
- **Use LinkedIn URLs** for social selling

### 4. Technographic Intelligence
- **Track competitor tech stacks** for competitive intel
- **Identify "uses our tech" for expansion opportunities**
- **Target accounts using complementary tools** (better fit)
- **Use tech signals for prioritization** (recent tech changes = buying mode)

### 5. Waterfall Strategy
- **Use ZoomInfo first** for enterprises (1000+ employees)
- **Use Apollo second** for SMBs and mid-market
- **Use Clearbit last** for global coverage
- **Result:** 90%+ enrichment coverage, optimal cost

---

## Cost Estimation

### Typical Usage Example
**Scenario:** 1,000 accounts in CRM, 60% are SMBs (10-200 employees)

**Apollo Costs:**
- Total available count query: Free (no credits)
- Company enrichment: 600 SMBs × 1 credit = 600 credits
- Contact discovery: 100 high-fit accounts × 3 contacts × 1 credit = 300 credits
- **Total: 900 credits**

**Monthly Costs:**
- Professional plan: 600 credits + $99/month
- Buy 300 additional credits: ~$50
- **Total: ~$150/month**

**Comparison:**
- ZoomInfo: Same usage = ~$400/month
- **Savings with Apollo for SMBs: ~60%**

---

## Apollo vs ZoomInfo: When to Use Which?

| Factor | Use Apollo | Use ZoomInfo |
|--------|-----------|-------------|
| **Company Size** | 10-500 employees | 500+ employees |
| **Geography** | Global, esp. APAC | US/Canada focused |
| **Industry** | Tech, SaaS, Services | All industries |
| **Data Type** | Technographics, intent | Comprehensive firmographics |
| **Cost** | Lower ($99-$299/mo) | Higher ($300-$1000/mo) |
| **Credits** | 600-2000/month | 2000-10000/month |
| **Email Accuracy** | 85-90% verified | 80-85% |
| **Contact Discovery** | Excellent for SMB | Excellent for Enterprise |

**Best Practice:** Use both in waterfall for 95%+ coverage at optimal cost

---

## Additional Resources

### Apollo.io Documentation
- [Apollo API Documentation](https://apolloio.github.io/apollo-api-docs/)
- [Organization Search API](https://apolloio.github.io/apollo-api-docs/?shell#organization-search)
- [People Search API](https://apolloio.github.io/apollo-api-docs/?shell#people-search)
- [Rate Limits](https://apolloio.github.io/apollo-api-docs/?shell#rate-limiting)

### Internal Documentation
- [Master Integration Guide](./MASTER_INTEGRATION_GUIDE.md)
- [ZoomInfo Setup](./ZOOMINFO_SETUP.md) - Compare features
- [Troubleshooting Integrations](./TROUBLESHOOTING_INTEGRATIONS.md)

### Support
- **Apollo Support:** support@apollo.io
- **Live Chat:** Available in Apollo dashboard (bottom right)
- **Help Center:** https://help.apollo.io/
- **Application Support:** Settings → Integration Health → "Report Issue"

---

## Success Checklist

After completing this setup, you should be able to:
- [ ] Connect to Apollo with valid API key
- [ ] See current credit balance
- [ ] Calculate total available SMB accounts in Apollo
- [ ] Enrich a single account with employee count, revenue, and technologies
- [ ] Run bulk enrichment on 100+ accounts
- [ ] Discover verified contacts with email and phone
- [ ] View technographic data (tech stack) for enriched accounts
- [ ] Monitor credit usage and stay within monthly limits
- [ ] Handle enrichment failures gracefully with waterfall
- [ ] Compare Apollo results vs ZoomInfo on Executive Dashboard

---

## Next Steps

1. **Set Up Waterfall Enrichment** - Configure ZoomInfo → Apollo → Clearbit
2. **Enable Auto-Enrichment** - For SMB accounts only (10-500 employees)
3. **Configure ICP Bonuses** - Award points for tech stack matches
4. **Set Up Clearbit** - [Clearbit Setup Guide](./CLEARBIT_SETUP.md)
5. **Schedule Weekly Enrichment** - [CRON Setup Guide](./CRON_SETUP_INSTRUCTIONS.md)

---

**Last Updated:** 2025-11-06  
**Version:** 1.0  
**Maintained By:** Integration Team
