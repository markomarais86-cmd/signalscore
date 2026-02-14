

# Sync Master Reference Data into LaunchPulse CRM Accounts

## Current State

- **accounts table**: 14,361 records (all `data_source = 'crm'`)
- **master_account_data table**: 28,287 records (27,736 unique domains)
- **Overlap**: Only 2,119 domains exist in both tables
- **Net new**: ~25,617 domains from master data that are NOT yet in accounts

The master reference data was uploaded but never pushed into the working `accounts` table. This means ~25K accounts are sitting in the reference DB unused.

## Plan

### 1. Create a Database Migration to Sync Master Data into Accounts

Run a SQL migration that inserts/updates all `master_account_data` records into `accounts` as `data_source = 'crm'`, mapped field-by-field:

| master_account_data | accounts |
|---|---|
| Company | name |
| domain_normalized | domain |
| Industry | industry_norm |
| Secondary Industry | sub_industry |
| employee_count_int | employee_count |
| revenue_range | revenue_range |
| HQ Country | country |
| HQ City | city / hq_city |
| HQ State | state_province / hq_state |
| HQ Address | hq_address |
| HQ Postal Code | hq_postal_code |
| HQ Phone | company_main_phone |
| Business Model | business_model |
| founded_year_int | founded_year |
| NAICS 1 | naics |
| Website | (already covered by domain) |

For existing accounts (matching on domain), the migration will enrich/update fields that are currently NULL without overwriting existing data. For new domains, it will insert fresh rows with `data_source = 'crm'`.

The `external_id` for new records will be generated as `'lp-' || domain_normalized` to keep them unique.

### 2. Update Coverage Calculation

The `external_data_sources` table shows Apollo with 66,949 total_accounts as "database". After the sync, all ~27K accounts in the working table will be `data_source = 'crm'`, so the coverage stats (CRM vs Database) will correctly show:
- CRM: ~27K (up from 14K)
- Database: 66,949 (Apollo -- this is the external provider total, unchanged)
- Whitespace: ~40K (database accounts not yet in CRM)

No code changes needed for this -- the existing `use-data-sources` hook already counts by `data_source` filter.

### 3. Rename CRM Label to "LaunchPulse CRM"

Update the data source label in `src/utils/data-source-attribution.ts` so `'crm'` displays as **"LaunchPulse CRM"** instead of just "CRM" throughout the UI.

## Files Changed

| File | Change |
|---|---|
| SQL Migration | INSERT/UPDATE ~25K master_account_data records into accounts as `data_source = 'crm'` |
| `src/utils/data-source-attribution.ts` | Rename CRM label from "CRM" to "LaunchPulse CRM" |

## Expected Result

- Accounts page: ~27K total accounts (up from 14K), all labeled "LaunchPulse CRM"
- Data Completeness: should increase since master data has good field coverage
- Coverage stats: CRM count rises, whitespace (database-only) count adjusts accordingly

