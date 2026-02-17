
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
