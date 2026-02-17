

# Fix: Bulk Scoring Timeout

## The Problem

The "Score All Accounts" button does reach the edge function, but the function times out because:

1. The `bulk_score_all_accounts` SQL function processes all 39,928 accounts in a **single transaction**, calling `calculate_account_score_readonly` once per account
2. At ~25,000 accounts the 600-second statement timeout is exceeded
3. The edge function has a **60-second runtime limit** and gets killed waiting for the RPC response -- which is why no logs appear

## The Fix: Chunked SQL Processing

Replace the single massive RPC call with chunked processing inside the edge function itself. Instead of one SQL call that scores 40k accounts, process in batches of 2,000.

### Part 1: New SQL Function -- `bulk_score_chunk`

Create a lightweight SQL function that scores a **batch** of accounts using OFFSET/LIMIT:

```text
bulk_score_chunk(org_id, icp_id, chunk_offset, chunk_limit)
  --> scores 2,000 accounts at a time
  --> returns { processed: N }
```

This keeps each SQL call under ~30 seconds.

### Part 2: Rewrite Edge Function to Loop Chunks

The edge function will:
1. Create a `bulk_scoring_jobs` record
2. Count total accounts
3. Loop through chunks of 2,000, calling `bulk_score_chunk` for each
4. Update job progress after each chunk
5. Mark job as completed when done

To handle the edge function's 60-second limit, it will use a "fire-and-continue" pattern: after processing a few chunks, if time is running low, it marks the job as `processing` with progress saved, then the `job-auto-recovery` function picks it back up.

### Part 3: Alternative Simpler Approach -- Direct SQL in Chunks

Actually, the simplest fix: skip the RPC entirely. The edge function can run direct UPDATE queries in chunks using the service-role Supabase client:

```text
For each batch of 2,000 account IDs:
  1. Fetch accounts with their fields
  2. Score them in JavaScript (matching the SQL logic)  
  3. Upsert scores in bulk
  4. Update job progress
```

This avoids the SQL function timeout entirely and keeps each database call small.

## Technical Plan

### Files to Change

1. **`supabase/functions/bulk-score-accounts/index.ts`** -- Rewrite to process accounts in JS chunks of 2,000 instead of calling a single RPC
2. **Database migration** -- Create `bulk_score_chunk` helper function (optional, only if we keep SQL-based scoring)

### Implementation Details

The edge function rewrite will:
- Remove the single `supabase.rpc('bulk_score_all_accounts')` call
- Add a chunked loop: fetch 2,000 accounts, score them, upsert results
- Implement JS-based scoring logic (matching `calculate_account_score_readonly`)
- Update job progress after each chunk
- Handle the 60-second edge function timeout by:
  - Using `waitUntil` / background processing pattern, OR
  - Having each invocation process as many chunks as possible within ~50 seconds, saving progress, then the auto-recovery system resumes it

### Scoring Logic (JS port)

Port the `calculate_account_score_readonly` logic to JavaScript:
- Industry match: 30 points (fuzzy LIKE match against ICP industries)
- Company size: 25 points (range-based matching)
- Geography: 25 points (exact country match)
- Revenue: 20 points (exact range match)
- Vertical filters: up to 15 bonus points
- Overall = sum, capped at 100

### Expected Outcome

- Each chunk takes ~5-10 seconds (2,000 accounts)
- Full 40k accounts complete in ~20 chunks (~2-3 minutes total)
- Job progress updates in real-time so the UI can show a progress bar
- No more timeouts

