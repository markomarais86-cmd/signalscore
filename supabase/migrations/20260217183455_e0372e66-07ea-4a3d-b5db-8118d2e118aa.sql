
-- 1. Add company_keywords column to icp_profiles
ALTER TABLE public.icp_profiles ADD COLUMN IF NOT EXISTS company_keywords text[];

-- 2. Copy custom_attribute_definitions from Launchpulse to 91.Life
INSERT INTO public.custom_attribute_definitions (org_id, field_key, field_label, field_type, options, category, enrichment_prompt)
SELECT 
  'cd592f73-3e0e-478d-905b-47fe7c5fb634' AS org_id,
  field_key, field_label, field_type, options, category, enrichment_prompt
FROM public.custom_attribute_definitions
WHERE org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f'
ON CONFLICT DO NOTHING;

-- 3. Clean up ICP job titles: strip management-level prefixes, keep C-level intact
UPDATE public.icp_profiles
SET persona_job_titles = ARRAY[
  'Electrophysiology',
  'CIO',
  'CISO',
  'Chief AI & Data Officer',
  'Advanced Practice Nurse Practitioner',
  'Finance & Operations',
  'CFO',
  'Patient Experience',
  'Chief Patient Experience Officer',
  'CMO',
  'Chief Medical Officer',
  'Cardiology',
  'Enterprise Technology',
  'Clinical Operations',
  'CEO',
  'Medical Director',
  'Chief Nursing Officer',
  'Practice Manager',
  'IT Manager',
  'Revenue Cycle',
  'Founder',
  'Clinical Ops',
  'Financial Manager',
  'Revenue Manager',
  'EP Power User',
  'Clinical Lead',
  'Remote Monitoring',
  'Regulatory Affairs',
  'Compliance',
  'Clinical Educator',
  'Training',
  'digital health',
  'compliance',
  'supply chain',
  'training',
  'digital strategy',
  'clinical it',
  'strategic sourcing',
  'information technology'
]
WHERE id = 'f0d17a6b-6476-4e2d-a90f-9afc8d8e232b';

-- 4. Update scoring function to also match company_keywords
CREATE OR REPLACE FUNCTION public.calculate_account_score(
  p_account_external_id TEXT,
  p_icp_id UUID,
  p_org_id UUID
)
RETURNS jsonb
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
  v_intent_score INTEGER;
  v_reachability_score INTEGER;
  v_overall_score INTEGER;
  v_breakdown JSONB := '[]'::jsonb;
  v_icp_industry TEXT;
  v_keyword TEXT;
  v_min_size INTEGER;
  v_max_size INTEGER;
BEGIN
  SELECT * INTO account_rec 
  FROM public.accounts 
  WHERE external_id = p_account_external_id AND org_id = p_org_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Account not found');
  END IF;

  SELECT * INTO icp_rec
  FROM public.icp_profiles
  WHERE id = p_icp_id AND org_id = p_org_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'ICP profile not found');
  END IF;

  -- FUZZY INDUSTRY MATCHING (industries + company_keywords)
  IF account_rec.industry_norm IS NOT NULL OR account_rec.industry_raw IS NOT NULL OR account_rec.sub_industry IS NOT NULL THEN
    FOREACH v_icp_industry IN ARRAY COALESCE(icp_rec.industries, ARRAY[]::TEXT[])
    LOOP
      IF (account_rec.industry_norm ILIKE '%' || v_icp_industry || '%') OR
         (account_rec.industry_raw ILIKE '%' || v_icp_industry || '%') OR
         (account_rec.sub_industry ILIKE '%' || v_icp_industry || '%') OR
         (v_icp_industry = 'Technology' AND (account_rec.industry_norm ILIKE '%Software%' OR account_rec.industry_norm ILIKE '%IT%' OR account_rec.industry_norm ILIKE '%Computer%')) OR
         (v_icp_industry = 'Software' AND (account_rec.industry_norm ILIKE '%Software%' OR account_rec.industry_norm ILIKE '%Computer%')) OR
         (v_icp_industry = 'Healthcare' AND (account_rec.industry_norm ILIKE '%Health%' OR account_rec.industry_norm ILIKE '%Hospital%' OR account_rec.industry_norm ILIKE '%Medical%')) OR
         (v_icp_industry = 'Manufacturing' AND account_rec.industry_norm ILIKE '%Manufactur%') OR
         (v_icp_industry = 'Education' AND (account_rec.industry_norm ILIKE '%Education%' OR account_rec.industry_norm ILIKE '%University%' OR account_rec.industry_norm ILIKE '%College%')) OR
         (v_icp_industry = 'Financial Services' AND (account_rec.industry_norm ILIKE '%Financial%' OR account_rec.industry_norm ILIKE '%Banking%' OR account_rec.industry_norm ILIKE '%Insurance%')) OR
         (v_icp_industry = 'Energy & Utilities' AND (account_rec.industry_norm ILIKE '%Energy%' OR account_rec.industry_norm ILIKE '%Oil%' OR account_rec.industry_norm ILIKE '%Utilit%')) OR
         (v_icp_industry = 'Media & Entertainment' AND (account_rec.industry_norm ILIKE '%Media%' OR account_rec.industry_norm ILIKE '%Entertainment%' OR account_rec.industry_norm ILIKE '%Publishing%')) OR
         (v_icp_industry = 'Telecommunications' AND account_rec.industry_norm ILIKE '%Telecom%') OR
         (v_icp_industry = 'Professional Services' AND (account_rec.industry_norm ILIKE '%Professional%' OR account_rec.industry_norm ILIKE '%Consulting%' OR account_rec.industry_norm ILIKE '%Services%')) OR
         (v_icp_industry = 'IT Services' AND (account_rec.industry_norm ILIKE '%IT%' OR account_rec.industry_norm ILIKE '%Information Tech%')) OR
         (v_icp_industry = 'Consulting' AND account_rec.industry_norm ILIKE '%Consult%') OR
         (v_icp_industry = 'Business Services' AND (account_rec.industry_norm ILIKE '%Business%' OR account_rec.industry_norm ILIKE '%Services%')) OR
         (v_icp_industry = 'Retail' AND account_rec.industry_norm ILIKE '%Retail%')
      THEN
        v_industry_score := 100;
        EXIT;
      END IF;
    END LOOP;
    
    -- If no industry match, check company_keywords
    IF v_industry_score = 0 AND icp_rec.company_keywords IS NOT NULL AND array_length(icp_rec.company_keywords, 1) > 0 THEN
      FOREACH v_keyword IN ARRAY icp_rec.company_keywords
      LOOP
        IF (account_rec.industry_norm ILIKE '%' || v_keyword || '%') OR
           (account_rec.industry_raw ILIKE '%' || v_keyword || '%') OR
           (account_rec.sub_industry ILIKE '%' || v_keyword || '%') OR
           (account_rec.name ILIKE '%' || v_keyword || '%')
        THEN
          v_industry_score := 100;
          EXIT;
        END IF;
      END LOOP;
    END IF;
    
    v_breakdown := v_breakdown || jsonb_build_object(
      'factor', 'industry',
      'score', v_industry_score,
      'match', v_industry_score > 0,
      'value', COALESCE(account_rec.industry_norm, account_rec.industry_raw)
    );
  END IF;

  -- RANGE-BASED EMPLOYEE COUNT SCORING
  IF account_rec.employee_count IS NOT NULL AND icp_rec.company_sizes IS NOT NULL AND array_length(icp_rec.company_sizes, 1) > 0 THEN
    SELECT MIN(s), MAX(s) INTO v_min_size, v_max_size
    FROM unnest(icp_rec.company_sizes) AS s;
    
    IF account_rec.employee_count >= v_min_size AND account_rec.employee_count <= v_max_size THEN
      v_size_score := 100;
    ELSIF account_rec.employee_count >= (v_min_size * 0.5) AND account_rec.employee_count <= (v_max_size * 2) THEN
      v_size_score := 75;
    ELSIF account_rec.employee_count >= (v_min_size * 0.25) AND account_rec.employee_count <= (v_max_size * 4) THEN
      v_size_score := 50;
    ELSE
      v_size_score := 25;
    END IF;
    
    v_breakdown := v_breakdown || jsonb_build_object(
      'factor', 'size',
      'score', v_size_score,
      'match', v_size_score >= 75,
      'value', account_rec.employee_count,
      'icp_range', jsonb_build_object('min', v_min_size, 'max', v_max_size)
    );
  END IF;

  -- FUZZY REVENUE MATCHING
  IF account_rec.revenue_range IS NOT NULL AND icp_rec.revenue_ranges IS NOT NULL THEN
    IF account_rec.revenue_range = ANY(icp_rec.revenue_ranges) THEN
      v_revenue_score := 100;
    ELSE
      DECLARE
        v_rev_range TEXT;
      BEGIN
        FOREACH v_rev_range IN ARRAY icp_rec.revenue_ranges
        LOOP
          IF account_rec.revenue_range ILIKE '%' || SUBSTRING(v_rev_range FROM '\d+') || '%' THEN
            v_revenue_score := 75;
            EXIT;
          END IF;
        END LOOP;
      END;
    END IF;
    
    v_breakdown := v_breakdown || jsonb_build_object(
      'factor', 'revenue',
      'score', v_revenue_score,
      'match', v_revenue_score >= 75,
      'value', account_rec.revenue_range
    );
  END IF;

  -- GEOGRAPHY MATCHING
  IF account_rec.country IS NOT NULL AND icp_rec.geographies IS NOT NULL THEN
    IF account_rec.country = ANY(icp_rec.geographies) THEN
      v_geography_score := 100;
    ELSE
      DECLARE
        v_geo TEXT;
      BEGIN
        FOREACH v_geo IN ARRAY icp_rec.geographies
        LOOP
          IF account_rec.country ILIKE '%' || v_geo || '%' OR v_geo ILIKE '%' || account_rec.country || '%' THEN
            v_geography_score := 75;
            EXIT;
          END IF;
        END LOOP;
      END;
    END IF;
    
    v_breakdown := v_breakdown || jsonb_build_object(
      'factor', 'geography',
      'score', v_geography_score,
      'match', v_geography_score >= 75,
      'value', account_rec.country
    );
  END IF;

  v_total_score := v_industry_score + v_size_score + v_revenue_score + v_geography_score;
  v_fit_score := ROUND((v_total_score::NUMERIC / v_max_score) * 100)::INTEGER;

  v_intent_score := public.calculate_intent_score(p_account_external_id, p_org_id);
  v_reachability_score := public.calculate_reachability_score(p_account_external_id, p_org_id);

  v_overall_score := ROUND(
    (v_fit_score * 0.6) + 
    (v_intent_score * 0.2) + 
    (v_reachability_score * 0.2)
  )::INTEGER;

  INSERT INTO public.scores (
    org_id, account_external_id, overall, fit, intent, reachability, reasons, scoring_version, computed_at
  ) VALUES (
    p_org_id, p_account_external_id, v_overall_score, v_fit_score, v_intent_score, v_reachability_score, v_breakdown, 'fuzzy_v5.0_keywords', now()
  )
  ON CONFLICT (org_id, account_external_id) 
  DO UPDATE SET
    overall = EXCLUDED.overall, fit = EXCLUDED.fit, intent = EXCLUDED.intent,
    reachability = EXCLUDED.reachability, reasons = EXCLUDED.reasons,
    scoring_version = EXCLUDED.scoring_version, computed_at = EXCLUDED.computed_at;

  RETURN jsonb_build_object(
    'overall', v_overall_score, 'fit', v_fit_score, 'intent', v_intent_score,
    'reachability', v_reachability_score, 'breakdown', v_breakdown
  );
END;
$$;

-- 5. Update estimate_icp_matches to support company_keywords
CREATE OR REPLACE FUNCTION public.estimate_icp_matches(
  p_org_id uuid, 
  p_industries text[] DEFAULT NULL::text[], 
  p_sizes integer[] DEFAULT NULL::integer[], 
  p_revenues text[] DEFAULT NULL::text[], 
  p_countries text[] DEFAULT NULL::text[],
  p_company_keywords text[] DEFAULT NULL::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  match_count integer;
  total_count integer;
  percentage numeric;
  min_size integer;
BEGIN
  SELECT COUNT(*) INTO total_count FROM accounts WHERE org_id = p_org_id;
  
  IF p_sizes IS NOT NULL AND array_length(p_sizes, 1) > 0 THEN
    SELECT MIN(x) INTO min_size FROM unnest(p_sizes) AS x;
  ELSE
    min_size := NULL;
  END IF;
  
  SELECT COUNT(*) INTO match_count
  FROM accounts a
  WHERE a.org_id = p_org_id
    AND (
      p_industries IS NULL OR array_length(p_industries, 1) = 0 
      OR a.industry_norm = ANY(p_industries)
      OR EXISTS (SELECT 1 FROM unnest(p_industries) ind WHERE a.industry_norm ILIKE '%' || ind || '%' OR ind ILIKE '%' || a.industry_norm || '%')
    )
    AND (
      p_company_keywords IS NULL OR array_length(p_company_keywords, 1) = 0
      OR EXISTS (
        SELECT 1 FROM unnest(p_company_keywords) kw
        WHERE a.industry_norm ILIKE '%' || kw || '%'
        OR a.industry_raw ILIKE '%' || kw || '%'
        OR a.sub_industry ILIKE '%' || kw || '%'
        OR a.name ILIKE '%' || kw || '%'
      )
    )
    AND (min_size IS NULL OR a.employee_count >= min_size)
    AND (
      p_revenues IS NULL OR array_length(p_revenues, 1) = 0 
      OR a.revenue_range = ANY(p_revenues)
      OR EXISTS (
        SELECT 1 FROM unnest(p_revenues) rev
        WHERE a.revenue_range ILIKE rev || '%' OR rev ILIKE a.revenue_range || '%'
        OR (rev = '$1B+' AND (a.revenue_range ILIKE '$1B%' OR a.revenue_range ILIKE '$10B%'))
        OR (rev = '<$1M' AND a.revenue_range IN ('<$1M', '$0-$1M', 'Under $1M'))
        OR REPLACE(REPLACE(a.revenue_range, ' ', ''), '-', ' - ') = REPLACE(REPLACE(rev, ' ', ''), '-', ' - ')
      )
    )
    AND (p_countries IS NULL OR array_length(p_countries, 1) = 0 OR a.country = ANY(p_countries));
  
  percentage := CASE WHEN total_count > 0 THEN ROUND((match_count::numeric / total_count) * 100, 1) ELSE 0 END;
  
  RETURN jsonb_build_object('total', match_count, 'percentage', percentage, 'total_accounts', total_count, 'min_employee_threshold', min_size);
END;
$function$;
