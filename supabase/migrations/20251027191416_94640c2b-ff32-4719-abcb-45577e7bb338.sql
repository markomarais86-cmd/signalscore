-- Add status column to organizations table and policies for super admins to manage them
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- Add RLS policy for super admins to delete organizations
CREATE POLICY "Super admins can delete organizations"
ON public.organizations
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Create function to deactivate organization
CREATE OR REPLACE FUNCTION public.deactivate_organization(org_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only super admins can deactivate
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin privileges required';
  END IF;

  UPDATE public.organizations
  SET status = 'inactive'
  WHERE id = org_id_param;
END;
$$;

-- Create function to activate organization
CREATE OR REPLACE FUNCTION public.activate_organization(org_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only super admins can activate
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin privileges required';
  END IF;

  UPDATE public.organizations
  SET status = 'active'
  WHERE id = org_id_param;
END;
$$;