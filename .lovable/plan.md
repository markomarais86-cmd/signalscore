

# Fix Large Leads Upload (300MB+ CSV Support)

## Problem

The Data Upload page sends the **entire CSV dataset in a single edge function call** (line 215 of `DataUpload.tsx`). Supabase Edge Functions have a ~6MB request body limit, so a 300MB CSV (likely 500K-1M+ rows) will fail immediately.

## Solution

Apply the same **client-side chunking** pattern already working for Reference DB uploads. The browser reads and parses the CSV locally, then sends it in 5,000-row batches to the `bulk-upload` edge function. No need to upload via Supabase dashboard or Google Drive.

## What Changes

### 1. Chunked Upload in `DataUpload.tsx`

Replace the single `supabase.functions.invoke('bulk-upload', { body: { data: rawData, ... } })` call with a loop that:

1. Splits `rawData` into chunks of 5,000 rows
2. Sends each chunk sequentially to `bulk-upload`
3. Updates progress bar per-batch (e.g., "Batch 3 of 40...")
4. Accumulates results (inserted counts, errors)
5. Runs `bulk_match_all_leads` once at the end (not per batch)

### 2. Update `bulk-upload` Edge Function

The function already processes in 1,000-row sub-batches internally, so it handles chunked input well. Minor change needed:

- Add a `skipMatching` parameter so per-chunk calls skip the matching step
- Only the final call (or the client after all chunks) triggers matching
- This prevents running `bulk_match_all_leads` 40+ times

### 3. Progress UX

- Show a real progress bar: "Uploading batch 12 of 40 (60,000 / 200,000 leads)"
- After all chunks uploaded, show "Matching leads to accounts..."
- Final summary with total inserted, matched, and errors

## Technical Details

### File: `src/pages/DataUpload.tsx`

In the `rawData.length > 5000` branch (lines 206-234), replace the single call with:

```text
const CHUNK_SIZE = 5000;
const totalChunks = Math.ceil(rawData.length / CHUNK_SIZE);
let totalInserted = 0;

for (let i = 0; i < totalChunks; i++) {
  const chunk = rawData.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
  setUploadProgress(20 + Math.round((i / totalChunks) * 60));
  // call bulk-upload with { data: chunk, mapping, orgId, skipMatching: true }
  // accumulate totalInserted
}

// After all chunks: call bulk-upload once more with { triggerMatching: true, orgId }
// or call match-leads-to-accounts directly
setUploadProgress(85);
```

### File: `supabase/functions/bulk-upload/index.ts`

- Accept `skipMatching: boolean` parameter (default false)
- When `skipMatching` is true, skip the `bulk_match_all_leads` RPC call and contact creation
- Add a separate mode: when `triggerMatchingOnly: true` is sent (with no data), just run matching and scoring

### No Database Changes

The `Leads` table already exists with all columns. The `bulk_match_all_leads` function already exists. No new tables or migrations needed.

## Flow

```text
Browser (300MB CSV)                    Edge Function (bulk-upload)
  |                                          |
  |-- Parse CSV locally (~1M rows) -------> |
  |                                          |
  |-- Chunk 1 (rows 1-5000) + skip match -->|-- upsert 5 x 1000 batches
  |<-- { inserted: 4950 } ------------------|
  |                                          |
  |-- Chunk 2 (rows 5001-10000) ----------->|-- upsert 5 x 1000 batches  
  |<-- { inserted: 4980 } ------------------|
  |                                          |
  |   ... (~40-200 chunks) ...               |
  |                                          |
  |-- Final: triggerMatchingOnly=true ------>|-- bulk_match_all_leads
  |<-- { matched: X, accounts_created: Y } -|
  |                                          |
  |-- Show summary                           |
```

## What You Do

1. Approve this plan
2. I make the code changes
3. Go to **Data Upload > Leads tab** in the app
4. Pick your 300MB CSV using the file browser (no size limit from browser file picker)
5. Map your columns as usual
6. Watch the progress bar as it uploads in batches
7. Done -- leads are in the system, matched to accounts, and scored

No need for Supabase dashboard uploads or Google Drive access.
