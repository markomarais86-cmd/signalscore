
# Update `route-lead` with Capacity and Working Hours Checks

## What Changes

The `route-lead` edge function currently assigns a lead to whichever rep is specified on the first matching routing rule (`matchedRule.assigned_to`), with no checks on whether that rep is available or at capacity. This update adds two guardrails before assignment:

1. **Working hours check**: Is the assigned rep currently within their working hours (based on their timezone)?
2. **Daily capacity check**: Has the rep already received their `max_leads_per_day` today?

If either check fails, the system overflows to the next available rep in the same org.

---

## Logic Flow

```text
Rule matched -> assigned_to = rep X
  |
  v
Fetch ALL reps for this org (from user_profiles)
  with: working_hours_start, working_hours_end, timezone, max_leads_per_day
  |
  v
Count today's leads per rep (from marketing_leads WHERE routed_at = today)
  |
  v
Is rep X available? (within working hours AND under daily cap)
  YES -> assign to rep X (current behavior)
  NO  -> iterate through other org reps to find first available
         -> if found, assign to overflow rep
         -> if none available, assign to rep X anyway (best effort, log warning)
```

---

## Technical Details

### File: `supabase/functions/route-lead/index.ts`

**New helper function: `findAvailableRep`**

```typescript
async function findAvailableRep(
  supabase, org_id, preferredRepId, now
): Promise<{ repId: string; overflowed: boolean }>
```

This function:
1. Fetches all reps in the org from `user_profiles` with columns: `user_id`, `working_hours_start`, `working_hours_end`, `timezone`, `max_leads_per_day`
2. Counts today's assigned leads per rep by querying `marketing_leads` where `org_id` matches and `routed_at` is today (in each rep's timezone)
3. Builds an availability check per rep:
   - Convert `now` to the rep's timezone and compare against `working_hours_start` / `working_hours_end`
   - Compare today's lead count against `max_leads_per_day`
4. If the preferred rep passes both checks, return them
5. Otherwise, iterate through other reps (sorted by fewest leads today) and return the first available
6. If no reps are available at all, fall back to the preferred rep with `overflowed: false` and a console warning

**Changes to the main handler (around lines 122-151)**

After a routing rule is matched and `matchedRule.assigned_to` is determined:
- Call `findAvailableRep(supabase, org_id, matchedRule.assigned_to, now)`
- Use the returned `repId` instead of `matchedRule.assigned_to` for:
  - `updatePayload.assigned_to`
  - Task creation (`assigned_to` field)
  - Alert metadata
- If `overflowed` is true, log the overflow event and include `overflow_from` and `overflow_to` in the response

**Working hours logic detail**

Since Deno doesn't have native timezone-aware date formatting, the function will:
- Use `Intl.DateTimeFormat` with the rep's timezone to extract current hour/minute
- Compare against `working_hours_start` and `working_hours_end` (stored as TIME, e.g. "09:00", "17:00")
- Handle overnight edge cases (e.g., if start > end, treat as wrapping past midnight)

**Daily count query**

```typescript
const today = new Date(now);
today.setUTCHours(0, 0, 0, 0);

const { data: counts } = await supabase
  .from("marketing_leads")
  .select("assigned_to")
  .eq("org_id", org_id)
  .gte("routed_at", today.toISOString())
  .not("assigned_to", "is", null);
```

Then group by `assigned_to` in-memory to get per-rep counts.

**Response additions**

The response JSON will include two new optional fields:
- `overflow: true/false` -- whether the lead was reassigned from the rule's preferred rep
- `overflow_reason: "capacity" | "working_hours" | null` -- why overflow happened

No database schema changes are needed -- all required columns already exist on `user_profiles`.
