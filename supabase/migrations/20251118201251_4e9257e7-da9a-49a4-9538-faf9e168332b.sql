-- Phase 3: Add Medium/Low Fit Lead breakdowns by source (CRM vs Database)
-- Drop and recreate function with extended return type

DROP FUNCTION IF EXISTS public.get_dashboard_metrics_fast(uuid, text);

CREATE FUNCTION public.get_dashboard_metrics_fast(
  p_org_id uuid,
  p_source_filter text DEFAULT 'all'
)
RETURNS TABLE (
  total_accounts bigint,
  total_leads bigint,
  crm_accounts bigint,
  database_accounts bigint,
  both_accounts bigint,
  crm_scored_accounts bigint,
  database_scored_accounts bigint,
  linked_leads bigint,
  high_fit_accounts bigint,
  medium_fit_accounts bigint,
  low_fit_accounts bigint,
  high_fit_crm_accounts bigint,
  high_fit_database_accounts bigint,
  medium_fit_crm_accounts bigint,
  medium_fit_database_accounts bigint,
  low_fit_crm_accounts bigint,
  low_fit_database_accounts bigint,
  crm_leads bigint,
  database_leads bigint,
  high_fit_leads_total bigint,
  high_fit_crm_leads bigint,
  high_fit_database_leads bigint,
  medium_fit_crm_leads bigint,
  medium_fit_database_leads bigint,
  low_fit_crm_leads bigint,
  low_fit_database_leads bigint,
  campaign_ready_accounts bigint,
  campaign_ready_leads bigint,
  data_completeness numeric,
  apollo_accounts_available bigint,
  apollo_contacts_available bigint,
  apollo_provider text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_condition text;
BEGIN
  IF p_source_filter = 'crm' THEN
    source_condition := 'a.data_source IN (''crm'', ''both'')';
  ELSIF p_source_filter = 'database' THEN
    source_condition := 'a.data_source = ''database''';
  ELSE
    source_condition := 'TRUE';
  END IF;

  RETURN QUERY EXECUTE format($query$
    WITH account_metrics AS (
      SELECT 
        COUNT(DISTINCT a.external_id) as total_accounts,
        COUNT(DISTINCT a.external_id) FILTER (WHERE a.data_source IN ('crm', 'both')) as crm_accounts,
        COUNT(DISTINCT a.external_id) FILTER (WHERE a.data_source = 'database') as database_accounts,
        COUNT(DISTINCT a.external_id) FILTER (WHERE a.data_source = 'both') as both_accounts
      FROM accounts a
      WHERE a.org_id = $1 AND %s
    ),
    scored_metrics AS (
      SELECT
        COUNT(DISTINCT s.account_external_id) FILTER (WHERE a.data_source IN ('crm', 'both')) as crm_scored,
        COUNT(DISTINCT s.account_external_id) FILTER (WHERE a.data_source = 'database') as database_scored,
        COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.overall >= 70) as high_fit,
        COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.overall >= 40 AND s.overall < 70) as medium_fit,
        COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.overall < 40) as low_fit,
        COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.overall >= 70 AND a.data_source IN ('crm', 'both')) as high_fit_crm_accounts,
        COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.overall >= 70 AND a.data_source = 'database') as high_fit_database_accounts,
        COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.overall >= 40 AND s.overall < 70 AND a.data_source IN ('crm', 'both')) as medium_fit_crm_accounts,
        COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.overall >= 40 AND s.overall < 70 AND a.data_source = 'database') as medium_fit_database_accounts,
        COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.overall < 40 AND a.data_source IN ('crm', 'both')) as low_fit_crm_accounts,
        COUNT(DISTINCT s.account_external_id) FILTER (WHERE s.overall < 40 AND a.data_source = 'database') as low_fit_database_accounts
      FROM scores s
      INNER JOIN accounts a ON s.account_external_id = a.external_id AND s.org_id = a.org_id
      WHERE s.org_id = $1 AND %s
    ),
    lead_metrics AS (
      SELECT
        COUNT(DISTINCT l.id) as total_leads,
        COUNT(DISTINCT l.id) FILTER (WHERE l.account_external_id IS NOT NULL) as linked_leads,
        COUNT(DISTINCT l.id) FILTER (WHERE a.data_source IN ('crm', 'both')) as crm_leads,
        COUNT(DISTINCT l.id) FILTER (WHERE a.data_source = 'database') as database_leads,
        COUNT(DISTINCT l.id) FILTER (WHERE s.overall >= 70) as high_fit_leads_total,
        COUNT(DISTINCT l.id) FILTER (WHERE s.overall >= 70 AND a.data_source IN ('crm', 'both')) as high_fit_crm_leads,
        COUNT(DISTINCT l.id) FILTER (WHERE s.overall >= 70 AND a.data_source = 'database') as high_fit_database_leads,
        COUNT(DISTINCT l.id) FILTER (WHERE s.overall >= 40 AND s.overall < 70 AND a.data_source IN ('crm', 'both')) as medium_fit_crm_leads,
        COUNT(DISTINCT l.id) FILTER (WHERE s.overall >= 40 AND s.overall < 70 AND a.data_source = 'database') as medium_fit_database_leads,
        COUNT(DISTINCT l.id) FILTER (WHERE s.overall < 40 AND a.data_source IN ('crm', 'both')) as low_fit_crm_leads,
        COUNT(DISTINCT l.id) FILTER (WHERE s.overall < 40 AND a.data_source = 'database') as low_fit_database_leads
      FROM "Leads" l
      LEFT JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
      LEFT JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
      WHERE l.org_id = $1 AND (a.external_id IS NULL OR %s)
    ),
    campaign_metrics AS (
      SELECT
        COUNT(DISTINCT a.external_id) FILTER (
          WHERE s.overall >= 70 
          AND EXISTS (
            SELECT 1 FROM "Leads" l2
            WHERE l2.account_external_id = a.external_id
            AND l2.org_id = a.org_id
            AND is_lead_campaign_ready(l2.email, l2.title, l2.persona)
          )
        ) as campaign_ready_accounts,
        COUNT(DISTINCT l.id) FILTER (
          WHERE s.overall >= 70 
          AND is_lead_campaign_ready(l.email, l.title, l.persona)
        ) as campaign_ready_leads
      FROM accounts a
      LEFT JOIN scores s ON a.external_id = s.account_external_id AND a.org_id = s.org_id
      LEFT JOIN "Leads" l ON a.external_id = l.account_external_id AND a.org_id = l.org_id
      WHERE a.org_id = $1 AND %s
    ),
    quality_metrics AS (
      SELECT 
        ROUND(
          (
            COUNT(*) FILTER (WHERE industry_norm IS NOT NULL)::numeric +
            COUNT(*) FILTER (WHERE employee_count IS NOT NULL)::numeric +
            COUNT(*) FILTER (WHERE revenue_range IS NOT NULL)::numeric +
            COUNT(*) FILTER (WHERE country IS NOT NULL)::numeric
          ) / NULLIF(COUNT(*) * 4, 0) * 100,
          1
        ) as completeness
      FROM accounts a
      WHERE a.org_id = $1 AND %s
    ),
    apollo_metrics AS (
      SELECT 
        COALESCE(total_accounts, 0) as apollo_accounts,
        COALESCE(total_contacts, 0) as apollo_contacts,
        provider as apollo_provider
      FROM external_data_sources
      WHERE org_id = $1 
        AND is_active = true
        AND provider = 'Apollo'
      ORDER BY last_synced_at DESC
      LIMIT 1
    )
    SELECT 
      COALESCE(am.total_accounts, 0)::bigint,
      COALESCE(lm.total_leads, 0)::bigint,
      COALESCE(am.crm_accounts, 0)::bigint,
      COALESCE(am.database_accounts, 0)::bigint,
      COALESCE(am.both_accounts, 0)::bigint,
      COALESCE(sm.crm_scored, 0)::bigint,
      COALESCE(sm.database_scored, 0)::bigint,
      COALESCE(lm.linked_leads, 0)::bigint,
      COALESCE(sm.high_fit, 0)::bigint,
      COALESCE(sm.medium_fit, 0)::bigint,
      COALESCE(sm.low_fit, 0)::bigint,
      COALESCE(sm.high_fit_crm_accounts, 0)::bigint,
      COALESCE(sm.high_fit_database_accounts, 0)::bigint,
      COALESCE(sm.medium_fit_crm_accounts, 0)::bigint,
      COALESCE(sm.medium_fit_database_accounts, 0)::bigint,
      COALESCE(sm.low_fit_crm_accounts, 0)::bigint,
      COALESCE(sm.low_fit_database_accounts, 0)::bigint,
      COALESCE(lm.crm_leads, 0)::bigint,
      COALESCE(lm.database_leads, 0)::bigint,
      COALESCE(lm.high_fit_leads_total, 0)::bigint,
      COALESCE(lm.high_fit_crm_leads, 0)::bigint,
      COALESCE(lm.high_fit_database_leads, 0)::bigint,
      COALESCE(lm.medium_fit_crm_leads, 0)::bigint,
      COALESCE(lm.medium_fit_database_leads, 0)::bigint,
      COALESCE(lm.low_fit_crm_leads, 0)::bigint,
      COALESCE(lm.low_fit_database_leads, 0)::bigint,
      COALESCE(cm.campaign_ready_accounts, 0)::bigint,
      COALESCE(cm.campaign_ready_leads, 0)::bigint,
      COALESCE(qm.completeness, 0)::numeric,
      COALESCE(apm.apollo_accounts, 0)::bigint,
      COALESCE(apm.apollo_contacts, 0)::bigint,
      apm.apollo_provider
    FROM account_metrics am
    CROSS JOIN scored_metrics sm
    CROSS JOIN lead_metrics lm
    CROSS JOIN campaign_metrics cm
    CROSS JOIN quality_metrics qm
    LEFT JOIN apollo_metrics apm ON true
  $query$, source_condition, source_condition, source_condition, source_condition, source_condition)
  USING p_org_id;
END;
$$;