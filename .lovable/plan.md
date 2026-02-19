

# Fix Lead Qualification Agent: 0 Records Every Run

## Root Cause

The agent has a **parent/child org mismatch** in its query path. It correctly resolves the parent org for fetching leads, but queries scores using the child org ID.

```text
Query Path (current - broken):
  org_id = cd592f73 (Ninety One Life - child)
  dataOrgId = 726a0dc0 (LaunchPulse - parent)

  Step 1: scores WHERE org_id = cd592f73  --> 39,928 rows (but only since TODAY)
  Step 2: leads WHERE org_id = 726a0dc0   --> 53,190 rows
  Step 3: leads matched to high-fit scores --> 1,489 (works NOW, was 0 before today)
```

**Why it returned 0 on every run (Feb 14-16):** Scores for `cd592f73` were only computed today (Feb 19, 15:13-15:26 UTC). Before that, the scores table had zero rows for the child org. The agent queried scores on the child org, found nothing, and exited with 0 leads.

**Why it will break again:** The scoring pipeline stores scores under whichever org triggers it. If scoring runs under the parent org (726a0dc0), the agent on the child org (cd592f73) will miss all of them. This is fragile and will break whenever the score data moves.

## The Fix

Use `dataOrgId` (parent org) consistently for BOTH scores and leads queries. This matches the existing pattern: leads and accounts live under the parent org, so scores should be queried there too.

### File: `supabase/functions/agent-lead-qualification/index.ts`

**Change 1** - Line 224: Fix adaptive threshold count query

```typescript
// Before:
.eq('org_id', org_id)

// After:
.eq('org_id', dataOrgId)
```

**Change 2** - Line 248: Fix high-fit scores query

```typescript
// Before:
.eq('org_id', org_id)

// After:
.eq('org_id', dataOrgId)
```

These are the only two lines that need to change. The leads query (line 271) already correctly uses `dataOrgId`.

## Impact

| Metric | Before Fix | After Fix |
|--------|-----------|-----------|
| Scores queried from | Child org (cd592f73) | Parent org (726a0dc0) |
| Accounts scoring >= 50 | 635 (child, only since today) | 11,310 (parent, stable) |
| Accounts scoring >= 70 | 24 (child) | 1,859 (parent) |
| Leads matched | 0-1,489 (fragile) | ~5,000+ (stable) |
| Adaptive threshold needed | Yes (always < 50 high-scorers) | No (1,859 >= 50) |

## Secondary Issue: LeadQualificationQueue UI Component

The `LeadQualificationQueue.tsx` component filters leads with `.is("status", null)` (line 30), but no leads have NULL status -- all 53,190 have `status = 'open'`. This means the UI queue always shows empty ("All leads have been qualified!") even though nothing has been qualified. This should be updated to filter for `status = 'open'` to match the actual data.

### File: `src/components/agents/LeadQualificationQueue.tsx`

**Change** - Line 30: Fix status filter

```typescript
// Before:
.is("status", null)

// After:
.eq("status", "open")
```

## Deployment

After making the two edge function line changes and the UI fix:
1. Deploy `agent-lead-qualification`
2. Trigger a test run to verify leads are now found and processed
