# 🚀 Quickstart Guide - ICP Intelligence Platform

Get up and running with all features in 15 minutes.

---

## Step 1: Clean Your Data (Phase 1)

**Time:** 2-5 minutes

### What It Does
Merges duplicate account records and normalizes domains.

### How to Do It
1. Go to **Settings** (gear icon in sidebar)
2. Click **Data Mapping** tab
3. Find **"Merge Duplicate Accounts"** card
4. Click **"Run Duplicate Merge"** button
5. Wait for completion (shows statistics when done)

**Expected Results:**
- Duplicates merged ✅
- Leads/contacts re-linked ✅
- Domain normalized ✅

---

## Step 2: Complete Prevention Setup (Phase 2)

**Time:** 2 minutes

### Part A: Add Unique Constraint (One-Time)

After Step 1 completes, run this SQL in Supabase SQL Editor:

```sql
ALTER TABLE public.accounts 
ADD CONSTRAINT accounts_org_domain_unique UNIQUE (org_id, domain);
```

**How to Access SQL Editor:**
1. Open your Supabase Dashboard
2. Go to SQL Editor
3. Click "New Query"
4. Paste the SQL above
5. Click "Run"

### Part B: Link Existing Leads

1. Stay in **Settings > Data Mapping**
2. Find **"Link Leads to Accounts"** card
3. Click **"Start Matching"** button
4. Wait for completion

**Expected Results:**
- Future duplicates prevented ✅
- Leads matched to accounts ✅
- Ready for scoring ✅

---

## Step 3: Upload Your Data (If Needed)

**Time:** 3-5 minutes

### What You Can Upload
- Accounts CSV
- Leads CSV
- Contacts CSV
- Closed-Won Deals CSV

### How to Upload
1. Go to **Data Upload** page (in sidebar)
2. Select file type (Accounts/Leads/Contacts)
3. Drag & drop your CSV file
4. Map columns to fields
5. Click **"Upload"**

**Tips:**
- Include domain/website column for matching
- Use standard field names for auto-mapping
- Check data preview before uploading

---

## Step 4: Create Your ICP (If Needed)

**Time:** 3-5 minutes

### Option A: Use a Template
1. Go to **ICP Manager** page
2. Click **"Create New ICP"**
3. Click **"Use Template"**
4. Select industry template (e.g., "Enterprise SaaS")
5. Customize and save

### Option B: Create from Closed-Won
1. Go to **ICP Manager** page
2. Click **"Create from Closed-Won"**
3. System analyzes your best customers
4. Review and adjust criteria
5. Save ICP

### Option C: Manual Creation
1. Go to **ICP Manager** page
2. Click **"Create New ICP"**
3. Enter:
   - Name (e.g., "Enterprise Healthcare")
   - Industries (e.g., Healthcare, Life Sciences)
   - Company sizes (e.g., 500-1000 employees)
   - Geographies (e.g., United States, Canada)
   - Revenue ranges (e.g., $50M-$100M)
4. Save ICP

---

## Step 5: Score Your Accounts

**Time:** 1-2 minutes

### Automatic Scoring
1. Go to **ICP Manager** page
2. Select your ICP
3. Click **"Score All Accounts"**
4. Wait for bulk scoring to complete

**What Happens:**
- All accounts scored against ICP
- Scores appear in Accounts page
- High-fit accounts identified ✅

### View Scores
1. Go to **Accounts** page
2. See scores in the list
3. Click any account to see:
   - Overall score
   - Fit breakdown
   - Score history

---

## Step 6: Enable Advanced Features

**Time:** 2 minutes

1. Go to **Settings > Labs**
2. Enable features you want:

**Phase 3 - Pipeline Intelligence:**
- ✅ Pipeline Efficiency
- ✅ Capital Efficiency

**Phase 4 - AI & Automation:**
- ✅ AI Agents & ML

3. Click **Save Changes**

**Access New Pages:**
- Pipeline Efficiency: Click in sidebar
- Capital Efficiency: Click in sidebar
- AI Agents: Click in sidebar

---

## Step 7: Set Up Integrations (Optional)

**Time:** 5-10 minutes

### Zapier Webhooks
1. Go to **Settings > Zapier**
2. Click **"Add Webhook"**
3. Get webhook URL from Zapier
4. Select event type (e.g., "High Score Account")
5. Test webhook
6. Activate

### External Data Providers
1. Go to **Settings > Integrations**
2. Click **"Connect"** on provider (e.g., Clearbit)
3. Enter API key
4. Click **Save**
5. Enable provider

### API Keys (for external access)
1. Go to **Settings > API**
2. Click **"Generate New Key"**
3. Enter name and select scopes
4. Copy key (shown once)
5. Use in your applications

---

## You're Done! 🎉

### What You've Accomplished

✅ **Phase 1:** Data cleaned and deduplicated  
✅ **Phase 2:** Duplicate prevention active  
✅ **Phase 3:** Pipeline analytics enabled  
✅ **Phase 4:** AI agents ready  
✅ **Phase 5:** Integrations configured  

### What to Do Next

1. **Explore Your Data:**
   - Check Accounts page for high-fit accounts
   - View Executive Dashboard for insights
   - Analyze ICP TAM Intelligence

2. **Create Workflows:**
   - Set up AI agents for lead qualification
   - Configure Zapier triggers
   - Schedule regular enrichment

3. **Optimize Performance:**
   - Review Pipeline Efficiency metrics
   - Analyze Capital Efficiency
   - Monitor rate limits

4. **Iterate on ICPs:**
   - Create multiple ICPs for different segments
   - Compare ICP performance
   - Refine based on closed-won data

---

## Quick Reference

### Key Pages
- **Dashboard:** Executive overview
- **Accounts:** View all accounts and scores
- **ICP Manager:** Create and manage ICPs
- **Data Upload:** Import CSV files
- **Settings:** Configuration hub

### Common Tasks
- **Score accounts:** ICP Manager > Score All Accounts
- **Link leads:** Settings > Data Mapping > Link Leads
- **Add data:** Data Upload > Select type > Upload CSV
- **View analytics:** Pipeline/Capital Efficiency pages
- **Create agent:** AI Agents > Create Agent

### Support
- Check `IMPLEMENTATION_COMPLETE.md` for details
- Review edge function logs in Supabase
- Use browser console for frontend debugging

---

**Ready to go! Start exploring your ICP intelligence platform.** 🚀
