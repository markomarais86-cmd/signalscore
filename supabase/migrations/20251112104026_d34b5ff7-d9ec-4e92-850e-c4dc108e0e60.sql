-- Drop and recreate calculate_account_score with fixed parameter names
-- This fixes the "column reference is ambiguous" bug

DROP FUNCTION IF EXISTS public.calculate_account_score(text, uuid, uuid);

CREATE FUNCTION public.calculate_account_score(
  p_account_external_id text,
  p_icp_id uuid,
  p_org_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  account_rec RECORD;
  icp_rec RECORD;
  v_industry_score INTEGER := 0;
  v_size_score INTEGER := 0;
  v_revenue_score INTEGER := 0;
  v_geography_score INTEGER := 0;
  v_total_score INTEGER := 0;
  v_max_score INTEGER := 400;
  v_fit_score INTEGER;
  v_overall_score INTEGER;
  v_breakdown JSONB := '[]'::jsonb;
BEGIN
  -- Get account data using explicit parameter name
  SELECT * INTO account_rec 
  FROM public.accounts 
  WHERE external_id = p_account_external_id AND org_id = p_org_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Account not found');
  END IF;

  -- Get ICP profile
  SELECT * INTO icp_rec
  FROM public.icp_profiles
  WHERE id = p_icp_id AND org_id = p_org_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'ICP profile not found');
  END IF;

  -- Industry match (100 points)
  IF account_rec.industry_norm = ANY(icp_rec.industries) THEN
    v_industry_score := 100;
    v_breakdown := v_breakdown || jsonb_build_object(
      'factor', 'industry',
      'score', 100,
      'match', true,
      'value', account_rec.industry_norm
    );
  END IF;

  -- Size match (100 points)
  IF account_rec.employee_count = ANY(icp_rec.company_sizes) THEN
    v_size_score := 100;
    v_breakdown := v_breakdown || jsonb_build_object(
      'factor', 'size',
      'score', 100,
      'match', true,
      'value', account_rec.employee_count
    );
  END IF;

  -- Revenue match (100 points)
  IF account_rec.revenue_range = ANY(icp_rec.revenue_ranges) THEN
    v_revenue_score := 100;
    v_breakdown := v_breakdown || jsonb_build_object(
      'factor', 'revenue',
      'score', 100,
      'match', true,
      'value', account_rec.revenue_range
    );
  END IF;

  -- Geography match (100 points)
  IF account_rec.country = ANY(icp_rec.geographies) THEN
    v_geography_score := 100;
    v_breakdown := v_breakdown || jsonb_build_object(
      'factor', 'geography',
      'score', 100,
      'match', true,
      'value', account_rec.country
    );
  END IF;

  -- Calculate total and normalize to 0-100
  v_total_score := v_industry_score + v_size_score + v_revenue_score + v_geography_score;
  v_fit_score := ROUND((v_total_score::NUMERIC / v_max_score) * 100)::INTEGER;
  v_overall_score := v_fit_score;

  -- Insert/update score using explicit parameter name (no ambiguity)
  INSERT INTO public.scores (
    org_id,
    account_external_id,
    overall,
    fit,
    intent,
    reachability,
    reasons,
    scoring_version,
    computed_at
  ) VALUES (
    p_org_id,
    p_account_external_id,
    v_overall_score,
    v_fit_score,
    50,
    70,
    v_breakdown,
    'icp_v2.0',
    now()
  )
  ON CONFLICT (org_id, account_external_id) 
  DO UPDATE SET
    overall = EXCLUDED.overall,
    fit = EXCLUDED.fit,
    intent = EXCLUDED.intent,
    reachability = EXCLUDED.reachability,
    reasons = EXCLUDED.reasons,
    scoring_version = EXCLUDED.scoring_version,
    computed_at = EXCLUDED.computed_at;

  RETURN jsonb_build_object(
    'overall', v_overall_score,
    'fit', v_fit_score,
    'intent', 50,
    'reachability', 70,
    'breakdown', v_breakdown
  );
END;
$$;