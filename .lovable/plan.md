

## Fill Missing Enrichment: 163 Hospital Accounts

Run the `enrich-unified` edge function against hospital accounts to auto-populate `bed_count`, `facility_type`, and `ehr_system` via Perplexity.

### What happens

1. **Query hospital accounts** from the database -- filter by Healthcare vertical with missing custom attributes
2. **Call `enrich-unified`** in batches (the function handles up to 500 records per call) with the Launchpulse org ID
3. **Monitor logs** to confirm Perplexity is invoked for each account and returns custom attribute values (using the detailed logging just added)
4. **Verify results** by querying the database for populated `bed_count`, `facility_type`, and `ehr_system` values

### Technical Details

- **Edge function**: `enrich-unified` (already deployed with new logging)
- **Org ID**: `726a0dc0-99c7-43c2-b20f-b849f2760c3f`
- **Record type**: `account`
- **Filter**: Accounts with `industry_norm = 'Healthcare'` (or similar) AND name containing "hospital", limited to ~163 records
- **Config**: Default (Smart Enrichment) -- Perplexity is already wired in for custom attributes in Step 4.5
- **Estimated cost**: ~163 enrichment credits (you have ~3,943 remaining)
- **No code changes required** -- this is purely a batch invocation of the existing pipeline

### Verification

After enrichment completes, query to confirm results:

```sql
SELECT name, domain,
  custom_attributes->>'bed_count' as bed_count,
  custom_attributes->>'facility_type' as facility_type,
  custom_attributes->>'ehr_system' as ehr_system
FROM accounts
WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f'
  AND name ILIKE '%hospital%'
  AND custom_attributes->>'bed_count' IS NOT NULL
ORDER BY name
LIMIT 20;
```

