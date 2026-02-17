
# Fix: Connect 91.Life Org Data -- ICP + Accounts + Dashboard

## What's Actually Wrong

The code changes from the last round (effectiveOrgId in wizard, company keywords, etc.) are all correctly deployed. The problem is **data**:

1. **The ICP is STILL under Launchpulse** (org `726a0dc0`), not 91.Life (`cd592f73`). The previous migration that was supposed to move it either didn't run or was reverted by a subsequent migration.
2. **91.Life has ZERO accounts** -- no CRM accounts, no database accounts, no leads. The dashboard is empty because there is genuinely no data under that org ID.
3. **No scores exist** for 91.Life since there are no accounts to score.

The dashboard code correctly uses `effectiveOrgId` to query, but it's querying an empty org.

## What Needs to Happen

### Step 1: Move the ICP to 91.Life (again)
The ICP `f0d17a6b-6476-4e2d-a90f-9afc8d8e232b` currently has `org_id = 726a0dc0` (Launchpulse). Update it to `cd592f73` (91.Life).

```sql
UPDATE icp_profiles
SET org_id = 'cd592f73-3e0e-478d-905b-47fe7c5fb634'
WHERE id = 'f0d17a6b-6476-4e2d-a90f-9afc8d8e232b';
```

### Step 2: Decide on account data strategy

The 91.Life org currently has zero accounts. There are two options:

**Option A: Copy relevant accounts from Launchpulse to 91.Life**
- Filter Launchpulse's 39,928 accounts by healthcare/hospital industry
- Insert copies with `org_id = cd592f73` and `data_source = 'database'`
- This gives 91.Life its own dataset to score against

**Option B: Keep accounts under Launchpulse, just view via org switcher**
- This means the ICP should also stay under Launchpulse
- When switched to 91.Life, the dashboard will always be empty unless accounts are added
- This only makes sense if 91.Life will have its own CRM import

We need to clarify which approach is intended before proceeding.

### Step 3: After accounts exist, run scoring
Once accounts exist under 91.Life, the scoring engine needs to run against them using the Heart+ ICP to populate the `scores` table. This is what makes the dashboard show fit breakdowns (high/medium/low).

### Step 4: Refresh the dashboard metrics cache
The materialized view (`get_dashboard_metrics_cached`) needs to be refreshed after scoring so the dashboard picks up the new data.

## Technical Details

### Database Changes
- SQL migration to move ICP org_id (again)
- SQL to copy/create accounts under 91.Life (depending on chosen approach)
- Trigger scoring run via edge function
- Refresh metrics cache

### No Code Changes Required
All code changes from the previous round are already correctly in place:
- ICPWizard uses `effectiveOrgId` for saves
- ICPWizardStep2 uses `effectiveOrgId` for custom attrs + match counts + company keywords
- ICPWizardStep3 uses `effectiveOrgId` for lead title suggestions
- Dashboard uses `effectiveOrgId` for all data queries
- Company keywords field and scoring engine are deployed

### Why the Dashboard Shows Nothing
The dashboard queries `accounts`, `scores`, and `icp_profiles` all filtered by `org_id = effectiveOrgId` (91.Life). Since 91.Life has:
- 0 accounts
- 0 scores  
- 0 ICP profiles (ICP is still under Launchpulse)

...every metric returns 0. This is correct behavior -- the data simply isn't there.
