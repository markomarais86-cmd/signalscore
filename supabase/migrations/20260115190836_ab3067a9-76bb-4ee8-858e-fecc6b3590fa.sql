
-- Fix: The old permissive SELECT policy still exists, need to drop and recreate
DROP POLICY IF EXISTS "Authenticated users can read master data" ON master_account_data;
DROP POLICY IF EXISTS "Only admins can view master data directly" ON master_account_data;

-- Create the restrictive policy
CREATE POLICY "Only admins can view master data directly"
ON master_account_data FOR SELECT
TO authenticated
USING (public.is_current_user_admin());
