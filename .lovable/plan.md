

# Fix: ICP Manager Not Showing Data When Impersonating

## Root Cause

The `icp_profiles` table has an RLS (Row Level Security) policy that restricts SELECT to:

```
org_id = get_current_user_org_id()
```

This function always returns **your real org_id** (Launchpulse: `726a0dc0-...`), regardless of which org you've selected in the Org Switcher. So when you switch to "Ninety One Life", the frontend sends the query with the correct `org_id`, but the **database blocks it** because your actual user belongs to a different org.

The 91.Life ICP **does exist** in the database -- the RLS policy is just preventing you from seeing it.

## Fix

Add a super admin bypass policy to `icp_profiles` so that super admins can view ICPs for any organization (which is necessary for the Org Switcher to work).

### New SQL Migration

```sql
-- Allow super admins to view all ICP profiles (needed for org switcher)
CREATE POLICY "Super admins can view all ICPs"
  ON public.icp_profiles
  FOR SELECT
  USING (public.is_super_admin());

-- Allow super admins to update all ICP profiles
CREATE POLICY "Super admins can update all ICPs"
  ON public.icp_profiles
  FOR UPDATE
  USING (public.is_super_admin());

-- Allow super admins to delete all ICP profiles
CREATE POLICY "Super admins can delete all ICPs"
  ON public.icp_profiles
  FOR DELETE
  USING (public.is_super_admin());
```

Since PostgreSQL RLS policies are **OR-ed together** (PERMISSIVE mode), adding these policies means:
- Regular users: can still only see their own org's ICPs (existing policy)
- Super admins: can see ICPs for **any** org (new policy), enabling the Org Switcher to work correctly

### Files Changed
- **New migration file** -- Single SQL migration adding 3 super admin bypass policies to `icp_profiles`

### Result
After this fix, when you switch to "Ninety One Life" in the Org Switcher, the 91.Life Heart+ ICP will appear in the ICP Manager with all its populated fields.

