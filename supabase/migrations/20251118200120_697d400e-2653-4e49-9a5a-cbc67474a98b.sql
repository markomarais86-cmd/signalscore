-- Phase 2: Add Medium and Low Fit breakdowns by source
-- Drop and recreate the function with additional fit level breakdowns

DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid, text);

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(
  p_org_id uuid,
  p_source_filter text DEFAULT 'all'
)
RETURNS TABLE (
  total_accounts bigint,
  scored_accounts bigint,
  high_fit_accounts bigint,
  medium_fit_accounts bigint,
  low_fit_accounts bigint,
  total_leads bigint,
  high_fit_leads bigint,
  data_completeness numeric,
  crm_accounts bigint,
  database_accounts bigint,
  crm_scored_accounts bigint,
  database_scored_accounts bigint,
  high_fit_crm_accounts bigint,
  high_fit_database_accounts bigint,
  medium_fit_crm_accounts bigint,
  medium_fit_database_accounts bigint,
  low_fit_crm_accounts bigint,
  low_fit_database_accounts bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH source_breakdown AS (
    SELECT
      COUNT(*) FILTER (WHERE a.data_source IN ('crm', 'both')) as crm_count,
      COUNT(*) FILTER (WHERE a.data_source = 'database') as db_count,
      COUNT(*) as total_count
    FROM public.accounts a
    WHERE a.org_id = p_org_id
      AND (
        p_source_filter = 'all'
        OR (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both'))
        OR (p_source_filter = 'database' AND a.data_source = 'database')
      )
  ),
  scored_metrics AS (
    SELECT
      COUNT(DISTINCT s.account_external_id) as scored_count,
      COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.overall >= 70) as high_fit_count,
      COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.overall >= 50 AND s.overall < 70) as medium_fit_count,
      COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.overall < 50) as low_fit_count,
      COUNT(DISTINCT s.account_external_id) FILTER (
        WHERE s.overall >= 70 
        AND a.data_source IN ('crm', 'both')
      ) as high_fit_crm,
      COUNT(DISTINCT s.account_external_id) FILTER (
        WHERE s.overall >= 70 
        AND a.data_source = 'database'
      ) as high_fit_db,
      COUNT(DISTINCT s.account_external_id) FILTER (
        WHERE s.overall >= 50 AND s.overall < 70 
        AND a.data_source IN ('crm', 'both')
      ) as medium_fit_crm,
      COUNT(DISTINCT s.account_external_id) FILTER (
        WHERE s.overall >= 50 AND s.overall < 70 
        AND a.data_source = 'database'
      ) as medium_fit_db,
      COUNT(DISTINCT s.account_external_id) FILTER (
        WHERE s.overall < 50 
        AND a.data_source IN ('crm', 'both')
      ) as low_fit_crm,
      COUNT(DISTINCT s.account_external_id) FILTER (
        WHERE s.overall < 50 
        AND a.data_source = 'database'
      ) as low_fit_db,
      COUNT(DISTINCT s.account_external_id) FILTER (
        WHERE a.data_source IN ('crm', 'both')
      ) as crm_scored,
      COUNT(DISTINCT s.account_external_id) FILTER (
        WHERE a.data_source = 'database'
      ) as db_scored
    FROM public.scores s
    INNER JOIN public.accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
    WHERE s.org_id = p_org_id
      AND (
        p_source_filter = 'all'
        OR (p_source_filter = 'crm' AND a.data_source IN ('crm', 'both'))
        OR (p_source_filter = 'database' AND a.data_source = 'database')
      )
  ),
  lead_metrics AS (
    SELECT
      COUNT(*) as lead_count,
      COUNT(*) FILTER (
        WHERE l.account_external_id IN (
          SELECT s.account_external_id 
          FROM public.scores s 
          WHERE s.org_id = p_org_id AND s.overall >= 70
        )
      ) as high_fit_lead_count
    FROM public."Leads" l
    WHERE l.org_id = p_org_id
      AND (
        p_source_filter = 'all'
        OR (p_source_filter = 'crm' AND EXISTS (
          SELECT 1 FROM public.accounts a 
          WHERE a.external_id = l.account_external_id 
          AND a.org_id = l.org_id 
          AND a.data_source IN ('crm', 'both')
        ))
        OR (p_source_filter = 'database' AND EXISTS (
          SELECT 1 FROM public.accounts a 
          WHERE a.external_id = l.account_external_id 
          AND a.org_id = l.org_id 
          AND a.data_source = 'database'
        ))
      )
  ),
  completeness_calc AS (
    SELECT
      CASE 
        WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND(
          (
            COUNT(*) FILTER (WHERE industry_norm IS NOT NULL)::numeric +
            COUNT(*) FILTER (WHERE employee_count IS NOT NULL)::numeric +
            COUNT(*) FILTER (WHERE revenue_range IS NOT NULL)::numeric +
            COUNT(*) FILTER (WHERE country IS NOT NULL)::numeric
          ) / (COUNT(*) * 4) * 100,
          1
        )
      END as completeness
    FROM public.accounts
    WHERE org_id = p_org_id
      AND (
        p_source_filter = 'all'
        OR (p_source_filter = 'crm' AND data_source IN ('crm', 'both'))
        OR (p_source_filter = 'database' AND data_source = 'database')
      )
  )
  SELECT
    COALESCE(sb.total_count, 0)::bigint as total_accounts,
    COALESCE(sm.scored_count, 0)::bigint as scored_accounts,
    COALESCE(sm.high_fit_count, 0)::bigint as high_fit_accounts,
    COALESCE(sm.medium_fit_count, 0)::bigint as medium_fit_accounts,
    COALESCE(sm.low_fit_count, 0)::bigint as low_fit_accounts,
    COALESCE(lm.lead_count, 0)::bigint as total_leads,
    COALESCE(lm.high_fit_lead_count, 0)::bigint as high_fit_leads,
    COALESCE(cc.completeness, 0)::numeric as data_completeness,
    COALESCE(sb.crm_count, 0)::bigint as crm_accounts,
    COALESCE(sb.db_count, 0)::bigint as database_accounts,
    COALESCE(sm.crm_scored, 0)::bigint as crm_scored_accounts,
    COALESCE(sm.db_scored, 0)::bigint as database_scored_accounts,
    COALESCE(sm.high_fit_crm, 0)::bigint as high_fit_crm_accounts,
    COALESCE(sm.high_fit_db, 0)::bigint as high_fit_database_accounts,
    COALESCE(sm.medium_fit_crm, 0)::bigint as medium_fit_crm_accounts,
    COALESCE(sm.medium_fit_db, 0)::bigint as medium_fit_database_accounts,
    COALESCE(sm.low_fit_crm, 0)::bigint as low_fit_crm_accounts,
    COALESCE(sm.low_fit_db, 0)::bigint as low_fit_database_accounts
  FROM source_breakdown sb
  CROSS JOIN scored_metrics sm
  CROSS JOIN lead_metrics lm
  CROSS JOIN completeness_calc cc;
END;
$$;