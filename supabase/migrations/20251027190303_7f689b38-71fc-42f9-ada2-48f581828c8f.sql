-- Add RLS policies for super admins to create and manage organizations

-- Allow super admins to insert new organizations
CREATE POLICY "Super admins can create organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (is_super_admin());

-- Allow super admins to update organizations
CREATE POLICY "Super admins can update organizations"
ON public.organizations
FOR UPDATE
TO authenticated
USING (is_super_admin());

-- Allow super admins to view all organizations
CREATE POLICY "Super admins can view all organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (is_super_admin());