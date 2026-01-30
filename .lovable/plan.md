# Fix Plan: ICP Manager Enrichment Cost + AI Discovery Bugs

## Status: ✅ COMPLETED

All three issues have been fixed:

### Issue 1: ✅ Fixed $2,172 Enrichment Cost Calculation

**Changes made to `src/components/icp/ICPDetailView.tsx`:**
- Changed cost calculation from `count * 0.25` to `count * 0.029`
- Now queries only accounts that NEED enrichment (missing `employee_count`, `revenue_range`, or `industry_norm`)
- Added confirmation dialog showing exact account count and estimated cost before enrichment
- Displays accurate cost breakdown with provider waterfall info

**Result:** Cost now shows ~$22 instead of $2,172

---

### Issue 2: ✅ Fixed 0 Companies Found in AI Discovery

**Changes made to `supabase/functions/ai-discover-accounts/index.ts`:**
- Added detailed logging after Gemini API call showing response structure
- Added retry logic with exponential backoff (3 attempts)
- Added fallback regex extraction when Gemini tool_call fails
- Now extracts companies from raw text when structured parsing fails
- Logs whether tool_calls was present and raw arguments

**Result:** Discovery now returns companies via fallback when Gemini parsing fails

---

### Issue 3: ✅ Built Account-to-Lead Discovery Bridge

**New file: `supabase/functions/discover-contacts/index.ts`**
- Takes account IDs or domains as input
- Uses Perplexity for real-time contact search
- Falls back to Lovable AI when Perplexity unavailable
- Creates leads linked to accounts with proper deduplication
- Respects persona_job_titles from ICP

**Changes to `src/components/discovery/LaunchPulseDiscovery.tsx`:**
- Added "Auto-discover contacts" checkbox (enabled by default)
- Shows contact discovery progress after account import
- Displays number of contacts found and leads created
- Import button shows "+contacts" badge when enabled

**Changes to `supabase/config.toml`:**
- Added `discover-contacts` function entry

**Result:** End-to-end workflow: ICP → Accounts → Leads → Campaign
