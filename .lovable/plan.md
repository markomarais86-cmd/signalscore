

## Test Fill Missing Enrichment on a Real Hospital Account

Your enrichment credit limit is already at **15,000** (11,057 used, ~3,943 remaining) -- no change needed there.

This plan runs a single test enrichment on **Nathan Littauer Hospital** (nlh.org, 501 employees) to verify Perplexity fills `bed_count`, `facility_type`, and `ehr_system`.

### What happens

1. **Call `enrich-unified`** edge function with Nathan Littauer Hospital as the single record, using standard config (no bypass needed since credits are available)
2. **Check edge function logs** to confirm Perplexity (`sonar-pro`) was invoked and what custom attribute values it returned
3. **Query the database** to verify `custom_attributes` on the account now contains `bed_count`, `facility_type`, and `ehr_system`

### Technical Details

- **Edge function call**: POST to `enrich-unified` with:
  - `org_id`: `726a0dc0-99c7-43c2-b20f-b849f2760c3f`
  - `record_type`: `account`
  - `records`: one record for Nathan Littauer Hospital (id, external_id, name, domain)
  - No special config needed -- credits are available and Perplexity is already wired in

- **No code changes required** -- this is purely a test invocation of the existing pipeline
- **Expected result**: `custom_attributes` JSONB column populated with values like `{ "bed_count": 74, "facility_type": "Critical Access Hospital", "ehr_system": "..." }`
- **Cost**: ~1 enrichment credit

### Why This Account

Nathan Littauer Hospital is a real 74-bed community hospital in Gloversville, NY. Public data for `bed_count`, `facility_type`, and `ehr_system` should be readily available to Perplexity, making it an ideal test case (unlike the previous dental practice test).

