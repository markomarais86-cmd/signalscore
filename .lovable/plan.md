

# Fix: RLS Policy Blocking custom_attribute_definitions for Child Orgs

## Problem

The `custom_attribute_definitions` table has RLS policies that check:
```
org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid())
```

When a child org user (e.g., 91.Life) writes custom attribute definitions, the code uses `dataOrgId` (the parent org, Launchpulse) as the `org_id`. Since the user's profile has `org_id = 91.Life`, the RLS policy rejects the write because Launchpulse is not in the user's `org_id` set.

The same issue affects **reads, updates, and deletes** -- child org users can't see or manage custom attributes stored under the parent org.

## Solution

There are two parts to this fix:

### 1. Database: Update RLS policies to support parent org access

Create a helper function `get_user_accessible_org_ids()` that returns both the user's own org and its parent org (if one exists). Then update all four RLS policies on `custom_attribute_definitions` to use it.

**New function:**
```sql
CREATE OR REPLACE FUNCTION public.get_user_accessible_org_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT org_id FROM user_profiles WHERE user_id = auth.uid()
  UNION
  SELECT get_data_org_id(org_id) FROM user_profiles WHERE user_id = auth.uid()
$$;
```

This returns: the user's own org_id, plus the parent org_id (via the existing `get_data_org_id` function). For standalone orgs, both values are the same so it still works.

**Updated policies (all four):** Change `USING`/`WITH CHECK` from:
```
org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid())
```
to:
```
org_id IN (SELECT get_user_accessible_org_ids())
```

### 2. Frontend: No changes needed

The code in `CustomAttributeManager.tsx` already uses `dataOrgId` for both reads and writes, which is the correct behavior -- custom attributes are shared data owned by the parent org. The RLS fix is sufficient.

## Technical Details

### Migration SQL

A single migration that:
1. Creates `get_user_accessible_org_ids()` function
2. Drops and recreates all 4 policies on `custom_attribute_definitions`

### Impact

- Child org users will be able to read, create, update, and delete custom attribute definitions stored under the parent org
- Standalone orgs are unaffected (the function returns only their own org_id)
- The new function can be reused for other tables that need the same parent-org access pattern
