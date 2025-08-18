-- Fix Security Issues: Hide materialized views from API and add missing RLS policies

-- 1. Hide materialized views from API by revoking public access
REVOKE ALL ON public.mv_score_distribution FROM anon, authenticated;
REVOKE ALL ON public.mv_leads_by_week FROM anon, authenticated;

-- 2. Add missing RLS policies for user_profiles
-- INSERT policy with org_id validation
CREATE POLICY "Users can create their own profile with correct org" 
ON public.user_profiles 
FOR INSERT 
WITH CHECK (user_id = auth.uid() AND org_id = get_current_user_org_id());

-- DELETE policy restricted to admins only
CREATE POLICY "Only admins can delete user profiles" 
ON public.user_profiles 
FOR DELETE 
USING (is_current_user_admin() AND org_id = get_current_user_org_id());

-- 3. Add missing RLS policies for icp_templates
-- DELETE policy for template owners
CREATE POLICY "Users can delete their own templates" 
ON public.icp_templates 
FOR DELETE 
USING (created_by = auth.uid());

-- SELECT policy for private templates (users can see their own private templates)
CREATE POLICY "Users can view their private templates" 
ON public.icp_templates 
FOR SELECT 
USING (created_by = auth.uid() AND is_public = false);

-- 4. Add missing DELETE policy for icp_validation_results
CREATE POLICY "Only admins can delete validation results" 
ON public.icp_validation_results 
FOR DELETE 
USING (is_current_user_admin() AND org_id = get_current_user_org_id());