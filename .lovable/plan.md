

# Clean Up Test Onboarding Corp

## What Will Be Deleted

The test org `2cdf2add-9d96-4b13-991d-ebbb400becde` ("Test Onboarding Corp") and all its provisioned data across 6 tables:

| Table | Records | Details |
|-------|---------|---------|
| ai_agent_registry | 4 | lead_qualification, data_enrichment, follow_up, meeting_scheduler |
| alerts | 2 | api_credits_low, service_degraded |
| external_data_sources | 1 | Apollo provider record |
| icp_profiles | 1 | Extracted ICP from test onboarding |
| audit_logs | 1 | Onboarding audit entry |
| organizations | 1 | The org itself |

## Execution Order

Child records must be deleted before the parent org (foreign key constraints):

1. Delete from `ai_agent_registry` where org_id matches
2. Delete from `alerts` where org_id matches
3. Delete from `external_data_sources` where org_id matches
4. Delete from `icp_profiles` where org_id matches
5. Delete from `audit_logs` where org_id matches
6. Delete from `organizations` where id matches

## Technical Details

All deletions use the Supabase data insert/update tool (not migrations, since these are data operations). Each DELETE targets rows by `org_id = '2cdf2add-9d96-4b13-991d-ebbb400becde'`, except the org table itself which uses `id`.

No code changes are needed -- this is purely a database cleanup.

