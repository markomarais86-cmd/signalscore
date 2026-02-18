

## Bypass Credit Check and Test Perplexity Enrichment

Temporarily skip the credit check in the `enrich-unified` edge function, then run a test enrichment on a real healthcare account to verify Perplexity populates `bed_count`, `facility_type`, and `ehr_system`.

### Step 1: Add a `bypass_credits` flag to `enrich-unified`

In `supabase/functions/enrich-unified/index.ts`, modify the credit check (lines 172-182) to accept an optional `bypass_credits: true` parameter in the request body. When set, skip the credit check entirely and log a warning.

```
Before:
  const creditsRemaining = ...;
  if (creditsRemaining < records.length) {
    throw new Error(`Insufficient credits...`);
  }

After:
  if (!bypass_credits) {
    const creditsRemaining = ...;
    if (creditsRemaining < records.length) {
      throw new Error(`Insufficient credits...`);
    }
  } else {
    console.warn('[enrich-unified] CREDIT CHECK BYPASSED - test mode');
  }
```

### Step 2: Add verbose logging for Perplexity + custom attributes

Add extra console.log statements in the enrichment pipeline so we can confirm:
- Custom attribute definitions were loaded (already logged at line 163)
- Perplexity was called with the enrichment prompts
- What Perplexity returned for `bed_count`, `facility_type`, `ehr_system`
- Whether `custom_attributes` was written to the account record

### Step 3: Run a test enrichment via curl

Call the edge function directly with one healthcare account and `bypass_credits: true`:

- **Account**: "Don Castellarin" (domain: dentistdonsmiles.com, industry: Hospitals & Physicians Clinics)
- **Record type**: account
- **Config**: `{ bypass_credits: true }`

### Step 4: Check logs and verify data

After the test call:
1. Read edge function logs to confirm Perplexity was invoked
2. Query the `accounts` table to verify `custom_attributes` now contains `bed_count`, `facility_type`, and `ehr_system` values

### Step 5: Remove bypass (cleanup)

After verification, remove the `bypass_credits` flag so the credit check is enforced again in production.

---

### Files Modified

- **`supabase/functions/enrich-unified/index.ts`** -- Add `bypass_credits` flag support, add verbose logging around Perplexity calls and custom attribute storage
- No other files changed; this is a backend-only test

### What You'll See

After running the test, I'll show you:
- The edge function logs proving Perplexity was called with healthcare prompts
- The actual values returned (e.g., bed_count = 5, facility_type = "Community Hospital", ehr_system = "Dentrix")
- The database row confirming `custom_attributes` was populated

