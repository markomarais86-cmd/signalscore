# ICP Signal Platform - Quick Start Checklist

**Time to Complete:** 1-2 hours  
**Goal:** Get basic ICP scoring working with your first integration

---

## Pre-Setup Requirements

### Before You Begin
- [ ] Have admin access to your CRM (Salesforce or HubSpot)
- [ ] Have at least 100+ accounts in your CRM
- [ ] Have API credentials ready (if using enrichment providers)
- [ ] Understand your basic ICP criteria (industries, company size, geography)

---

## Phase 1: Connect Your CRM (30-45 minutes)

### Choose Your CRM
- [ ] **Option A:** Salesforce (Enterprise) → Follow [SALESFORCE_OAUTH_SETUP.md](./SALESFORCE_OAUTH_SETUP.md)
- [ ] **Option B:** HubSpot (SMB/Marketing-led) → Follow [HUBSPOT_OAUTH_SETUP.md](./HUBSPOT_OAUTH_SETUP.md)

### CRM Setup Steps
- [ ] Create OAuth app in your CRM
- [ ] Copy Client ID and Client Secret
- [ ] Add OAuth credentials to ICP Signal Platform (Settings → Integrations)
- [ ] Authorize the connection
- [ ] Trigger initial sync
- [ ] **Verify:** Check that 100+ accounts appear in Accounts page

### ✅ Phase 1 Success Criteria
- Accounts visible in platform
- Sync status shows "Connected" in Integration Health
- No sync errors in logs

---

## Phase 2: Add Data Enrichment (15-30 minutes)

### Choose Your Enrichment Provider
- [ ] **Recommended:** Apollo (good balance, 60 free/month) → [APOLLO_SETUP.md](./APOLLO_SETUP.md)
- [ ] **Alternative:** Clearbit (real-time, 50 free/month) → [CLEARBIT_SETUP.md](./CLEARBIT_SETUP.md)
- [ ] **Enterprise:** ZoomInfo (most comprehensive, paid only) → [ZOOMINFO_SETUP.md](./ZOOMINFO_SETUP.md)

### Enrichment Setup Steps
- [ ] Sign up for enrichment provider account
- [ ] Get API key from provider dashboard
- [ ] Add API key to ICP Signal Platform (Settings → External Data Providers)
- [ ] Test enrichment on 5 sample accounts
- [ ] **Verify:** Employee count, revenue, and industry data fills in

### ✅ Phase 2 Success Criteria
- Test enrichment returns data successfully
- At least 3/5 test accounts enriched
- No API errors in enrichment logs

---

## Phase 3: Define Your ICP (15-30 minutes)

### ICP Setup Steps
- [ ] Navigate to ICP Manager
- [ ] Click "Create New ICP"
- [ ] Name your ICP (e.g., "Enterprise Tech Companies")

### Set ICP Criteria
- [ ] **Industries:** Select 2-5 target industries
- [ ] **Company Size:** Set employee count range (e.g., 100-5,000)
- [ ] **Revenue Range:** Set annual revenue range (e.g., $10M-$500M)
- [ ] **Geographies:** Select target countries/regions
- [ ] **Advanced (Optional):** Add technology requirements, funding stage, etc.

### Save & Activate
- [ ] Click "Save ICP"
- [ ] Toggle "Active" to enable scoring
- [ ] **Verify:** ICP appears in ICP Manager with "Active" status

### ✅ Phase 3 Success Criteria
- ICP saved successfully
- ICP is marked as "Active"
- Criteria match your target customer profile

---

## Phase 4: Run Bulk Scoring (5 minutes + wait)

### Trigger Initial Scoring
- [ ] Navigate to Settings → Scoring
- [ ] Click "Score All Accounts" button
- [ ] Confirm the bulk scoring operation
- [ ] **Wait:** 5-30 minutes depending on account count

### Monitor Progress
- [ ] Refresh Accounts page periodically
- [ ] Check scoring progress in Settings → Scoring
- [ ] **Verify:** ICP scores appear on account records

### ✅ Phase 4 Success Criteria
- Scoring job completes without errors
- 80%+ of accounts have ICP scores
- Scores range from 0-100

---

## Phase 5: Validate & Use (10-15 minutes)

### Review Scored Accounts
- [ ] Navigate to Accounts page
- [ ] Sort by ICP Score (highest to lowest)
- [ ] Review top 10 high-scoring accounts
- [ ] **Verify:** High scores match your expectations

### Check Data Quality
- [ ] Look at accounts with scores 70+
- [ ] Confirm they match your ICP criteria
- [ ] Look at accounts with scores <30
- [ ] Confirm they don't match your ICP

### Export & Share
- [ ] Filter accounts with score 60+ (or your threshold)
- [ ] Export to CSV
- [ ] Share with sales team

### ✅ Phase 5 Success Criteria
- High-scoring accounts match your ICP
- Low-scoring accounts are out of ICP
- Sales team can access prioritized account list

---

## Quick Verification Checklist

### Data Flow Test
Run this quick test to ensure everything is working:

1. **CRM → Platform**
   - [ ] Create a test account in your CRM
   - [ ] Wait 5-10 minutes for sync
   - [ ] Verify it appears in ICP Signal Platform

2. **Enrichment**
   - [ ] Find an account with missing data
   - [ ] Trigger manual enrichment
   - [ ] Verify data fills in (employee count, revenue)

3. **Scoring**
   - [ ] Pick a high-fit account (matches ICP criteria)
   - [ ] Trigger scoring
   - [ ] Verify score is 60+ (should be high)

4. **Dashboard**
   - [ ] Navigate to Executive Dashboard
   - [ ] Verify metrics display correctly
   - [ ] Check geography breakdown shows your target regions

---

## Common Pitfalls to Avoid

### ❌ Don't Do This
- **Skip data cleaning:** Syncing dirty CRM data → Bad scores
- **Set up all 11 integrations at once:** Too complex, high chance of errors
- **Define ICP without data:** Need accounts to validate criteria
- **Expect instant results:** Initial sync + enrichment + scoring takes 30-60 minutes
- **Use only one enrichment provider:** Coverage will be <60%

### ✅ Do This Instead
- **Clean CRM data first:** Dedupe and normalize before syncing
- **Start with CRM + 1 enrichment provider:** Get quick wins
- **Review 10-20 closed-won deals first:** Inform your ICP criteria
- **Be patient:** Let initial sync complete before bulk scoring
- **Add 2-3 enrichment providers:** Use waterfall for 90%+ coverage

---

## What's Next?

### Immediate Next Steps (Same Day)
- [ ] Review high-scoring accounts with sales team
- [ ] Adjust ICP criteria if needed
- [ ] Set up scheduled sync (hourly recommended)

### Week 1 Enhancements
- [ ] Add 2nd enrichment provider for waterfall
- [ ] Upload closed-won deals for AI ICP recommendations
- [ ] Connect sales engagement tool (Outreach/SalesLoft/Groove)
- [ ] Set up automated scoring triggers

### Week 2+ Advanced Features
- [ ] Connect Gong for conversation intelligence
- [ ] Connect Clari for forecast data
- [ ] Create multiple ICP profiles for segments
- [ ] Set up automated workflows (lead routing, enrichment triggers)
- [ ] Configure custom dashboards and reports

---

## Getting Help

### Integration Health Dashboard
- **Location:** Settings → Integration Health
- **Check:** Daily for first week, then weekly
- **Monitor:** Sync success rate (should be >95%)

### Troubleshooting Resources
- **Integration Issues:** [TROUBLESHOOTING_INTEGRATIONS.md](./TROUBLESHOOTING_INTEGRATIONS.md)
- **Field Mapping:** [FIELD_MAPPING_GUIDE.md](./FIELD_MAPPING_GUIDE.md)
- **CRM Sync Issues:** [CRM_SYNC_GUIDE.md](./CRM_SYNC_GUIDE.md)
- **Master Guide:** [MASTER_INTEGRATION_GUIDE.md](./MASTER_INTEGRATION_GUIDE.md)

### Support Channels
1. Check Integration Health dashboard
2. Review sync logs for specific errors
3. Consult integration-specific setup guide
4. Contact support with error details

---

## Success Metrics

### Day 1 (After Quick Start)
- ✅ CRM connected and syncing
- ✅ 1 enrichment provider configured
- ✅ ICP defined and active
- ✅ 80%+ accounts scored

### Week 1
- ✅ 90%+ enrichment coverage (2-3 providers)
- ✅ Sales team using prioritized account lists
- ✅ Scheduled sync running hourly
- ✅ Integration health >95% success rate

### Month 1
- ✅ Multiple ICPs for different segments
- ✅ Sales engagement data feeding scores
- ✅ Automated workflows running
- ✅ Team trained on platform

---

## Time Investment Summary

| Phase | Time | Can Skip? |
|-------|------|-----------|
| **CRM Setup** | 30-45 min | ❌ Required |
| **Enrichment** | 15-30 min | ❌ Required |
| **ICP Definition** | 15-30 min | ❌ Required |
| **Bulk Scoring** | 5 min + wait | ❌ Required |
| **Validation** | 10-15 min | ⚠️ Recommended |
| **2nd Enrichment** | 15 min | ✅ Optional |
| **Sales Engagement** | 30-45 min | ✅ Optional |
| **Forecasting Tools** | 30-45 min | ✅ Optional |

**Total Minimum Time:** 1-2 hours (core setup)  
**Total Recommended Time:** 1-2 days (with enhancements)  
**Total Full Setup Time:** 1-2 weeks (all 11 integrations)

---

## Quick Reference: Integration Priority

### Priority 1: Must Have (Day 1)
1. **CRM** - Salesforce OR HubSpot
2. **Enrichment** - Apollo OR Clearbit
3. **ICP Definition** - Platform feature

### Priority 2: Should Have (Week 1)
4. **Additional Enrichment** - Add 1-2 more providers
5. **Sales Engagement** - Outreach/SalesLoft/Groove

### Priority 3: Nice to Have (Week 2+)
6. **Conversation Intel** - Gong
7. **Forecasting** - Clari

---

## Final Checklist

Before you start, ensure you have:
- [ ] Admin access to CRM
- [ ] 100+ accounts in CRM
- [ ] 30 minutes of uninterrupted time
- [ ] API credentials (if using enrichment)
- [ ] Basic understanding of your ICP

**Ready?** Start with Phase 1: Connect Your CRM

---

**Need the full details?** See [MASTER_INTEGRATION_GUIDE.md](./MASTER_INTEGRATION_GUIDE.md)

**Last Updated:** 2025-11-06  
**Version:** 1.0
