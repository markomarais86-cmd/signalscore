-- Update materialized view to calculate campaign-ready metrics from Leads table
-- This migration changes the focus from "contacts" to "leads"

-- Drop and recreate the materialized view with new logic
DROP MATERIALIZED VIEW IF EXISTS public.mv_dashboard_metrics_by_org CASCADE;

CREATE MATERIALIZED VIEW public.mv_dashboard_metrics_by_org AS
SELECT 
  a.org_id,
  COUNT(DISTINCT a.external_id)::integer as total_accounts,
  COUNT(DISTINCT CASE WHEN a.data_source = 'crm' THEN a.external_id END)::integer as crm_accounts,
  COUNT(DISTINCT CASE WHEN a.data_source = 'database' THEN a.external_id END)::integer as database_accounts,
  COUNT(DISTINCT CASE WHEN a.data_source = 'both' THEN a.external_id END)::integer as both_accounts,
  COUNT(DISTINCT s.account_external_id)::integer as scored_accounts,
  COUNT(DISTINCT CASE WHEN s.overall >= 70 THEN s.account_external_id END)::integer as high_fit_accounts,
  COUNT(DISTINCT CASE WHEN s.overall >= 50 AND s.overall < 70 THEN s.account_external_id END)::integer as medium_fit_accounts,
  COUNT(DISTINCT CASE WHEN s.overall < 50 THEN s.account_external_id END)::integer as low_fit_accounts,
  COUNT(DISTINCT CASE WHEN s.overall >= 70 AND a.data_source IN ('crm', 'both') THEN s.account_external_id END)::integer as high_fit_crm,
  COUNT(DISTINCT CASE WHEN s.overall >= 70 AND a.data_source = 'database' THEN s.account_external_id END)::integer as high_fit_database,
  COUNT(DISTINCT CASE WHEN a.industry_norm IS NOT NULL THEN a.external_id END)::integer as with_industry,
  COUNT(DISTINCT CASE WHEN a.employee_count IS NOT NULL THEN a.external_id END)::integer as with_size,
  COUNT(DISTINCT CASE WHEN a.revenue_range IS NOT NULL THEN a.external_id END)::integer as with_revenue,
  COUNT(DISTINCT CASE WHEN a.country IS NOT NULL THEN a.external_id END)::integer as with_geo,
  -- CHANGED: Calculate campaign-ready leads from Leads table
  COUNT(DISTINCT CASE 
    WHEN l.email IS NOT NULL 
    AND l.email != '' 
    AND (l.persona IS NOT NULL OR l.title IS NOT NULL)
    AND s.overall >= 70
    THEN l.id 
  END)::integer as campaign_ready_leads,
  -- CHANGED: Calculate campaign-ready accounts (accounts with campaign-ready leads)
  COUNT(DISTINCT CASE 
    WHEN l.email IS NOT NULL 
    AND l.email != '' 
    AND (l.persona IS NOT NULL OR l.title IS NOT NULL)
    AND s.overall >= 70
    THEN a.external_id 
  END)::integer as campaign_ready_accounts,
  now() as computed_at
FROM public.accounts a
LEFT JOIN public.scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
LEFT JOIN public."Leads" l ON a.external_id = l.account_external_id AND a.org_id = l.org_id
GROUP BY a.org_id;

-- Create index for fast lookups
CREATE UNIQUE INDEX idx_mv_dashboard_metrics_org ON public.mv_dashboard_metrics_by_org(org_id);

-- Refresh the view with initial data
REFRESH MATERIALIZED VIEW public.mv_dashboard_metrics_by_org;

-- Grant permissions
GRANT SELECT ON public.mv_dashboard_metrics_by_org TO authenticated;

COMMENT ON MATERIALIZED VIEW public.mv_dashboard_metrics_by_org IS 'Cached dashboard metrics per organization - refreshed on data changes. Campaign-ready metrics now calculated from Leads table.';