
-- Fix calculate_account_score UUID overload: add segments-based vertical scoring
CREATE OR REPLACE FUNCTION public.calculate_account_score(p_account_external_id text, p_icp_id uuid, p_org_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_data_org_id uuid;
  account_rec RECORD;
  icp_rec RECORD;
  v_industry_score INTEGER := 0;
  v_size_score INTEGER := 0;
  v_revenue_score INTEGER := 0;
  v_geography_score INTEGER := 0;
  v_vertical_score INTEGER := 0;
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
  v_data_org_id := public.get_data_org_id(p_org_id);

  SELECT * INTO account_rec 
  FROM public.accounts 
  WHERE external_id = p_account_external_id AND org_id = v_data_org_id;

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

  -- VERTICAL / CUSTOM ATTRIBUTE SCORING (up to 15 bonus points)
  -- Now handles BOTH segments-based and flat key-value vertical_filters
  IF icp_rec.vertical_filters IS NOT NULL AND icp_rec.vertical_filters != '{}'::jsonb THEN
    -- Check for segments-based vertical_filters
    IF icp_rec.vertical_filters ? 'segments' AND jsonb_typeof(icp_rec.vertical_filters -> 'segments') = 'array' THEN
      DECLARE
        v_seg jsonb;
        v_seg_score integer := 0;
        v_best_score integer := 0;
        v_seg_size text;
        v_bed_range text;
        v_bed_count numeric;
        v_crit_total integer;
        v_crit_matched integer;
        v_min_beds integer;
        v_max_beds integer;
        v_range_parts text[];
      BEGIN
        FOR v_seg IN SELECT * FROM jsonb_array_elements(icp_rec.vertical_filters -> 'segments')
        LOOP
          v_crit_total := 0;
          v_crit_matched := 0;

          -- Match segment size against employee_count
          v_seg_size := LOWER(COALESCE(v_seg ->> 'size', ''));
          IF v_seg_size != '' AND account_rec.employee_count IS NOT NULL THEN
            v_crit_total := v_crit_total + 1;
            IF (v_seg_size IN ('small') AND account_rec.employee_count BETWEEN 1 AND 100)
               OR (v_seg_size IN ('small-mid') AND account_rec.employee_count BETWEEN 30 AND 300)
               OR (v_seg_size IN ('mid-large') AND account_rec.employee_count BETWEEN 200 AND 5000)
               OR (v_seg_size IN ('large') AND account_rec.employee_count >= 500) THEN
              v_crit_matched := v_crit_matched + 1;
            END IF;
          END IF;

          -- Match bed_range against custom_attributes.bed_count
          v_bed_range := v_seg ->> 'bed_range';
          IF v_bed_range IS NOT NULL AND account_rec.custom_attributes IS NOT NULL 
             AND (account_rec.custom_attributes ->> 'bed_count') IS NOT NULL THEN
            v_crit_total := v_crit_total + 1;
            BEGIN
              v_bed_count := (account_rec.custom_attributes ->> 'bed_count')::numeric;
              v_range_parts := string_to_array(REPLACE(v_bed_range, '+', ''), '-');
              v_min_beds := COALESCE(v_range_parts[1]::integer, 0);
              v_max_beds := CASE WHEN v_bed_range LIKE '%+' THEN 999999
                                 ELSE COALESCE(v_range_parts[2]::integer, 999999) END;
              IF v_bed_count >= v_min_beds AND v_bed_count <= v_max_beds THEN
                v_crit_matched := v_crit_matched + 1;
              END IF;
            EXCEPTION WHEN OTHERS THEN
              NULL; -- skip bad data
            END;
          END IF;

          IF v_crit_total > 0 THEN
            v_seg_score := ROUND(15.0 * v_crit_matched / v_crit_total)::integer;
            v_best_score := GREATEST(v_best_score, v_seg_score);
          END IF;
        END LOOP;

        v_vertical_score := v_best_score;
      END;
    -- Handle flat key-value vertical_filters (legacy)
    ELSIF account_rec.custom_attributes IS NOT NULL THEN
      DECLARE
        v_tc integer := 0;
        v_mc integer := 0;
        v_key text;
        v_val jsonb;
      BEGIN
        FOR v_key, v_val IN SELECT * FROM jsonb_each(icp_rec.vertical_filters)
        LOOP
          IF v_val IS NULL OR v_val = 'null'::jsonb THEN CONTINUE; END IF;
          v_tc := v_tc + 1;
          IF v_key LIKE '%\_min' THEN
            IF (account_rec.custom_attributes ->> REPLACE(v_key, '_min', '')) IS NOT NULL
               AND (account_rec.custom_attributes ->> REPLACE(v_key, '_min', ''))::numeric >= v_val::text::numeric THEN
              v_mc := v_mc + 1;
            END IF;
          ELSIF v_key LIKE '%\_max' THEN
            IF (account_rec.custom_attributes ->> REPLACE(v_key, '_max', '')) IS NOT NULL
               AND (account_rec.custom_attributes ->> REPLACE(v_key, '_max', ''))::numeric <= v_val::text::numeric THEN
              v_mc := v_mc + 1;
            END IF;
          ELSIF jsonb_typeof(v_val) = 'array' THEN
            IF account_rec.custom_attributes ? v_key
               AND v_val @> to_jsonb(account_rec.custom_attributes ->> v_key) THEN
              v_mc := v_mc + 1;
            END IF;
          ELSE
            IF LOWER(COALESCE(account_rec.custom_attributes ->> v_key, '')) = LOWER(v_val #>> '{}') THEN
              v_mc := v_mc + 1;
            END IF;
          END IF;
        END LOOP;
        IF v_tc > 0 THEN
          v_vertical_score := ROUND(15.0 * v_mc / v_tc)::integer;
        END IF;
      END;
    END IF;

    v_breakdown := v_breakdown || jsonb_build_object(
      'factor', 'vertical',
      'score', v_vertical_score,
      'match', v_vertical_score > 0,
      'value', 'custom_attributes'
    );
  END IF;

  v_total_score := v_industry_score + v_size_score + v_revenue_score + v_geography_score;
  v_fit_score := ROUND((v_total_score::NUMERIC / v_max_score) * 100)::INTEGER;
  v_fit_score := LEAST(100, v_fit_score + v_vertical_score);

  v_intent_score := public.calculate_intent_score(p_account_external_id, v_data_org_id);
  v_reachability_score := public.calculate_reachability_score(p_account_external_id, v_data_org_id);

  v_overall_score := ROUND(
    (v_fit_score * 0.6) + 
    (v_intent_score * 0.2) + 
    (v_reachability_score * 0.2)
  )::INTEGER;

  INSERT INTO public.scores (
    org_id, account_external_id, overall, fit, intent, reachability,
    reasons, scoring_version, computed_at
  ) VALUES (
    p_org_id, p_account_external_id, v_overall_score, v_fit_score,
    v_intent_score, v_reachability_score, v_breakdown,
    'fuzzy_v5.2_vertical_segments', now()
  )
  ON CONFLICT (org_id, account_external_id) 
  DO UPDATE SET
    overall = EXCLUDED.overall, fit = EXCLUDED.fit,
    intent = EXCLUDED.intent, reachability = EXCLUDED.reachability,
    reasons = EXCLUDED.reasons, scoring_version = EXCLUDED.scoring_version,
    computed_at = EXCLUDED.computed_at;

  RETURN jsonb_build_object(
    'overall', v_overall_score,
    'fit', v_fit_score,
    'intent', v_intent_score,
    'reachability', v_reachability_score,
    'breakdown', v_breakdown
  );
END;
$function$;

-- Fix calculate_account_score_readonly UUID overload: add segments-based vertical scoring
CREATE OR REPLACE FUNCTION public.calculate_account_score_readonly(account_external_id text, icp_id uuid, org_id_param uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_data_org_id uuid;
  account_rec RECORD;
  icp_rec RECORD;
  industry_score integer := 0;
  size_score integer := 0;
  geo_score integer := 0;
  revenue_score integer := 0;
  vertical_score integer := 0;
  total_score integer := 0;
  fit_score integer := 0;
  matches integer := 0;
BEGIN
  v_data_org_id := public.get_data_org_id(org_id_param);

  SELECT * INTO account_rec 
  FROM public.accounts 
  WHERE external_id = calculate_account_score_readonly.account_external_id AND org_id = v_data_org_id;
  
  SELECT * INTO icp_rec 
  FROM public.icp_profiles 
  WHERE id = calculate_account_score_readonly.icp_id AND org_id = org_id_param;
  
  IF account_rec IS NULL OR icp_rec IS NULL THEN
    RETURN jsonb_build_object(
      'overall', 0, 'fit', 0, 'intent', 0, 'reachability', 0,
      'breakdown', jsonb_build_object(
        'industry_score', 0, 'size_score', 0, 'geo_score', 0,
        'revenue_score', 0, 'vertical_score', 0
      )
    );
  END IF;
  
  -- Industry scoring (30 points)
  IF account_rec.industry_norm IS NOT NULL AND icp_rec.industries IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM unnest(icp_rec.industries) AS icp_industry
      WHERE LOWER(account_rec.industry_norm) LIKE '%' || LOWER(icp_industry) || '%'
         OR LOWER(icp_industry) LIKE '%' || LOWER(account_rec.industry_norm) || '%'
    ) THEN
      industry_score := 30;
      matches := matches + 1;
    END IF;
  END IF;
  
  -- Size scoring (25 points)
  IF account_rec.employee_count IS NOT NULL AND icp_rec.company_sizes IS NOT NULL THEN
    IF account_rec.employee_count = ANY(icp_rec.company_sizes) 
       OR (account_rec.employee_count >= 100 AND 200 = ANY(icp_rec.company_sizes))
       OR (account_rec.employee_count >= 400 AND 500 = ANY(icp_rec.company_sizes))
       OR (account_rec.employee_count >= 800 AND 1000 = ANY(icp_rec.company_sizes)) THEN
      size_score := 25;
      matches := matches + 1;
    END IF;
  END IF;
  
  -- Geography scoring (25 points)
  IF account_rec.country IS NOT NULL AND icp_rec.geographies IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM unnest(icp_rec.geographies) AS icp_geo
      WHERE LOWER(account_rec.country) = LOWER(icp_geo)
    ) THEN
      geo_score := 25;
      matches := matches + 1;
    END IF;
  END IF;
  
  -- Revenue scoring (20 points)
  IF account_rec.revenue_range IS NOT NULL AND icp_rec.revenue_ranges IS NOT NULL THEN
    IF account_rec.revenue_range = ANY(icp_rec.revenue_ranges) THEN
      revenue_score := 20;
      matches := matches + 1;
    END IF;
  END IF;

  -- VERTICAL SCORING (up to 15 bonus points) - handles segments-based and flat filters
  IF icp_rec.vertical_filters IS NOT NULL AND icp_rec.vertical_filters != '{}'::jsonb THEN
    IF icp_rec.vertical_filters ? 'segments' AND jsonb_typeof(icp_rec.vertical_filters -> 'segments') = 'array' THEN
      DECLARE
        v_seg jsonb;
        v_seg_score integer := 0;
        v_best_score integer := 0;
        v_seg_size text;
        v_bed_range text;
        v_bed_count numeric;
        v_crit_total integer;
        v_crit_matched integer;
        v_min_beds integer;
        v_max_beds integer;
        v_range_parts text[];
      BEGIN
        FOR v_seg IN SELECT * FROM jsonb_array_elements(icp_rec.vertical_filters -> 'segments')
        LOOP
          v_crit_total := 0;
          v_crit_matched := 0;

          v_seg_size := LOWER(COALESCE(v_seg ->> 'size', ''));
          IF v_seg_size != '' AND account_rec.employee_count IS NOT NULL THEN
            v_crit_total := v_crit_total + 1;
            IF (v_seg_size IN ('small') AND account_rec.employee_count BETWEEN 1 AND 100)
               OR (v_seg_size IN ('small-mid') AND account_rec.employee_count BETWEEN 30 AND 300)
               OR (v_seg_size IN ('mid-large') AND account_rec.employee_count BETWEEN 200 AND 5000)
               OR (v_seg_size IN ('large') AND account_rec.employee_count >= 500) THEN
              v_crit_matched := v_crit_matched + 1;
            END IF;
          END IF;

          v_bed_range := v_seg ->> 'bed_range';
          IF v_bed_range IS NOT NULL AND account_rec.custom_attributes IS NOT NULL 
             AND (account_rec.custom_attributes ->> 'bed_count') IS NOT NULL THEN
            v_crit_total := v_crit_total + 1;
            BEGIN
              v_bed_count := (account_rec.custom_attributes ->> 'bed_count')::numeric;
              v_range_parts := string_to_array(REPLACE(v_bed_range, '+', ''), '-');
              v_min_beds := COALESCE(v_range_parts[1]::integer, 0);
              v_max_beds := CASE WHEN v_bed_range LIKE '%+' THEN 999999
                                 ELSE COALESCE(v_range_parts[2]::integer, 999999) END;
              IF v_bed_count >= v_min_beds AND v_bed_count <= v_max_beds THEN
                v_crit_matched := v_crit_matched + 1;
              END IF;
            EXCEPTION WHEN OTHERS THEN
              NULL;
            END;
          END IF;

          IF v_crit_total > 0 THEN
            v_seg_score := ROUND(15.0 * v_crit_matched / v_crit_total)::integer;
            v_best_score := GREATEST(v_best_score, v_seg_score);
          END IF;
        END LOOP;

        vertical_score := v_best_score;
        IF vertical_score > 0 THEN matches := matches + 1; END IF;
      END;
    ELSIF account_rec.custom_attributes IS NOT NULL THEN
      DECLARE
        v_tc integer := 0;
        v_mc integer := 0;
        v_key text;
        v_val jsonb;
      BEGIN
        FOR v_key, v_val IN SELECT * FROM jsonb_each(icp_rec.vertical_filters)
        LOOP
          IF v_val IS NULL OR v_val = 'null'::jsonb THEN CONTINUE; END IF;
          v_tc := v_tc + 1;
          IF v_key LIKE '%\_min' THEN
            IF (account_rec.custom_attributes ->> REPLACE(v_key, '_min', '')) IS NOT NULL
               AND (account_rec.custom_attributes ->> REPLACE(v_key, '_min', ''))::numeric >= v_val::text::numeric THEN
              v_mc := v_mc + 1;
            END IF;
          ELSIF v_key LIKE '%\_max' THEN
            IF (account_rec.custom_attributes ->> REPLACE(v_key, '_max', '')) IS NOT NULL
               AND (account_rec.custom_attributes ->> REPLACE(v_key, '_max', ''))::numeric <= v_val::text::numeric THEN
              v_mc := v_mc + 1;
            END IF;
          ELSIF jsonb_typeof(v_val) = 'array' THEN
            IF account_rec.custom_attributes ? v_key
               AND v_val @> to_jsonb(account_rec.custom_attributes ->> v_key) THEN
              v_mc := v_mc + 1;
            END IF;
          ELSE
            IF LOWER(COALESCE(account_rec.custom_attributes ->> v_key, '')) = LOWER(v_val #>> '{}') THEN
              v_mc := v_mc + 1;
            END IF;
          END IF;
        END LOOP;
        IF v_tc > 0 THEN
          vertical_score := ROUND(15.0 * v_mc / v_tc)::integer;
          IF v_mc > 0 THEN matches := matches + 1; END IF;
        END IF;
      END;
    END IF;
  END IF;

  total_score := industry_score + size_score + geo_score + revenue_score;
  fit_score := total_score + vertical_score;
  
  RETURN jsonb_build_object(
    'overall', fit_score, 'fit', fit_score, 'intent', 0, 'reachability', 0,
    'breakdown', jsonb_build_object(
      'industry_score', industry_score, 'size_score', size_score, 'geo_score', geo_score,
      'revenue_score', revenue_score, 'vertical_score', vertical_score
    )
  );
END;
$function$;
