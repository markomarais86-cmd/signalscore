-- Phase 2 Security Fixes: Fix critical RLS issues
-- 1. Fix master_account_data public read vulnerability
-- 2. Consolidate user_profiles redundant policies

-- ============================================
-- FIX 1: master_account_data - Remove public access
-- ============================================
-- Drop the dangerous public read policy
DROP POLICY IF EXISTS "Anyone can read master data" ON master_account_data;

-- Create secure policy - only authenticated users can read reference data
CREATE POLICY "Authenticated users can read master data" 
ON master_account_data FOR SELECT 
TO authenticated
USING (true);

-- ============================================
-- FIX 2: Consolidate user_profiles SELECT policies
-- ============================================
-- Drop redundant policies (keep org-based policy which is most comprehensive)
DROP POLICY IF EXISTS "Users can read their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile directly" ON user_profiles;

-- The "Users can view profiles in their org" policy remains and covers all cases
-- It uses: org_id = get_current_user_org_id() which properly restricts by organization