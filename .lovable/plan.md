
# Fix Plan: ICP Manager Enrichment Cost + AI Discovery Bugs

## Summary

This plan addresses three critical issues in the ICP Manager:

1. **$2,172 Enrichment Cost Bug** - The UI shows ~100x the actual cost because it uses the wrong account count and rate
2. **0 Companies Found Bug** - Perplexity successfully searches but Gemini parsing fails silently, returning empty arrays
3. **Missing Account-to-Lead Bridge** - Discovered companies have no contacts/leads discovered for them

---

## Issue 1: Fix the $2,172 Enrichment Cost Calculation

### Root Cause

In `src/components/icp/ICPDetailView.tsx` (lines 97-111):
- Uses `count * 0.25` - a hardcoded $0.25/account rate instead of the actual $0.029/account
- Counts ALL 8,687 high-fit accounts instead of filtering for the ~773 that actually need enrichment
- The actual enrichment function already correctly filters for accounts needing enrichment (lines 74-81) but the cost display does not

### Changes

**File: `src/components/icp/ICPDetailView.tsx`**

- Replace the cost estimation logic (lines 97-111) to:
  1. Query only accounts that need enrichment (where `employee_count`, `revenue_range`, or `industry_norm` is null)
  2. Call the `estimate-enrichment-cost` edge function for accurate pricing
  3. Display both the account count needing enrichment and the actual estimated cost

- Add a confirmation dialog before starting expensive enrichment operations showing:
  - Number of accounts to enrich
  - Estimated cost breakdown by provider
  - Estimated duration

---

## Issue 2: Fix 0 Companies Found in AI Discovery

### Root Cause

In `supabase/functions/ai-discover-accounts/index.ts` (lines 108-198):
- `parsePerplexityResults()` uses Gemini tool calling to extract structured data
- When Gemini fails to return a valid `tool_calls` response, the function silently returns `[]`
- No logging shows what Gemini actually returned or why parsing failed
- No retry logic or fallback for parsing failures

Logs confirm:
```
[Perplexity] Received response with 9 citations  ← Search worked
[Lovable AI] Parsing Perplexity results...
[AI Discovery] Perplexity returned 0 companies   ← Parsing failed silently
```

### Changes

**File: `supabase/functions/ai-discover-accounts/index.ts`**

1. Add detailed logging after Gemini API call to show:
   - Full response structure
   - Whether tool_calls was present
   - Raw arguments before parsing

2. Add fallback regex extraction if tool_call parsing fails:
   - Parse the raw text response looking for company names, domains, and attributes
   - Use a simpler format that doesn't rely on tool calling

3. Add retry logic with exponential backoff for Gemini API failures

4. Add validation before returning empty array:
   - If Perplexity found content but Gemini returned 0 companies, log a warning and try alternate parsing

---

## Issue 3: Build Account-to-Lead Discovery Bridge

### Current Gap

When new companies are discovered and imported:
- They are added to the `accounts` table with firmographic data
- But NO contacts/leads are created for these accounts
- Users have accounts but no one to reach out to

### Solution Architecture

```text
Discovery Flow (Current):
  ICP → Perplexity Search → Parse → Import to accounts

Discovery Flow (Proposed):
  ICP → Perplexity Search → Parse → Import to accounts
                                         ↓
                              Trigger Contact Discovery
                                         ↓
                              Find Decision Makers at Each Account
                                         ↓
                              Create Leads Linked to Account
```

### Changes

**New File: `supabase/functions/discover-contacts/index.ts`**

Create a new edge function that:
1. Takes an `account_id` or list of account domains
2. Uses Perplexity to search for decision-makers matching the ICP's `persona_job_titles`
3. Uses Apollo (if configured) to find verified contacts
4. Creates leads in the `Leads` table linked to the account
5. Runs enrichment on discovered leads

**File: `supabase/functions/ai-discover-accounts/index.ts`**

After successfully importing accounts (lines 430-432):
- Add a post-import hook that triggers contact discovery for newly imported accounts
- Make this optional via a `discoverContacts: boolean` config flag
- Default to `true` for full end-to-end workflow

**File: `src/components/discovery/LaunchPulseDiscovery.tsx`**

- Add a "Discover Contacts" checkbox to the import options
- Show progress for contact discovery after account import
- Display the number of leads found per account

---

## Technical Details

### File Changes Summary

| File | Changes |
|------|---------|
| `src/components/icp/ICPDetailView.tsx` | Fix cost calculation, add confirmation dialog |
| `supabase/functions/ai-discover-accounts/index.ts` | Add parsing fallback, logging, retry logic |
| `supabase/functions/discover-contacts/index.ts` | New edge function for contact discovery |
| `src/components/discovery/LaunchPulseDiscovery.tsx` | Add contact discovery toggle and progress |
| `supabase/config.toml` | Add `discover-contacts` function entry |

### Cost Calculation Fix Details

Current (broken):
```typescript
setEnrichmentCost((count || 0) * 0.25); // ~$0.25 per account = $2,172
```

Fixed:
```typescript
// 1. Query only accounts needing enrichment
const { count } = await supabase
  .from('accounts')
  .select('*', { count: 'exact', head: true })
  .eq('org_id', userProfile.org_id)
  .in('external_id', accountIds)
  .or('employee_count.is.null,revenue_range.is.null,industry_norm.is.null');

// 2. Use actual cost rate (~$0.029/account)
const COST_PER_ACCOUNT = 0.029;
setEnrichmentCost((count || 0) * COST_PER_ACCOUNT);
```

### Parsing Fallback Logic

If Gemini tool_call fails, extract from raw text:
```typescript
// Fallback: regex extraction from raw response
function extractCompaniesFromText(content: string): DiscoveredCompany[] {
  const companies: DiscoveredCompany[] = [];
  
  // Look for company mentions with domains
  const domainPattern = /([A-Za-z0-9][A-Za-z0-9-]*\.[a-z]{2,})/g;
  const matches = content.matchAll(domainPattern);
  
  // Extract context around each domain mention
  // ... parse company details from surrounding text
  
  return companies;
}
```

### Contact Discovery Prompt

```text
Find decision-makers at {company_name} ({domain}) with these titles:
{persona_job_titles}

For each person found, provide:
- Full name
- Job title
- LinkedIn URL
- Email (if publicly available)
- Confidence score

Focus on verifiable, current employees only.
```

---

## Expected Outcomes

After implementation:
1. Enrichment cost displays correctly (~$22 instead of $2,172)
2. AI Discovery returns companies instead of empty results
3. Discovered accounts automatically have contacts/leads created
4. Complete end-to-end workflow: ICP → Accounts → Leads → Campaign
