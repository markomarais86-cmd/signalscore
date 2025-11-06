# People Data Labs (PDL) Setup Guide

## Overview

People Data Labs (PDL) is a B2B person and company data API with over 3 billion person records and 300+ million company profiles. Unlike other enrichment providers, PDL specializes in **person-level enrichment** and offers raw data that you can build on top of.

This integration allows you to:
- Enrich contacts/leads with job title, seniority, and persona information
- Discover contacts at target accounts with verified emails
- Enrich companies with employee count and industry data (as fallback)
- Access deep person data (education, skills, social profiles)

**Use Case:** "Find all VP Sales contacts at Series A-funded SaaS companies in the US"

**Why PDL?**
- **Deepest person data:** 50+ fields per person (education, skills, experience)
- **Best contact discovery:** Find people by job title, seniority, location
- **Developer-friendly:** RESTful API, excellent docs
- **Flexible pricing:** Pay per record, no minimum commitment
- **High accuracy:** Data sourced from 800+ sources, validated regularly

---

## Prerequisites

### Required
- **People Data Labs account** with API key
  - Free tier: 1,000 credits (great for testing)
  - No credit card required for free tier
  - Production: Pay-as-you-go or monthly plans

### Plans Overview

| Plan | Monthly Cost | Credits | Best For |
|------|-------------|---------|----------|
| **Free** | $0 | 1,000 | Testing, small projects |
| **Pay-as-you-go** | Variable | $0.015/credit | Low volume, unpredictable usage |
| **Starter** | $499/mo | 40,000 | Growing teams |
| **Professional** | $999/mo | 100,000 | High-volume enrichment |
| **Enterprise** | Custom | Custom | Bulk data licensing |

**Credit Costs:**
- Person enrichment: 1 credit per person
- Person search: 1 credit per person returned
- Company enrichment: 1 credit per company
- Company search: 1 credit per company returned

---

## Step 1: Create PDL Account & Get API Key

### Option A: Self-Service Signup (Free Tier)
1. **Go to PDL Website**
   - Navigate to https://www.peopledatalabs.com/
   - Click **"Get Started Free"**

2. **Create Account**
   - Enter your work email
   - Create password
   - Verify email (check inbox for verification link)

3. **Access Dashboard**
   - After verification, log into https://dashboard.peopledatalabs.com/
   - You'll see the **Dashboard** with your usage stats

4. **Get Your API Key**
   - In the dashboard, click **"API Keys"** in the left sidebar
   - Or go directly to: https://dashboard.peopledatalabs.com/api-keys
   - You'll see your default API key
   - Click **"Copy"** to copy to clipboard
   - Format: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (40 characters)

5. **Free Credits**
   - New accounts get **1,000 free credits**
   - No credit card required
   - Great for testing integration
   - Credits don't expire

### Option B: Contact Sales (Enterprise)
If you need high volume or custom pricing:
1. Go to https://www.peopledatalabs.com/contact
2. Select **"I need data"**
3. Fill out form with requirements
4. Sales team will contact you within 24 hours
5. They'll provision your account and provide API key

---

## Step 2: Add API Key to Your Application

### Option A: Via Application UI (Recommended)
1. **Navigate to Settings**
   - In your application, click **Settings** in the left sidebar
   - Go to **Data Enrichment** tab

2. **Find People Data Labs Section**
   - Scroll to **"People Data Labs"** card
   - Click **"Configure"**

3. **Enter Your API Key**
   - Paste your PDL API key
   - Click **"Save"**
   - Click **"Test Connection"** to verify

4. **Verify Connection Status**
   - Status should change to **"Connected ✓"**
   - Shows remaining credits (e.g., "950 of 1,000 credits")
   - If error, see Troubleshooting section

### Option B: Via Supabase Secrets (Manual)
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/dhyfbaptcprxxixgnpby/settings/functions)
2. Click **"Edge Function Secrets"**
3. Click **"Add new secret"**
4. Enter:
   - **Name:** `PDL_API_KEY`
   - **Value:** Your PDL API key
5. Click **"Save"**

---

## Step 3: Configure PDL Integration

### Enable Contact Enrichment
PDL's primary use case is enriching contact/lead records:

1. **Settings** → **Data Enrichment** → **People Data Labs**
2. Toggle **"Auto-enrich contacts"** to ON
3. Configure enrichment rules:
   - **Trigger:** When new lead created with email
   - **Fields to enrich:** Title, seniority, persona, LinkedIn URL
   - **Fallback:** If title missing, use AI to infer from LinkedIn

### Enable Contact Discovery
Find contacts at target accounts:

1. **Settings** → **Contact Discovery** → **People Data Labs**
2. Toggle **"Contact discovery"** to ON
3. Define target personas:
   - Job titles: ["VP Sales", "Director Sales Operations", "CRO"]
   - Seniority levels: ["VP", "Director", "C-Suite"]
   - Management level: "Manager" or higher
4. Set limits:
   - Max contacts per account: 5
   - Only discover for high-fit accounts (ICP score > 70)

### Configure Company Enrichment (Optional)
PDL can also enrich companies as a fallback:

1. **Settings** → **Data Enrichment** → **Waterfall**
2. Add PDL to company enrichment waterfall:
   - 1️⃣ ZoomInfo
   - 2️⃣ Apollo
   - 3️⃣ Clearbit
   - 4️⃣ **People Data Labs (last resort)**

**Note:** PDL's company data is not as comprehensive as ZoomInfo/Apollo, but it's useful as a final fallback.

---

## How the Integration Works

### 1. Person Enrichment API
**Purpose:** Enrich contact/lead with detailed person data

**How it works:**
1. New lead created with email: `john.smith@acmecorp.com`
2. System calls PDL Person Enrichment API:
   ```
   GET https://api.peopledatalabs.com/v5/person/enrich
   ?api_key=YOUR_API_KEY
   &email=john.smith@acmecorp.com
   ```

3. PDL returns enrichment data:
   ```json
   {
     "status": 200,
     "data": {
       "full_name": "John Smith",
       "first_name": "John",
       "last_name": "Smith",
       "job_title": "VP of Sales",
       "job_title_role": "sales",
       "job_title_sub_role": "vice president",
       "job_title_levels": ["vp", "c_suite"],
       "job_company_name": "Acme Corp",
       "job_company_website": "acmecorp.com",
       "linkedin_url": "linkedin.com/in/johnsmith",
       "linkedin_username": "johnsmith",
       "mobile_phone": "+1-555-0123",
       "work_email": "john.smith@acmecorp.com",
       "emails": [
         {"address": "john.smith@acmecorp.com", "type": "professional"}
       ],
       "experience": [
         {
           "company": "Acme Corp",
           "title": "VP Sales",
           "start_date": "2020-01",
           "is_current": true
         },
         {
           "company": "Previous Company",
           "title": "Director of Sales",
           "start_date": "2017-06",
           "end_date": "2019-12"
         }
       ],
       "education": [
         {
           "school": "Stanford University",
           "degrees": ["MBA"],
           "end_date": "2015"
         }
       ],
       "skills": ["Sales Leadership", "SaaS", "B2B Sales"],
       "interests": ["Technology", "Startups"],
       "location_name": "San Francisco, California",
       "location_country": "United States",
       "countries": ["United States"]
     }
   }
   ```

4. System maps PDL data to your schema:
   - `job_title` → `title`
   - `job_title_role` → `persona` (sales, marketing, engineering, etc.)
   - `job_title_levels` → `seniority`
   - `linkedin_url` → `linkedin_url`
   - `mobile_phone` → `phone`

5. Lead record updated with enriched data

**Credit Cost:** 1 credit per successful enrichment

### 2. Person Search API
**Purpose:** Discover contacts at target accounts

**How it works:**
1. High-fit account identified: `acmecorp.com` (ICP score: 85)
2. Account has no contacts/leads
3. System calls PDL Person Search API:
   ```json
   POST https://api.peopledatalabs.com/v5/person/search
   {
     "api_key": "YOUR_API_KEY",
     "query": {
       "bool": {
         "must": [
           {"term": {"job_company_website": "acmecorp.com"}},
           {"terms": {"job_title_role": ["sales", "business_development"]}},
           {"terms": {"job_title_levels": ["vp", "director", "c_suite"]}}
         ]
       }
     },
     "size": 5
   }
   ```

4. PDL returns list of matching contacts:
   ```json
   {
     "status": 200,
     "total": 12,
     "data": [
       {
         "full_name": "John Smith",
         "job_title": "VP of Sales",
         "work_email": "john.smith@acmecorp.com",
         "linkedin_url": "linkedin.com/in/johnsmith",
         "mobile_phone": "+1-555-0123"
       },
       {
         "full_name": "Sarah Johnson",
         "job_title": "Director of Sales Operations",
         "work_email": "sarah.j@acmecorp.com",
         "linkedin_url": "linkedin.com/in/sarahjohnson"
       }
     ]
   }
   ```

5. Contacts inserted into `leads` table linked to account
6. Contacts marked with source: "Discovered via PDL"

**Credit Cost:** 1 credit per contact returned (5 contacts = 5 credits)

### 3. Company Enrichment API (Fallback)
**Purpose:** Enrich company when other providers fail

**How it works:**
1. Account needs enrichment: `startup.io`
2. ZoomInfo, Apollo, Clearbit all failed (company not found)
3. System calls PDL Company Enrichment API:
   ```
   GET https://api.peopledatalabs.com/v5/company/enrich
   ?api_key=YOUR_API_KEY
   &website=startup.io
   ```

4. PDL returns company data:
   ```json
   {
     "status": 200,
     "name": "Startup Inc",
     "website": "startup.io",
     "size": "51-200",
     "employee_count": 75,
     "industry": "Computer Software",
     "location": {
       "name": "San Francisco, California",
       "country": "United States"
     },
     "linkedin_url": "linkedin.com/company/startup-inc",
     "founded": 2018
   }
   ```

5. Account updated with PDL data

**Credit Cost:** 1 credit per company enriched

---

## API Rate Limits & Quotas

### Rate Limits
PDL has very generous rate limits:
- **All APIs:** 1,000 requests/minute
- **Burst:** Up to 10,000 requests/minute for short periods
- **No daily limits**

**This is rarely an issue** - The bottleneck is your credit quota, not rate limits.

### Credit Quotas
Your credits depend on your plan:
- Free: 1,000 credits (one-time)
- Pay-as-you-go: No limit (billed per credit)
- Starter: 40,000 credits/month
- Professional: 100,000 credits/month

**Tracking Credits:**
- PDL Dashboard: https://dashboard.peopledatalabs.com/usage
- Shows: Credits used today, this month, all-time
- In app: Settings → External Integrations → PDL card shows remaining credits

**What Counts as a Credit:**
- ✅ Person enrichment (data found): 1 credit
- ✅ Person search (per result): 1 credit
- ✅ Company enrichment (data found): 1 credit
- ❌ Person not found (404): 0 credits (free!)
- ❌ Invalid request (400): 0 credits

**Managing Credits:**
- Set monthly limits in app (e.g., 800 of 1,000 on free tier)
- Prioritize high-fit accounts for contact discovery
- Use PDL primarily for person data (its strength)
- Use ZoomInfo/Apollo for company enrichment (more comprehensive)

---

## Testing Your Integration

### Pre-Test Checklist
- [ ] PDL API key added to application
- [ ] Connection status shows "Connected ✓"
- [ ] Remaining credits visible (e.g., "950 of 1,000")
- [ ] At least 1 test lead with email

### Test 1: Connection Test
1. **Settings** → **Data Enrichment** → **People Data Labs**
2. Click **"Test Connection"**
3. **Expected Result:**
   - ✅ "PDL connection successful"
   - Shows remaining credits: "1,000 credits remaining"
   - Status badge: Green
4. **If Failed:** See Troubleshooting

### Test 2: Person Enrichment
1. **Create Test Lead:**
   - Go to **Leads** → **Add Lead**
   - Enter:
     - First name: `Satya`
     - Last name: `Nadella`
     - Email: `satya.nadella@microsoft.com` (well-known person, guaranteed in PDL)
   - Leave title, seniority, persona blank
   - Save

2. **Trigger Enrichment:**
   - On lead row, click **"Enrich"**
   - Select **"People Data Labs"** as provider

3. **Expected Result (within 1-2 seconds):**
   - ✅ Title: "CEO" or "Chief Executive Officer"
   - ✅ Seniority: "C-Suite"
   - ✅ Persona: "Executive"
   - ✅ LinkedIn: linkedin.com/in/satyanadella
   - ✅ Phone: (may or may not be available)
   - ✅ Badge: "Enriched by PDL"
   - ✅ Credits decrease by 1

4. **Verify Data Quality:**
   - Click lead → "Details" tab
   - See enrichment timestamp
   - Check all fields filled correctly

### Test 3: Person Not Found (404)
Test how system handles people not in PDL:

1. **Create Test Lead:**
   - First name: `Test`
   - Last name: `Person`
   - Email: `test.person@thiswillnotexist12345.com`
   - Save

2. **Trigger Enrichment:**
   - Click "Enrich" → Select "PDL"

3. **Expected Result:**
   - Message: "Person not found in PDL database"
   - Lead remains unenriched
   - ✅ **IMPORTANT:** Credits NOT decreased (404s are free)
   - Badge: "Enrichment failed - Not found"

### Test 4: Contact Discovery
1. **Find High-Fit Account** (ICP score > 70) with no contacts
   - Or create test account: Domain = `stripe.com`

2. **Discover Contacts:**
   - Click **"Discover Contacts"** button
   - Modal: "Define your target persona"
   - Select:
     - Titles: "VP Sales", "Director Sales"
     - Seniority: "VP", "Director"
   - Click **"Search PDL"**

3. **Expected Result:**
   - Progress: "Searching PDL for contacts..."
   - Result: List of 5-10 contacts (depends on company size)
   - Each contact shows:
     - Name
     - Title
     - Email (if available)
     - LinkedIn URL
     - Phone (if available)

4. **Import Contacts:**
   - Select 3 contacts
   - Click **"Import Selected"** (costs 3 credits)
   - Contacts added to **Leads** table

5. **Verify:**
   - Go to **Leads** page
   - Filter by account = "Stripe"
   - See 3 new contacts with enriched data
   - Credits decreased by 3

### Test 5: Bulk Contact Enrichment
1. **Create 10 Test Leads:**
   - Use real emails from LinkedIn
   - Example: Find 10 sales VPs on LinkedIn
   - Copy their emails into your app
   - Leave all fields except email blank

2. **Trigger Bulk Enrichment:**
   - Select all 10 leads
   - Click "Bulk Enrich" → Select "PDL"

3. **Expected Result:**
   - Job starts: "Enriching 10 contacts via PDL"
   - Progress bar shows: "7 of 10 enriched"
   - After 10-20 seconds: "Enrichment complete: 7 succeeded, 3 not found"

4. **Verify Results:**
   - Leads page refreshed
   - 7 leads have title, seniority, LinkedIn filled in
   - 3 leads marked "Not found in PDL"
   - Credits decreased by 7 (not 10, because 3 were 404s)

---

## Troubleshooting

### Error: "Invalid API Key"
**Symptoms:**
- Connection test fails
- Error: "401 Unauthorized" or "Invalid API key"

**Solutions:**
1. **Verify API key is correct:**
   - Log into PDL Dashboard: https://dashboard.peopledatalabs.com/api-keys
   - Copy API key again
   - Ensure you copied entire key (40 characters)
   - No spaces or line breaks

2. **Check API key is active:**
   - PDL Dashboard → API Keys
   - Verify key status is "Active" (not Disabled)
   - If disabled, re-enable or create new key

3. **Regenerate API key:**
   - PDL Dashboard → API Keys
   - Click "Regenerate" next to your key
   - Update in your application
   - Test again

4. **Verify Supabase secret:**
   - Supabase Dashboard → Edge Function Secrets
   - Check `PDL_API_KEY` value
   - Should be 40 characters, alphanumeric

### Error: "Credits Exhausted"
**Symptoms:**
- Enrichment fails with error "Insufficient credits"
- Error code: 402 Payment Required
- Message: "Credit balance is zero"

**Solutions:**
1. **Check credit balance:**
   - PDL Dashboard → Usage
   - See remaining credits
   - If zero, need to add credits

2. **Free tier exhausted:**
   - Free tier is 1,000 credits (one-time, non-renewing)
   - Once used, must upgrade to paid plan

3. **Add credits:**
   - **Pay-as-you-go:** PDL Dashboard → Billing → Add Credits
   - Buy in increments: $150 = 10,000 credits ($0.015/credit)
   - Credits available immediately

4. **Upgrade to monthly plan:**
   - PDL Dashboard → Billing → Change Plan
   - Starter: 40,000 credits/month for $499
   - Professional: 100,000 credits/month for $999
   - Better value if using >10,000 credits/month

5. **Temporarily disable:**
   - Settings → Data Enrichment → PDL
   - Toggle OFF auto-enrichment
   - Wait until credits added

### Error: "Person Not Found" (404)
**Symptoms:**
- Enrichment returns no data
- Message: "No records found for this email"

**Solutions:**
1. **This is expected** - PDL doesn't have everyone:
   - Not all emails are indexed
   - Very private individuals may opt out
   - New hires (job changes within last 3 months)
   - Non-B2B people (retail, hospitality, etc.)

2. **PDL coverage stats:**
   - ~85% of B2B professionals in US/UK/Canada
   - ~70% of B2B professionals in EU
   - ~50% in APAC/LATAM
   - Best for: Sales, Marketing, Engineering roles at 50+ employee companies

3. **Verify email is correct:**
   - Check for typos
   - Verify it's a work email (not personal Gmail)
   - Try alternate email if person has multiple

4. **Search by other fields:**
   - If you have LinkedIn URL, try enriching by that
   - PDL Person Enrichment supports:
     - Email
     - LinkedIn URL
     - Name + Company
     - Phone number

5. **Good news:** 404s don't cost credits

### Error: "Rate Limit Exceeded"
**Symptoms:**
- Error: "429 Too Many Requests"
- Message: "Rate limit exceeded, retry in X seconds"

**Solutions:**
1. **This is rare** (PDL allows 1,000 req/min)
2. **If it happens:**
   - System automatically retries with exponential backoff
   - No action needed from you
3. **If persistent:**
   - Check if multiple jobs running simultaneously
   - Settings → Advanced → Reduce concurrent requests to 50
   - Contact PDL support (they can increase your rate limit)

### Error: "Invalid Email Format"
**Symptoms:**
- Error: "400 Bad Request"
- Message: "Email must be valid format"

**Solutions:**
1. **Clean email data:**
   - Remove spaces, commas, semicolons
   - Verify format: `name@domain.com`
   - No invalid characters

2. **Use email validation:**
   - Settings → Data Quality → Enable email validation
   - System auto-cleans emails before sending to PDL

### Error: "Incorrect or Outdated Job Title"
**Symptoms:**
- Person enriched but title is old
- Shows previous company, not current

**Solutions:**
1. **PDL data freshness:**
   - Updated monthly from multiple sources
   - May lag reality by 1-2 months (especially recent job changes)

2. **Person changed jobs recently:**
   - Check LinkedIn for current title
   - Manually update in your system
   - Report to PDL for data update

3. **Report data quality issue:**
   - PDL Dashboard → Data Quality → Report Issue
   - Provide correct info
   - PDL will review and update

4. **Use "is_current" field:**
   - PDL returns `experience[].is_current` flag
   - System prioritizes current job title
   - Ignores historical titles

---

## Best Practices

### 1. Credit Management
- **Monitor credits daily** when approaching limit
- **Set alerts** at 20% remaining
- **Use PDL for people, not companies** (ZoomInfo/Apollo better for companies)
- **Free 404s** - Don't worry about failed lookups, they don't cost credits
- **Bulk operations** - Search returns multiple people for 1 search credit

### 2. Contact Discovery Strategy
**Define target personas clearly:**
- Use specific job titles: "VP of Sales" (not generic "Sales")
- Use seniority filters: "VP", "Director", "C-Suite"
- Use management level: "Manager or higher"
- Limit results to 5-10 per account (save credits)

**Prioritize accounts:**
- Only discover contacts for high-fit accounts (ICP score > 70)
- Focus on accounts in active sales stage
- Skip accounts with sufficient contacts already

### 3. Person Enrichment
**When to use PDL:**
- ✅ Enriching leads/contacts (PDL's strength)
- ✅ Assigning persona/seniority
- ✅ Finding LinkedIn URLs
- ✅ Verifying job titles
- ❌ Enriching companies (use ZoomInfo/Apollo instead)

**Enrichment triggers:**
- New lead/contact created with email
- Existing lead with missing title/persona
- Manual enrichment for VIP contacts

### 4. Data Quality
- **Validate emails** before enriching (save credits on invalid emails)
- **Deduplicate** before bulk enrichment
- **Review enrichments** weekly for accuracy
- **Report bad data** to PDL (helps improve their database)

### 5. Integration with CRM
**Sync PDL enrichment to CRM:**
- After PDL enriches a contact, sync updated fields to Salesforce/HubSpot
- Maps:
  - PDL `job_title` → CRM `Title`
  - PDL `job_title_role` → CRM Custom Field: `Persona__c`
  - PDL `linkedin_url` → CRM `LinkedIn__c`
- Keeps CRM data fresh with latest job changes

---

## Cost Estimation

### Example 1: Contact Discovery for 100 Accounts
**Scenario:** Find 5 sales contacts at each of 100 high-fit accounts

**PDL Cost:**
- 100 searches × 5 contacts × 1 credit = 500 credits
- Cost (pay-as-you-go): 500 × $0.015 = $7.50
- Cost (Starter plan): Included in $499/month (40,000 credits)

**Value:** 500 qualified leads with verified emails and titles

### Example 2: Enrich 1,000 Existing Leads
**Scenario:** Bulk enrich 1,000 leads in CRM with missing titles

**PDL Cost:**
- 1,000 enrichments (assume 80% found)
- Credits used: 800 (200 were 404s = free)
- Cost (pay-as-you-go): 800 × $0.015 = $12
- Cost (Starter plan): Included

**Value:** Complete lead data for better routing and prioritization

### Example 3: Free Tier for Testing
**Scenario:** Test PDL integration before committing

**PDL Cost:** $0 (free tier, 1,000 credits)
**What you can do:**
- Enrich 1,000 contacts (if 100% found)
- Or discover 200 contacts (5 per search, 200 searches)
- Or mix of both
**Value:** Fully test integration before spending money

---

## PDL vs Competitors

| Feature | PDL | ZoomInfo | Apollo | Clearbit |
|---------|-----|----------|--------|----------|
| **Person Data Depth** | ✅✅ Best | ✅ Good | ✅ Good | ⚠️ Limited |
| **Company Data** | ⚠️ Basic | ✅✅ Best | ✅ Good | ✅ Good |
| **Contact Discovery** | ✅✅ Best | ✅ Good | ✅ Good | ❌ No |
| **Free Tier** | ✅ 1,000 credits | ❌ No | ✅ 60 credits | ✅ 50/month |
| **Pricing** | $0.015/credit | $0.30-$0.50/credit | $0.10/credit | $0.20/credit |
| **Data Freshness** | Monthly | Quarterly | Monthly | Quarterly |
| **API Quality** | ✅✅ Excellent docs | ✅ Good | ✅ Good | ✅ Good |
| **Best For** | Contact enrichment | Enterprise accounts | SMB accounts | Real-time enrichment |

**Recommendation for this app:**
- Use **ZoomInfo** for company enrichment
- Use **PDL** for contact discovery and person enrichment
- Use **Apollo** for SMB companies
- Use **Clearbit** as fallback

---

## Additional Resources

### PDL Documentation
- [PDL API Documentation](https://docs.peopledatalabs.com/)
- [Person Enrichment API](https://docs.peopledatalabs.com/docs/person-enrichment-api)
- [Person Search API](https://docs.peopledatalabs.com/docs/person-search-api)
- [Company Enrichment API](https://docs.peopledatalabs.com/docs/company-enrichment-api)
- [Rate Limits](https://docs.peopledatalabs.com/docs/rate-limits)
- [Error Codes](https://docs.peopledatalabs.com/docs/error-codes)

### Internal Documentation
- [Master Integration Guide](./MASTER_INTEGRATION_GUIDE.md)
- [ZoomInfo Setup](./ZOOMINFO_SETUP.md) - For company enrichment
- [Apollo Setup](./APOLLO_SETUP.md) - For SMB companies
- [Clearbit Setup](./CLEARBIT_SETUP.md) - For real-time enrichment

### Support
- **PDL Support:** support@peopledatalabs.com
- **Documentation:** https://docs.peopledatalabs.com/
- **Status Page:** https://status.peopledatalabs.com/
- **Community Forum:** https://community.peopledatalabs.com/
- **Application Support:** Settings → Integration Health → "Report Issue"

---

## Success Checklist

After completing this setup, you should be able to:
- [ ] Connect to PDL with valid API key
- [ ] See remaining credits in dashboard
- [ ] Enrich a single contact with title, seniority, persona
- [ ] Handle 404 Not Found gracefully (no credits used)
- [ ] Discover 5 contacts at a target account
- [ ] Run bulk enrichment on 100+ contacts
- [ ] Verify email addresses are valid before enriching
- [ ] Monitor credit usage and stay within limits
- [ ] Sync enriched data back to CRM
- [ ] Report data quality issues to PDL

---

## Next Steps

1. **Configure Contact Discovery Personas** - Define target titles and seniorities
2. **Set Up Auto-Enrichment** - Enrich new leads automatically
3. **Integrate with CRM** - Sync PDL data to Salesforce/HubSpot
4. **Enable Scheduled Jobs** - [CRON Setup Guide](./CRON_SETUP_INSTRUCTIONS.md)
5. **Test End-to-End** - Create lead → Auto-enrich → Discover contacts → Sync to CRM

---

**Last Updated:** 2025-11-06  
**Version:** 1.0  
**Maintained By:** Integration Team
