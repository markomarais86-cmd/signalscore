# Campaign Builder - Complete Test Plan

## Pre-Test Setup Checklist

### 1. Verify Prerequisites
- [ ] You're logged in to the platform
- [ ] Your org has accounts in the database
- [ ] At least some accounts have ICP scores
- [ ] At least some accounts have contacts (leads)
- [ ] Salesforce integration is connected (check Settings → Integrations)

### 2. Navigate to Accounts Page
- [ ] Go to `/accounts` 
- [ ] Verify the page loads with your account list

---

## Test Flow: Complete Campaign Building Journey

### **STEP 1: Filter Campaign-Ready Accounts**

**Option A: From Dashboard**
1. [ ] Go to Executive Dashboard (`/`)
2. [ ] Find the "Campaign Ready" metric card
3. [ ] Click on the card (should navigate to `/accounts?campaign_ready=true`)
4. [ ] Verify URL shows `campaign_ready=true` parameter
5. [ ] Verify accounts list is filtered to show only campaign-ready accounts

**Option B: From Accounts Page Directly**
1. [ ] Go to `/accounts`
2. [ ] Look for filter controls or URL parameter support
3. [ ] Manually add `?campaign_ready=true` to URL
4. [ ] Verify filtering works

**Expected Results:**
- ✅ Only accounts with ICP score ≥ 70 AND contacts > 0 are shown
- ✅ Account count reflects filtered results
- ✅ Table shows accounts with both score badges and contact counts

---

### **STEP 2: Select Accounts for Campaign**

1. [ ] Review the filtered campaign-ready accounts
2. [ ] Look for selection mechanism (checkboxes or multi-select)
3. [ ] Select 2-5 accounts you want to target
4. [ ] Look for "Build Campaign" or similar button
5. [ ] Click to launch Campaign Builder modal

**Expected Results:**
- ✅ Selection UI is visible and functional
- ✅ Selected account count is displayed
- ✅ "Build Campaign" button appears when accounts are selected
- ✅ Modal opens with selected accounts shown

---

### **STEP 3: Campaign Builder - Step 1 (Review Selection)**

**Verify the modal displays:**
1. [ ] Campaign Builder title
2. [ ] Step indicator showing "1 of 5"
3. [ ] Summary of selected accounts:
   - Number of accounts selected
   - Average ICP score
   - Industries represented
   - Countries/geographies represented
4. [ ] "Next" button to proceed

**Expected Results:**
- ✅ All selected accounts are summarized
- ✅ Statistics are accurate
- ✅ Can proceed to Step 2

---

### **STEP 4: Campaign Builder - Step 2 (Define Persona)**

**Verify persona definition options:**
1. [ ] Campaign name input field (pre-filled with date)
2. [ ] Job title selector (multi-select checkboxes):
   - VP Sales, Director Sales, Head of Sales
   - VP Marketing, Director Marketing, Head of Marketing
   - VP Revenue, CRO
   - CEO, COO, President
3. [ ] Seniority level selector (default: VP, C-Level)
4. [ ] Department selector (default: Sales)
5. [ ] Max contacts per account slider (1-10, default: 3)

**Test persona customization:**
1. [ ] Change campaign name to "Q1 2025 Sales Leaders Campaign"
2. [ ] Select "VP Sales", "Director Sales", "CRO"
3. [ ] Keep seniority as "VP", "C-Level"
4. [ ] Select "Sales" and "Revenue" departments
5. [ ] Set max contacts to 5
6. [ ] Click "Next"

**Expected Results:**
- ✅ All persona criteria are configurable
- ✅ Selections are saved when clicking Next
- ✅ Moves to Step 3

---

### **STEP 5: Campaign Builder - Step 3 (Select Provider)**

**Verify provider options:**
1. [ ] Apollo.io option (recommended, cheapest)
2. [ ] ZoomInfo option (most comprehensive)
3. [ ] Clearbit option (basic enrichment)

**Each provider card should show:**
- [ ] Provider logo/name
- [ ] Cost per contact (e.g., $0.10, $0.25, $0.50)
- [ ] Data quality rating
- [ ] Coverage information

**Test provider selection:**
1. [ ] Select Apollo as provider
2. [ ] Verify estimated cost calculation appears:
   - Cost = (# accounts) × (max contacts per account) × (cost per contact)
   - Example: 3 accounts × 5 contacts × $0.10 = $1.50
3. [ ] Try switching to ZoomInfo
4. [ ] Verify cost updates (should be higher)
5. [ ] Switch back to Apollo
6. [ ] Click "Preview Contacts"

**Expected Results:**
- ✅ All three providers are selectable
- ✅ Cost estimate updates in real-time
- ✅ Can proceed to contact preview
- ✅ Loading state appears while fetching contacts

---

### **STEP 6: Campaign Builder - Step 4 (Preview Contacts)**

**This step calls the `find-campaign-contacts` edge function**

**Verify contact preview loading:**
1. [ ] Loading spinner appears
2. [ ] "Finding contacts from Apollo..." message
3. [ ] After 2-5 seconds, contacts table populates

**Verify contacts table shows:**
1. [ ] Checkbox column (all selected by default)
2. [ ] First Name
3. [ ] Last Name
4. [ ] Email
5. [ ] Job Title
6. [ ] Account Name
7. [ ] Phone (if available)
8. [ ] LinkedIn URL (if available)
9. [ ] Data Quality Score (0-100)

**Test contact management:**
1. [ ] Verify all contacts are pre-selected
2. [ ] Uncheck 2-3 contacts
3. [ ] Verify selection count updates
4. [ ] Re-check one contact
5. [ ] Verify final count reflects your selections

**Verify deduplication works:**
1. [ ] Check if any contacts were excluded (shown in summary)
2. [ ] Summary should show: "Found X new contacts (Y duplicates excluded)"

**Check data quality:**
1. [ ] Verify most contacts have quality scores > 70
2. [ ] Contacts should have verified emails
3. [ ] Title should match persona criteria

**Click "Next" to proceed**

**Expected Results:**
- ✅ Contacts load successfully from edge function
- ✅ All contacts match persona criteria (titles, seniority)
- ✅ No duplicate emails in the list
- ✅ Data quality scores are calculated
- ✅ Can select/deselect contacts
- ✅ Move to Step 5

---

### **STEP 7: Campaign Builder - Step 5 (Push to Destination)**

**Verify destination options:**
1. [ ] Salesforce option (push directly to SF campaign)
2. [ ] CSV Download option (export as file)

**Test Salesforce Push (Primary Path):**
1. [ ] Select "Salesforce" as destination
2. [ ] Verify Salesforce campaign ID input field appears (optional)
3. [ ] Leave campaign ID empty (system will create new campaign)
4. [ ] Review final summary:
   - Campaign name
   - Number of contacts to push
   - Selected accounts
   - Estimated cost
5. [ ] Click "Push to Salesforce"

**This calls the `push-campaign-to-crm` edge function**

**Verify push process:**
1. [ ] Loading spinner appears
2. [ ] Progress indicator shows: "Pushing X of Y contacts..."
3. [ ] Progress updates incrementally
4. [ ] After completion, success message appears

**Expected Results:**
- ✅ Push initiates without errors
- ✅ Progress updates are visible
- ✅ Success state shows:
   - ✅ Number of contacts added
   - ✅ Salesforce campaign ID
   - ✅ Link to open campaign in Salesforce
   - ✅ Summary of any errors
- ✅ Can click "View in Salesforce" (opens SF in new tab)
- ✅ Can close modal

---

### **STEP 8: CSV Download (Alternative Path)**

**Repeat Steps 1-4 to get back to Step 5**

1. [ ] Select "CSV Download" as destination
2. [ ] Click "Export Campaign"
3. [ ] Verify CSV file downloads:
   - Filename: `campaign-[name]-[date].csv`
   - Contains all selected contacts
   - Includes columns: First Name, Last Name, Email, Title, Company, Account ID, Phone, LinkedIn

**Expected Results:**
- ✅ CSV downloads immediately
- ✅ File contains correct data
- ✅ All columns are populated
- ✅ Can open in Excel/Sheets

---

## Edge Function Testing

### Test `find-campaign-contacts` Function

**Manual Test via Supabase Dashboard:**
1. [ ] Go to Supabase Dashboard → Edge Functions
2. [ ] Find `find-campaign-contacts`
3. [ ] Click "Invoke"
4. [ ] Use test payload:
```json
{
  "org_id": "your-org-id",
  "account_ids": ["account-id-1", "account-id-2"],
  "persona_criteria": {
    "titles": ["VP Sales", "Director Sales"],
    "seniority": ["VP", "C-Level"],
    "departments": ["Sales"],
    "max_per_account": 3
  },
  "provider": "apollo",
  "preview_only": true
}
```
5. [ ] Verify response includes contacts array with deduplication

**Check logs:**
1. [ ] Go to Edge Functions → Logs
2. [ ] Filter by `find-campaign-contacts`
3. [ ] Verify successful execution
4. [ ] Check for any errors or warnings

### Test `push-campaign-to-crm` Function

**Manual Test via Supabase Dashboard:**
1. [ ] Go to Supabase Dashboard → Edge Functions
2. [ ] Find `push-campaign-to-crm`
3. [ ] Click "Invoke"
4. [ ] Use test payload:
```json
{
  "org_id": "your-org-id",
  "campaign_name": "Test Campaign",
  "campaign_id": null,
  "contacts": [
    {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "title": "VP Sales",
      "account_name": "Test Company"
    }
  ],
  "batch_metadata": {
    "icp_criteria": {},
    "persona_criteria": {}
  }
}
```
5. [ ] Verify response includes campaign_id and success status

**Check campaign_snapshots table:**
1. [ ] Go to Supabase → Table Editor → campaign_snapshots
2. [ ] Verify new record was created with correct metadata

---

## Error Handling Tests

### Test Invalid Selections
1. [ ] Try to build campaign with 0 accounts selected
   - **Expected:** Error message or disabled button
2. [ ] Try to proceed without selecting job titles
   - **Expected:** Validation error
3. [ ] Try with no Salesforce integration
   - **Expected:** Error message about missing integration

### Test API Failures
1. [ ] Disable network temporarily
2. [ ] Try to preview contacts
   - **Expected:** Error toast, retry option
3. [ ] Re-enable network and retry
   - **Expected:** Successfully loads contacts

---

## Performance Checks

### Response Times
- [ ] Step 1-3: Instant (<100ms)
- [ ] Contact preview: 2-5 seconds
- [ ] Salesforce push: 5-10 seconds for 10-20 contacts

### Data Accuracy
- [ ] Contact titles match persona criteria 100%
- [ ] No duplicate emails in preview
- [ ] All accounts have at least 1 contact (up to max per account)
- [ ] ICP scores are accurate (>70 for campaign-ready)

---

## Success Criteria

### ✅ Complete Success Checklist
- [ ] Can filter campaign-ready accounts from Dashboard
- [ ] Can select multiple accounts
- [ ] Campaign Builder opens with all 5 steps
- [ ] Persona criteria can be customized
- [ ] All 3 providers are selectable with cost estimates
- [ ] Contact preview loads real data (or mock if no API keys)
- [ ] Contacts can be selected/deselected
- [ ] Can push to Salesforce OR download CSV
- [ ] Success state shows campaign results
- [ ] campaign_snapshots table is updated
- [ ] No console errors during entire flow
- [ ] All UI states (loading, error, success) work correctly

---

## Known Limitations (Current MVP)

1. **Mock Data:** If no Apollo/ZoomInfo API keys are configured:
   - `find-campaign-contacts` will return mock contacts
   - This is expected behavior for demo purposes

2. **Mock Salesforce Push:** Currently simulated:
   - Real implementation requires Salesforce API integration
   - Mock returns success with fake campaign ID

3. **No Campaign History:** 
   - Currently no way to view past campaigns
   - Future enhancement needed

---

## Troubleshooting

### Issue: No accounts appear as campaign-ready
**Solution:** 
- Run bulk scoring to assign ICP scores
- Ensure accounts have contacts (leads) in the database
- Check that ICP profiles exist

### Issue: Contact preview fails
**Solution:**
- Check edge function logs for errors
- Verify account IDs are valid
- Check if provider API keys are configured (Settings → API Keys)

### Issue: Salesforce push fails
**Solution:**
- Verify Salesforce integration is connected (Settings → Integrations)
- Check Salesforce credentials are valid
- Review edge function logs for specific error

### Issue: CSV download empty
**Solution:**
- Verify contacts were selected in Step 4
- Check browser download permissions
- Try different browser if issue persists

---

## Next Steps After Testing

Once testing is complete:

1. **Document Issues:** Note any bugs or UX issues found
2. **Verify Mock Data:** Confirm which parts use mock vs. real data
3. **API Integration:** Connect real Apollo/ZoomInfo APIs if available
4. **Salesforce Integration:** Implement real SF API calls
5. **Add Campaign History:** Track and display past campaigns
6. **Performance Optimization:** Add caching, pagination if needed

---

## Quick Test Script (5-Minute Flow)

For a rapid end-to-end test:

1. ✅ Navigate to `/accounts?campaign_ready=true`
2. ✅ Select 2-3 accounts
3. ✅ Click "Build Campaign"
4. ✅ Step 1: Click "Next"
5. ✅ Step 2: Select "VP Sales", set max to 3, click "Next"
6. ✅ Step 3: Choose Apollo, click "Preview Contacts"
7. ✅ Step 4: Wait for contacts to load, keep all selected, click "Next"
8. ✅ Step 5: Choose "CSV Download", click "Export Campaign"
9. ✅ Verify CSV downloads with contact data

**Total time:** ~60 seconds (as advertised!)

---

## Test Results Log

| Test | Status | Notes | Tested By | Date |
|------|--------|-------|-----------|------|
| Filter campaign-ready | ⏳ | | | |
| Select accounts | ⏳ | | | |
| Launch modal | ⏳ | | | |
| Define persona | ⏳ | | | |
| Select provider | ⏳ | | | |
| Preview contacts | ⏳ | | | |
| Push to Salesforce | ⏳ | | | |
| CSV download | ⏳ | | | |
| Edge functions | ⏳ | | | |
| Error handling | ⏳ | | | |

**Legend:** ⏳ Pending | ✅ Pass | ❌ Fail | ⚠️ Partial

---

## Demo Video Checklist

If recording a demo:

- [ ] Use pre-populated demo data
- [ ] Start from Executive Dashboard
- [ ] Show Campaign Ready card click-through
- [ ] Demonstrate complete 5-step flow
- [ ] Highlight key features:
  - ICP score filtering
  - Persona targeting
  - Cost estimation
  - Data quality scores
  - Direct Salesforce push
- [ ] Show success state with campaign results
- [ ] End with "60 seconds vs. 4+ hours" comparison

---

**Last Updated:** 2025-11-12
**Version:** 1.0
**Status:** Ready for Testing
