-- Allow super admins to view feature flags for all organizations
CREATE POLICY "Super admins can view all feature flags"
ON public.feature_flags
FOR SELECT
TO authenticated
USING (is_super_admin());

-- Allow super admins to insert feature flags for any organization
CREATE POLICY "Super admins can insert feature flags for any org"
ON public.feature_flags
FOR INSERT
TO authenticated
WITH CHECK (is_super_admin());

-- Allow super admins to update feature flags for any organization
CREATE POLICY "Super admins can update feature flags for any org"
ON public.feature_flags
FOR UPDATE
TO authenticated
USING (is_super_admin());

-- Allow super admins to delete feature flags for any organization
CREATE POLICY "Super admins can delete feature flags for any org"
ON public.feature_flags
FOR DELETE
TO authenticated
USING (is_super_admin());