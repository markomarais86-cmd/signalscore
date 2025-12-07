-- Phase 1 CORRECTED: Fix critical RLS security issues
-- The master_account_data and recommendation_history policies were already applied
-- Now fix the remaining issues with correct schema knowledge

-- 1. Fix icp_templates - it's a global template table without org_id
-- These are system templates, so we just restrict to authenticated users
DROP POLICY IF EXISTS "Anyone can read icp_templates" ON public.icp_templates;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.icp_templates;

CREATE POLICY "Authenticated users can view icp templates"
ON public.icp_templates
FOR SELECT
TO authenticated
USING (true);

-- 2. Fix rate_limits - ensure org-scoped access
-- First check if RLS is enabled
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Drop any overly permissive policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.rate_limits;
DROP POLICY IF EXISTS "Anyone can read rate limits" ON public.rate_limits;

-- Create org-scoped policy
CREATE POLICY "Users can view their org rate limits"
ON public.rate_limits
FOR SELECT
TO authenticated
USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can manage their org rate limits"
ON public.rate_limits
FOR ALL
TO authenticated
USING (org_id = get_current_user_org_id())
WITH CHECK (org_id = get_current_user_org_id());