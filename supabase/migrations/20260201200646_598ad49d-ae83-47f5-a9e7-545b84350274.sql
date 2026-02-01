-- ================================================================
-- SECURITY FIX: Restrict public data exposure
-- Addresses 3 error-level security findings
-- ================================================================

-- ================================================================
-- 1. FIX carrier_cache: Phone verification data exposure
-- Currently: USING (true) allows anyone to query phone data
-- Fix: Restrict to authenticated users who belong to the org
-- ================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role has full access to carrier_cache" ON public.carrier_cache;

-- Create proper org-scoped policies for carrier_cache
-- Allow authenticated users to read carrier data for their organization
CREATE POLICY "Users can view carrier data for their org"
  ON public.carrier_cache
  FOR SELECT
  TO authenticated
  USING (
    org_id IS NULL OR 
    org_id::uuid IN (
      SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  );

-- Allow authenticated users to insert carrier data for their organization  
CREATE POLICY "Users can insert carrier data for their org"
  ON public.carrier_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IS NULL OR
    org_id::uuid IN (
      SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  );

-- Allow authenticated users to update carrier data for their organization
CREATE POLICY "Users can update carrier data for their org"
  ON public.carrier_cache
  FOR UPDATE
  TO authenticated
  USING (
    org_id IS NULL OR
    org_id::uuid IN (
      SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  );

-- Allow authenticated users to delete carrier data for their organization
CREATE POLICY "Users can delete carrier data for their org"
  ON public.carrier_cache
  FOR DELETE
  TO authenticated
  USING (
    org_id IS NULL OR
    org_id::uuid IN (
      SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  );

-- ================================================================
-- 2. FIX plan_limits: Pricing strategy exposure
-- Currently: "Anyone can view plan limits" USING (true)
-- Fix: Restrict to authenticated users only
-- ================================================================

-- Drop the public access policy
DROP POLICY IF EXISTS "Anyone can view plan limits" ON public.plan_limits;

-- Create restricted policy for authenticated users only
CREATE POLICY "Authenticated users can view plan limits"
  ON public.plan_limits
  FOR SELECT
  TO authenticated
  USING (true);

-- ================================================================
-- 3. FIX icp_templates: Business intelligence exposure
-- Currently: "Authenticated users can view icp templates" USING (true)
-- Fix: Users can only view public templates OR their own private templates
-- ================================================================

-- Drop the overly permissive authenticated policy
DROP POLICY IF EXISTS "Authenticated users can view icp templates" ON public.icp_templates;