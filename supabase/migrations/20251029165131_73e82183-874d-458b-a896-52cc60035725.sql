-- Phase 1: Backend Foundation for Multiple ICPs
-- Add ICP management fields to icp_profiles table

ALTER TABLE public.icp_profiles
  ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('segment', 'size', 'geography', 'use_case', 'custom')) DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS parent_icp_id UUID REFERENCES public.icp_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority INTEGER CHECK (priority BETWEEN 1 AND 5) DEFAULT 3,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT true;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_icp_parent ON public.icp_profiles(parent_icp_id) WHERE parent_icp_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_icp_primary ON public.icp_profiles(org_id, is_primary) WHERE is_primary = true;

-- Add documentation comments
COMMENT ON COLUMN public.icp_profiles.category IS 'ICP categorization: segment (industry-based), size (company size), geography (region), use_case (sales motion), custom';
COMMENT ON COLUMN public.icp_profiles.parent_icp_id IS 'For hierarchical ICPs - references parent ICP if this is a variant';
COMMENT ON COLUMN public.icp_profiles.priority IS 'Priority ranking 1-5 where 1=highest priority for sales focus';
COMMENT ON COLUMN public.icp_profiles.is_primary IS 'Marks the primary/default ICP for the organization';

-- Add ICP reference to scores table
ALTER TABLE public.scores
  ADD COLUMN IF NOT EXISTS icp_id UUID REFERENCES public.icp_profiles(id) ON DELETE SET NULL;

-- Add indexes for ICP-filtered queries
CREATE INDEX IF NOT EXISTS idx_scores_icp_fit ON public.scores(org_id, icp_id, fit) WHERE icp_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scores_icp_account ON public.scores(icp_id, account_external_id) WHERE icp_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scores_org_icp ON public.scores(org_id, icp_id);

COMMENT ON COLUMN public.scores.icp_id IS 'References the ICP profile used to calculate this score';

-- Update get_dashboard_metrics_fast to accept optional ICP filter
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_fast(
  p_org_id UUID,
  p_icp_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  mv_data RECORD;
  result JSONB;
BEGIN
  SELECT * INTO mv_data
  FROM public.mv_dashboard_metrics_by_org
  WHERE org_id = p_org_id;
  
  IF mv_data IS NOT NULL THEN
    IF p_icp_id IS NOT NULL THEN
      SELECT jsonb_build_object(
        'totalAccounts', COUNT(DISTINCT a.external_id),
        'scoredAccounts', COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN a.external_id END),
        'highFitAccounts', COUNT(DISTINCT CASE WHEN s.overall >= 70 THEN a.external_id END),
        'mediumFitAccounts', COUNT(DISTINCT CASE WHEN s.overall >= 40 AND s.overall < 70 THEN a.external_id END),
        'lowFitAccounts', COUNT(DISTINCT CASE WHEN s.overall < 40 THEN a.external_id END),
        'computed_from_cache', false,
        'filtered_by_icp', true,
        'icp_id', p_icp_id
      ) INTO result
      FROM public.accounts a
      LEFT JOIN public.scores s ON s.account_external_id = a.external_id 
        AND s.org_id = a.org_id 
        AND s.icp_id = p_icp_id
      WHERE a.org_id = p_org_id;
      
      RETURN result;
    END IF;
    
    SELECT jsonb_build_object(
      'totalAccounts', mv_data.total_accounts,
      'crmAccounts', mv_data.crm_accounts,
      'databaseAccounts', mv_data.database_accounts,
      'bothAccounts', mv_data.both_accounts,
      'scoredAccounts', mv_data.scored_accounts,
      'highFitAccounts', mv_data.high_fit_accounts,
      'mediumFitAccounts', mv_data.medium_fit_accounts,
      'lowFitAccounts', mv_data.low_fit_accounts,
      'highFitCrmAccounts', mv_data.high_fit_crm,
      'highFitDatabaseAccounts', mv_data.high_fit_database,
      'campaignReadyAccounts', mv_data.campaign_ready_accounts,
      'campaignReadyLeads', mv_data.campaign_ready_leads,
      'totalLeads', (SELECT COUNT(*) FROM "Leads" WHERE org_id = p_org_id),
      'linkedLeads', (SELECT COUNT(*) FROM "Leads" WHERE org_id = p_org_id AND account_external_id IS NOT NULL),
      'crmLeads', mv_data.crm_leads,
      'databaseLeads', mv_data.database_leads,
      'highFitLeadsTotal', mv_data.high_fit_leads_total,
      'highFitCrmLeads', mv_data.high_fit_crm_leads,
      'highFitDatabaseLeads', mv_data.high_fit_database_leads,
      'dataCompleteness', CASE 
        WHEN mv_data.total_accounts > 0 THEN
          ROUND((
            mv_data.with_industry::numeric / mv_data.total_accounts * 25 +
            mv_data.with_size::numeric / mv_data.total_accounts * 25 +
            mv_data.with_revenue::numeric / mv_data.total_accounts * 25 +
            mv_data.with_geo::numeric / mv_data.total_accounts * 25
          ))::integer
        ELSE 0
      END,
      'computed_from_cache', true,
      'filtered_by_icp', false,
      'cache_age_minutes', EXTRACT(EPOCH FROM (now() - mv_data.computed_at)) / 60
    ) INTO result;
    
    RETURN result;
  END IF;
  
  RETURN jsonb_build_object(
    'totalAccounts', 0,
    'computed_from_cache', false,
    'error', 'Materialized view not populated'
  );
END;
$function$;

-- Update calculate_account_score to store icp_id
CREATE OR REPLACE FUNCTION public.calculate_account_score(
  account_external_id TEXT,
  icp_id UUID,
  org_id_param UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  account_rec RECORD;
  icp_rec RECORD;
  industry_score INTEGER := 0;
  size_score INTEGER := 0;
  geo_score INTEGER := 0;
  revenue_score INTEGER := 0;
  total_score INTEGER := 0;
  fit_score INTEGER := 0;
  matches INTEGER := 0;
  data_fields INTEGER := 0;
  bonus_multiplier NUMERIC := 1.0;
  result_scores JSONB;
BEGIN
  IF org_id_param != get_current_user_org_id() THEN
    RAISE EXCEPTION 'Access denied: Invalid organization';
  END IF;

  SELECT * INTO account_rec 
  FROM public.accounts 
  WHERE external_id = account_external_id AND org_id = org_id_param;
  
  SELECT * INTO icp_rec 
  FROM public.icp_profiles 
  WHERE id = icp_id AND org_id = org_id_param;
  
  IF account_rec IS NULL OR icp_rec IS NULL THEN
    RETURN jsonb_build_object(
      'overall', 0,
      'fit', 0,
      'intent', 0,
      'reachability', 0,
      'breakdown', jsonb_build_object(
        'industry_score', 0,
        'size_score', 0,
        'geo_score', 0,
        'revenue_score', 0
      )
    );
  END IF;
  
  IF account_rec.industry_norm IS NOT NULL THEN data_fields := data_fields + 1; END IF;
  IF account_rec.employee_count IS NOT NULL THEN data_fields := data_fields + 1; END IF;
  IF account_rec.country IS NOT NULL THEN data_fields := data_fields + 1; END IF;
  IF account_rec.revenue_range IS NOT NULL THEN data_fields := data_fields + 1; END IF;
  
  IF account_rec.industry_norm IS NOT NULL AND icp_rec.industries IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM unnest(icp_rec.industries) AS icp_industry
      WHERE LOWER(account_rec.industry_norm) LIKE '%' || LOWER(icp_industry) || '%'
         OR LOWER(icp_industry) LIKE '%' || LOWER(account_rec.industry_norm) || '%'
    ) THEN
      industry_score := 40;
      matches := matches + 1;
    END IF;
  END IF;
  
  IF account_rec.country IS NOT NULL AND icp_rec.geographies IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM unnest(icp_rec.geographies) AS icp_geo
      WHERE LOWER(account_rec.country) = LOWER(icp_geo)
    ) THEN
      geo_score := 35;
      matches := matches + 1;
    END IF;
  END IF;
  
  IF account_rec.employee_count IS NOT NULL AND icp_rec.company_sizes IS NOT NULL THEN
    IF account_rec.employee_count = ANY(icp_rec.company_sizes) 
       OR (account_rec.employee_count >= 100 AND account_rec.employee_count < 300 AND 200 = ANY(icp_rec.company_sizes))
       OR (account_rec.employee_count >= 300 AND account_rec.employee_count < 700 AND 500 = ANY(icp_rec.company_sizes))
       OR (account_rec.employee_count >= 700 AND 1000 = ANY(icp_rec.company_sizes)) THEN
      size_score := 15;
      matches := matches + 1;
    END IF;
  ELSIF account_rec.employee_count IS NULL AND industry_score > 0 AND geo_score > 0 THEN
    size_score := 8;
  END IF;
  
  IF account_rec.revenue_range IS NOT NULL AND icp_rec.revenue_ranges IS NOT NULL THEN
    IF account_rec.revenue_range = ANY(icp_rec.revenue_ranges) THEN
      revenue_score := 10;
      matches := matches + 1;
    END IF;
  ELSIF account_rec.revenue_range IS NULL AND industry_score > 0 AND geo_score > 0 THEN
    revenue_score := 5;
  END IF;
  
  total_score := industry_score + size_score + geo_score + revenue_score;
  
  IF data_fields >= 3 THEN
    bonus_multiplier := 1.1;
  END IF;
  
  IF matches >= 2 THEN
    total_score := LEAST(100, FLOOR(total_score * bonus_multiplier) + 5);
  ELSIF matches >= 3 THEN
    total_score := LEAST(100, FLOOR(total_score * bonus_multiplier) + 10);
  ELSE
    total_score := FLOOR(total_score * bonus_multiplier);
  END IF;
  
  fit_score := total_score;
  
  result_scores := jsonb_build_object(
    'overall', total_score,
    'fit', fit_score,
    'intent', 50,
    'reachability', 70,
    'breakdown', jsonb_build_object(
      'industry_score', industry_score,
      'size_score', size_score,
      'geo_score', geo_score,
      'revenue_score', revenue_score,
      'matches', matches,
      'data_fields', data_fields
    )
  );
  
  INSERT INTO public.scores (
    org_id,
    account_external_id,
    icp_id,
    overall,
    fit,
    intent,
    reachability,
    reasons,
    scoring_version,
    computed_at
  ) VALUES (
    org_id_param,
    account_external_id,
    icp_id,
    total_score,
    fit_score,
    50,
    70,
    result_scores->'breakdown',
    'icp_v2.1',
    now()
  )
  ON CONFLICT (org_id, account_external_id) 
  DO UPDATE SET
    icp_id = EXCLUDED.icp_id,
    overall = EXCLUDED.overall,
    fit = EXCLUDED.fit,
    intent = EXCLUDED.intent,
    reachability = EXCLUDED.reachability,
    reasons = EXCLUDED.reasons,
    scoring_version = EXCLUDED.scoring_version,
    computed_at = EXCLUDED.computed_at;
  
  RETURN result_scores;
END;
$function$;