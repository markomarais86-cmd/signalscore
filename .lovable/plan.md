

# Upload ZoomInfo Reference Data to Master Account DB

## Problem

The `upload-master-data` edge function maps CSV columns to wrong field names (`domain`, `company_name`, `founded_year`) that don't match the actual `master_account_data` table columns (`Company`, `Website`, `Founded Year`). The table already has 28,287 records and uses the raw CSV header names as column names.

Your CSV has ~70,466 data rows -- too large for a single edge function call (would timeout). We need **client-side chunking** like before.

## Solution

### 1. Fix the Edge Function (`upload-master-data`)

Rewrite `mapRowToRecord()` to return objects matching the actual table columns:

- `Company` (not `company_name`)
- `Website` (not `domain`)
- `Founded Year`, `HQ Phone`, `Annual Revenue`, `No. of Employees`, `NAICS 1`-`4`, `Industry`, `Secondary Industry`, `Business Model`, `HQ Address`, `HQ City`, `HQ State`, `HQ Postal Code`, `HQ Country`, `Lead Source`, `Lead Source Details`
- Auto-compute derived columns: `domain_normalized` (from Website), `revenue_range` (from Annual Revenue), `employee_count_int` (parsed integer), `founded_year_int` (parsed integer)

The function will accept a JSON body with `{ rows: [...] }` (pre-parsed array of objects) instead of raw CSV, since the browser will do the CSV parsing.

Upsert on `domain_normalized` to deduplicate.

### 2. Add Reference DB Upload Tab in Settings

Add a **"Reference DB"** tab to `DataUploadContent.tsx` (alongside Leads and Closed Won):

- File picker for CSV
- Client-side CSV parsing using the existing `parseCSV()` utility
- Chunked upload: sends 5,000 rows per batch to `upload-master-data`
- Real-time progress bar showing batch X of Y
- Summary on completion: records upserted, duplicates skipped, errors

### 3. Client-Side Chunking Flow

```text
Browser                          Edge Function
  |                                    |
  |-- Parse CSV (70K rows) ---------->|
  |                                    |
  |-- Batch 1 (rows 1-5000) -------->|-- upsert to master_account_data
  |<-- { upserted: 4950 } -----------|
  |                                    |
  |-- Batch 2 (rows 5001-10000) ---->|-- upsert to master_account_data
  |<-- { upserted: 4980 } -----------|
  |                                    |
  |   ... (14 batches total) ...      |
  |                                    |
  |-- Show final summary              |
```

## Technical Details

### Edge Function Changes (`supabase/functions/upload-master-data/index.ts`)

- Remove the CSV parsing logic (browser handles this now)
- Accept `{ rows: object[] }` JSON body
- For each row, compute:
  - `domain_normalized`: strip protocol/www from `Website`, lowercase
  - `revenue_range`: bucket `Annual Revenue` into ranges
  - `employee_count_int`: parse `No. of Employees` to integer
  - `founded_year_int`: parse `Founded Year` to integer
- Upsert batch to `master_account_data` on conflict `domain_normalized`
- Return `{ upserted, errors }`

### UI Changes (`src/components/settings/DataUploadContent.tsx`)

- Add "Reference DB" tab trigger (visible in advanced mode or always for admins)
- New upload handler `handleReferenceUpload(file)`:
  1. Read CSV text, parse with `parseCSV()`
  2. Split into chunks of 5,000
  3. For each chunk, call `supabase.functions.invoke('upload-master-data', { body: { rows: chunk } })`
  4. Accumulate results, update progress bar
  5. Show final summary with total upserted, current DB count

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/upload-master-data/index.ts` | Rewrite to accept JSON rows, map to correct column names, compute derived fields |
| `src/components/settings/DataUploadContent.tsx` | Add "Reference DB" tab with chunked upload logic |

### No Database Changes Needed

The `master_account_data` table already exists with the correct schema. The unique constraint on `domain_normalized` handles deduplication.

