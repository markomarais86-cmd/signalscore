

## Fix: Enrichment "Too Many Records" Error and Child Org Support

### Problems Found

1. **Too many records per request**: The batch size selector allows 100-2500 records, but `enrich-unified` has a hard limit of 100 per request. The `enrichAccounts` hook sends all records in one call with no chunking.

2. **Child org issue (91.life)**: The "existing data" enrichment query at line 1062 uses `userProfile.org_id` directly, which returns 0 accounts for child organizations whose data lives under the parent org.

### Fix 1: Add client-side chunking in the enrichment hook

**File: `src/hooks/use-unified-enrichment.ts`**

Update `enrichAccounts` to automatically chunk records into batches of 100 (matching the edge function limit). Process each chunk sequentially, aggregate results, and report combined progress.

```text
BEFORE:
  const { data, error } = await supabase.functions.invoke('enrich-unified', {
    body: { org_id, record_type: 'account', records, config }
  });

AFTER:
  const CHUNK_SIZE = 100;
  const chunks = [];
  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    chunks.push(records.slice(i, i + CHUNK_SIZE));
  }
  // Process each chunk, merge results
  for (const chunk of chunks) {
    const { data, error } = await supabase.functions.invoke('enrich-unified', {
      body: { org_id, record_type: 'account', records: chunk, config }
    });
    // Accumulate summary totals across chunks
  }
```

Same chunking applied to `enrichLeads`.

### Fix 2: Resolve parent org for "existing data" enrichment

**File: `src/components/enrichment/UnifiedEnrichmentWizard.tsx`**

At line 1062, the account query uses `userProfile.org_id`. For child orgs, this needs to resolve to the parent org's ID (same pattern used in BulkScoring and PowerUpButton).

- Import `useDataOrgId` hook
- Use the resolved `dataOrgId` for the account fetch query
- Keep `userProfile.org_id` for the `enrichAccounts()` call (scores/ICP belong to child org)

### Files Modified

| File | Change |
|------|--------|
| `src/hooks/use-unified-enrichment.ts` | Add automatic chunking (100 records per request) for both `enrichAccounts` and `enrichLeads` |
| `src/components/enrichment/UnifiedEnrichmentWizard.tsx` | Use `dataOrgId` for account fetch query in existing-data enrichment mode |

### No Backend Changes

The edge function's 100-record limit is correct and stays as-is. Chunking is handled client-side.
