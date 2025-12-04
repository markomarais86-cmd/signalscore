
-- Fix the security definer view by explicitly setting SECURITY INVOKER
DROP VIEW IF EXISTS public.account_processing_stats;

CREATE VIEW public.account_processing_stats 
WITH (security_invoker = true)
AS
SELECT 
  a.org_id,
  COUNT(*) as total_accounts,
  COUNT(*) FILTER (WHERE a.enriched_at IS NOT NULL) as enriched_accounts,
  COUNT(*) FILTER (WHERE s.overall IS NOT NULL) as scored_accounts,
  COUNT(*) FILTER (WHERE a.icp_qualified = true) as icp_qualified_accounts
FROM public.accounts a
LEFT JOIN public.scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
GROUP BY a.org_id;
