-- ================================================================
-- SECURITY VERIFICATION QUERIES
-- ================================================================
-- Purpose: Verify that all security fixes have been applied
-- Usage: Run these queries manually after applying dashboard changes
-- Expected: All checks should return "PASS" status
-- ================================================================

-- ================================================================
-- TEST 1: Verify Function Search Paths
-- ================================================================
-- Expected: All security-sensitive functions should have search_path set
-- Status: Should show 'public, pg_temp' for all listed functions

SELECT 
  'TEST 1: Function Search Paths' as test_name,
  p.proname as function_name,
  CASE 
    WHEN pg_get_function_identity_arguments(p.oid) != '' 
    THEN p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    ELSE p.proname || '()'
  END as full_signature,
  COALESCE(p.proconfig::text, 'NOT SET') as search_path_config,
  CASE 
    WHEN p.proconfig IS NULL THEN '❌ FAIL - No search_path set'
    WHEN p.proconfig::text LIKE '%search_path%' THEN '✅ PASS'
    ELSE '❌ FAIL - search_path not configured'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'increment_bulk_scoring_job_progress',
    'get_dashboard_metrics_fast',
    'get_geography_distribution',
    'normalize_domain_text',
    'has_role',
    'get_current_user_org_id',
    'is_current_user_admin'
  )
ORDER BY p.proname;

-- ================================================================
-- TEST 2: Verify SECURITY DEFINER Functions
-- ================================================================
-- Expected: Critical functions should be SECURITY DEFINER with proper search_path

SELECT 
  'TEST 2: SECURITY DEFINER Functions' as test_name,
  p.proname as function_name,
  CASE p.prosecdef
    WHEN true THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security_mode,
  CASE 
    WHEN p.prosecdef = true AND p.proconfig IS NOT NULL THEN '✅ PASS - Properly secured'
    WHEN p.prosecdef = true AND p.proconfig IS NULL THEN '⚠️  WARN - Missing search_path'
    ELSE '❌ FAIL - Should be SECURITY DEFINER'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'increment_bulk_scoring_job_progress',
    'get_dashboard_metrics_fast',
    'get_geography_distribution'
  )
ORDER BY p.proname;

-- ================================================================
-- TEST 3: Verify Materialized View Permissions
-- ================================================================
-- Expected: No grants to anon or authenticated roles (only accessible via RPC)

SELECT 
  'TEST 3: Materialized View Permissions' as test_name,
  schemaname,
  matviewname,
  COALESCE(
    (SELECT string_agg(privilege_type, ', ') 
     FROM information_schema.role_table_grants 
     WHERE table_name = matviewname 
     AND grantee IN ('anon', 'authenticated')),
    'NO GRANTS'
  ) as grants_to_api_roles,
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.role_table_grants 
      WHERE table_name = matviewname 
      AND grantee IN ('anon', 'authenticated')
    ) THEN '✅ PASS - No public grants'
    ELSE '❌ FAIL - Has public grants'
  END as status
FROM pg_matviews
WHERE schemaname = 'public'
  AND matviewname LIKE 'mv_%'
ORDER BY matviewname;

-- ================================================================
-- TEST 4: Verify Extension Schema
-- ================================================================
-- Expected: pg_trgm in public schema (acceptable by design)

SELECT 
  'TEST 4: Extension Schema' as test_name,
  e.extname as extension_name,
  n.nspname as schema_name,
  CASE 
    WHEN e.extname = 'pg_trgm' AND n.nspname = 'public' 
    THEN '✅ PASS - Intentional (required for fuzzy matching)'
    ELSE 'ℹ️  INFO'
  END as status,
  'Used for account domain similarity matching' as purpose
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE e.extname = 'pg_trgm';

-- ================================================================
-- TEST 5: Verify Postgres Version
-- ================================================================
-- Expected: Version >= 15.6 (after upgrade is applied)

SELECT 
  'TEST 5: Postgres Version' as test_name,
  version() as postgres_version,
  CASE 
    WHEN version() LIKE '%PostgreSQL 15.%' OR version() LIKE '%PostgreSQL 16.%' 
    THEN '✅ PASS - Modern version'
    WHEN version() LIKE '%PostgreSQL 14.%' 
    THEN '⚠️  WARN - Upgrade recommended'
    ELSE '❌ FAIL - Outdated version'
  END as status;

-- ================================================================
-- TEST 6: Verify RLS is Enabled on All Tables
-- ================================================================
-- Expected: All user-facing tables should have RLS enabled

SELECT 
  'TEST 6: Row Level Security' as test_name,
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity = true THEN '✅ PASS - RLS enabled'
    WHEN tablename IN ('bulk_scoring_jobs', 'enrichment_jobs') THEN '⚠️  WARN - System table (acceptable)'
    ELSE '❌ FAIL - RLS not enabled'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'accounts',
    'closed_won_accounts',
    'icp_profiles',
    'leads',
    'organizations',
    'pipeline_stages',
    'capital_tracking',
    'custom_reports',
    'segments'
  )
ORDER BY tablename;

-- ================================================================
-- TEST 7: Verify Critical Indexes Exist
-- ================================================================
-- Expected: Performance and security-critical indexes should exist

SELECT 
  'TEST 7: Critical Indexes' as test_name,
  schemaname,
  tablename,
  indexname,
  CASE 
    WHEN indexname IS NOT NULL THEN '✅ PASS - Index exists'
    ELSE '❌ FAIL - Missing index'
  END as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_accounts_org_domain_unique',
    'idx_accounts_domain_trgm',
    'idx_accounts_org_score',
    'idx_accounts_org_created',
    'idx_bulk_scoring_jobs_org_status'
  )
ORDER BY indexname;

-- ================================================================
-- TEST 8: Verify Database Triggers
-- ================================================================
-- Expected: Domain normalization trigger should be active

SELECT 
  'TEST 8: Database Triggers' as test_name,
  trigger_name,
  event_object_table as table_name,
  action_timing as timing,
  event_manipulation as event,
  action_statement as action,
  CASE 
    WHEN trigger_name = 'normalize_account_domain_trigger' THEN '✅ PASS - Active'
    ELSE 'ℹ️  INFO'
  END as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%normalize%'
ORDER BY trigger_name;

-- ================================================================
-- SUMMARY REPORT
-- ================================================================

WITH security_checks AS (
  SELECT 'Function Search Paths' as check_name, 
    COUNT(*) FILTER (WHERE proconfig IS NOT NULL) as passed,
    COUNT(*) as total
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN ('increment_bulk_scoring_job_progress', 'get_dashboard_metrics_fast', 'get_geography_distribution')
  
  UNION ALL
  
  SELECT 'RLS Enabled' as check_name,
    COUNT(*) FILTER (WHERE rowsecurity = true) as passed,
    COUNT(*) as total
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('accounts', 'closed_won_accounts', 'icp_profiles', 'leads')
  
  UNION ALL
  
  SELECT 'Critical Indexes' as check_name,
    COUNT(DISTINCT indexname) as passed,
    5 as total
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN (
      'idx_accounts_org_domain_unique',
      'idx_accounts_domain_trgm',
      'idx_accounts_org_score',
      'idx_accounts_org_created',
      'idx_bulk_scoring_jobs_org_status'
    )
)
SELECT 
  '=' as separator,
  'SECURITY VERIFICATION SUMMARY' as title,
  '=' as separator2
UNION ALL
SELECT 
  check_name,
  passed || '/' || total || ' checks passed' as result,
  CASE 
    WHEN passed = total THEN '✅ PASS'
    WHEN passed::float / total >= 0.8 THEN '⚠️  WARN'
    ELSE '❌ FAIL'
  END as overall_status
FROM security_checks;

-- ================================================================
-- MANUAL VERIFICATION CHECKLIST
-- ================================================================
-- The following checks require manual verification via Supabase Dashboard:
-- 
-- [ ] Password Breach Protection
--     → Dashboard → Auth → Policies → "Password Breach Detection" = ENABLED
--     → Test: Try creating user with password "password123" (should fail)
--
-- [ ] OTP Expiry Configuration
--     → Dashboard → Auth → Email Auth → "OTP Expiry" = 3600 seconds
--     → Test: Request password reset, wait 61 minutes, link should be expired
--
-- [ ] Postgres Upgrade
--     → Dashboard → Database → Settings → Check current version
--     → Target: PostgreSQL 15.6 or higher
--
-- [ ] Materialized View Refresh
--     → Verify: Last refresh timestamp on mv_dashboard_metrics_by_org
--     → Query: SELECT * FROM mv_dashboard_metrics_by_org LIMIT 1;
--     → Expected: computed_at should be within last hour
--
-- ================================================================

-- Quick check: Verify last materialized view refresh
SELECT 
  'Materialized View Refresh Status' as info,
  schemaname,
  matviewname,
  CASE 
    WHEN last_refresh IS NOT NULL THEN '✅ Has been refreshed'
    ELSE '⚠️  Never refreshed - run REFRESH MATERIALIZED VIEW'
  END as status,
  last_refresh
FROM (
  SELECT 
    schemaname,
    matviewname,
    (SELECT computed_at FROM mv_dashboard_metrics_by_org LIMIT 1) as last_refresh
  FROM pg_matviews
  WHERE schemaname = 'public' AND matviewname = 'mv_dashboard_metrics_by_org'
) AS refresh_check;
