-- Update both SQL scoring functions to match new segment-weighted model
-- New weights: Industry=20, Size=15, Geo=10, Revenue=20(tiered), Segment=30, Boost=5

-- 1. calculate_account_score (writable version)
CREATE OR REPLACE FUNCTION public.calculate_account_score(p_account_external_id text, p_icp_id uuid, p_org_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
DECLARE
  account_rec RECORD;
  icp_rec RECORD;
  v_industry_score integer := 0;
  v_size_score integer := 0;
  v_geo_score integer := 0;
  v_revenue_score integer := 0;
  v_segment_score integer := 0;
  v_total_score integer := 0;
  v_fit_score integer := 0;
  v_intent_score integer := 50;
  v_matches integer := 0;
  v_industry text;
  v_keyword text;
  v_geo text;
  v_rev text;
  v_seg jsonb;
  v_segments jsonb;
  v_bed_count numeric;
  v_ec numeric;
  v_crit_total integer;
  v_crit_matched integer;
  v_best_seg_score integer := 0;
  v_any_seg_has_beds boolean := false;
  v_missing_vertical boolean := false;
  v_min_beds integer;
  v_max_beds integer;
  v_bed_range text;
  v_size_label text;
  v_size_min integer;
  v_size_max integer;
  v_matched_segment text := null;
  v_excluded boolean := false;
  v_ex_ind text;
BEGIN
  SELECT * INTO account_rec FROM public.accounts 
  WHERE external_id = p_account_external_id AND org_id = p_org_id;
  
  SELECT * INTO icp_rec FROM public.icp_profiles 
  WHERE id = p_icp_id AND org_id = p_org_id;
  
  IF account_rec IS NULL OR icp_rec IS NULL THEN
    RETURN jsonb_build_object('overall', 0, 'fit', 0, 'intent', v_intent_score, 'reachability', 0);
  END IF;

  -- Excluded industries check
  IF account_rec.industry_norm IS NOT NULL AND icp_rec.excluded_industries IS NOT NULL THEN
    FOREACH v_ex_ind IN ARRAY icp_rec.excluded_industries
    LOOP
      IF lower(account_rec.industry_norm) LIKE '%' || lower(v_ex_ind) || '%' THEN
        v_excluded := true;
        EXIT;
      END IF;
    END LOOP;
    IF v_excluded THEN
      RETURN jsonb_build_object('overall', 0, 'fit', 0, 'intent', v_intent_score, 'reachability', 0);
    END IF;
  END IF;

  -- Industry scoring (20 points)
  IF account_rec.industry_norm IS NOT NULL AND icp_rec.industries IS NOT NULL THEN
    FOREACH v_industry IN ARRAY icp_rec.industries
    LOOP
      IF lower(account_rec.industry_norm) LIKE '%' || lower(v_industry) || '%' 
         OR lower(v_industry) LIKE '%' || lower(account_rec.industry_norm) || '%' THEN
        v_industry_score := 20;
        v_matches := v_matches + 1;
        EXIT;
      END IF;
    END LOOP;
    
    IF v_industry_score = 0 AND icp_rec.company_keywords IS NOT NULL AND array_length(icp_rec.company_keywords, 1) > 0 THEN
      FOREACH v_keyword IN ARRAY icp_rec.company_keywords
      LOOP
        IF lower(account_rec.industry_norm) LIKE '%' || lower(v_keyword) || '%' THEN
          v_industry_score := 20;
          v_matches := v_matches + 1;
          EXIT;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Size scoring (15 points)
  IF account_rec.employee_count IS NOT NULL AND icp_rec.company_sizes IS NOT NULL AND array_length(icp_rec.company_sizes, 1) > 0 THEN
    DECLARE
      v_min_size integer;
      v_max_size integer;
      v_sizes integer[];
    BEGIN
      v_sizes := icp_rec.company_sizes;
      SELECT min(s), max(s) INTO v_min_size, v_max_size FROM unnest(v_sizes) s;
      IF account_rec.employee_count >= v_min_size AND account_rec.employee_count <= v_max_size THEN
        v_size_score := 15;
        v_matches := v_matches + 1;
      ELSIF account_rec.employee_count >= v_min_size * 0.5 AND account_rec.employee_count <= v_max_size * 2 THEN
        v_size_score := 8;
        v_matches := v_matches + 1;
      END IF;
    END;
  END IF;

  -- Geography scoring (10 points)
  IF account_rec.country IS NOT NULL AND icp_rec.geographies IS NOT NULL THEN
    FOREACH v_geo IN ARRAY icp_rec.geographies
    LOOP
      IF lower(account_rec.country) = lower(v_geo) THEN
        v_geo_score := 10;
        v_matches := v_matches + 1;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Revenue scoring (20 points, tiered)
  IF account_rec.revenue_range IS NOT NULL AND icp_rec.revenue_ranges IS NOT NULL THEN
    FOREACH v_rev IN ARRAY icp_rec.revenue_ranges
    LOOP
      IF account_rec.revenue_range = v_rev THEN
        IF v_rev IN ('$250M-$500M', '$500M-$1B', '$1B-$5B', '$5B+') THEN
          v_revenue_score := 20;
        ELSE
          v_revenue_score := 12;
        END IF;
        v_matches := v_matches + 1;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Segment scoring (30 points)
  v_ec := account_rec.employee_count;
  v_bed_count := CASE WHEN account_rec.custom_attributes IS NOT NULL 
    AND (account_rec.custom_attributes->>'bed_count') IS NOT NULL 
    THEN (account_rec.custom_attributes->>'bed_count')::numeric ELSE NULL END;

  IF icp_rec.vertical_filters IS NOT NULL AND icp_rec.vertical_filters ? 'segments' THEN
    v_segments := icp_rec.vertical_filters->'segments';
    IF jsonb_array_length(v_segments) > 0 THEN
      -- Check if any segment defines bed_range
      FOR v_seg IN SELECT * FROM jsonb_array_elements(v_segments)
      LOOP
        IF v_seg->>'bed_range' IS NOT NULL THEN
          v_any_seg_has_beds := true;
          EXIT;
        END IF;
      END LOOP;

      IF v_any_seg_has_beds AND v_bed_count IS NULL THEN
        v_missing_vertical := true;
      END IF;

      FOR v_seg IN SELECT * FROM jsonb_array_elements(v_segments)
      LOOP
        v_crit_total := 0;
        v_crit_matched := 0;

        -- Bed range (double weighted)
        v_bed_range := v_seg->>'bed_range';
        IF v_bed_range IS NOT NULL THEN
          v_crit_total := v_crit_total + 2;
          IF v_bed_count IS NOT NULL THEN
            v_min_beds := split_part(replace(v_bed_range, '+', ''), '-', 1)::integer;
            v_max_beds := CASE WHEN v_bed_range LIKE '%+' THEN 999999 
              ELSE COALESCE(NULLIF(split_part(replace(v_bed_range, '+', ''), '-', 2), '')::integer, 999999) END;
            IF v_bed_count >= v_min_beds AND v_bed_count <= v_max_beds THEN
              v_crit_matched := v_crit_matched + 2;
            END IF;
          END IF;
        END IF;

        -- Size tier matching
        v_size_label := lower(COALESCE(v_seg->>'size', ''));
        IF v_size_label != '' AND v_ec IS NOT NULL THEN
          v_crit_total := v_crit_total + 1;
          v_size_min := CASE v_size_label WHEN 'small' THEN 1 WHEN 'small-mid' THEN 30 WHEN 'mid-large' THEN 200 WHEN 'large' THEN 500 ELSE 0 END;
          v_size_max := CASE v_size_label WHEN 'small' THEN 100 WHEN 'small-mid' THEN 300 WHEN 'mid-large' THEN 5000 WHEN 'large' THEN 999999 ELSE 0 END;
          IF v_ec >= v_size_min AND v_ec <= v_size_max THEN
            v_crit_matched := v_crit_matched + 1;
          END IF;
        END IF;

        IF v_crit_total > 0 THEN
          DECLARE v_score integer;
          BEGIN
            v_score := round(30.0 * v_crit_matched / v_crit_total);
            IF v_score > v_best_seg_score THEN
              v_best_seg_score := v_score;
              v_matched_segment := v_seg->>'name';
            END IF;
          END;
        END IF;
      END LOOP;

      v_segment_score := v_best_seg_score;
      IF v_segment_score > 0 THEN v_matches := v_matches + 1; END IF;
    END IF;
  END IF;

  v_total_score := v_industry_score + v_size_score + v_geo_score + v_revenue_score + v_segment_score;
  IF v_matches >= 3 THEN v_total_score := LEAST(100, v_total_score + 5); END IF;

  v_fit_score := v_total_score;
  IF v_missing_vertical THEN
    v_total_score := LEAST(v_total_score, 69);
    v_fit_score := LEAST(v_fit_score, 69);
  END IF;

  RETURN jsonb_build_object(
    'overall', v_total_score,
    'fit', v_fit_score,
    'intent', v_intent_score,
    'reachability', 70,
    'missing_required_vertical', v_missing_vertical,
    'matched_segment', v_matched_segment
  );
END;
$function$;


-- 2. calculate_account_score_readonly (same logic, read-only for UI)
CREATE OR REPLACE FUNCTION public.calculate_account_score_readonly(account_external_id text, icp_id uuid, org_id_param uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path = public
AS $function$
DECLARE
  account_rec RECORD;
  icp_rec RECORD;
  v_industry_score integer := 0;
  v_size_score integer := 0;
  v_geo_score integer := 0;
  v_revenue_score integer := 0;
  v_segment_score integer := 0;
  v_total_score integer := 0;
  v_fit_score integer := 0;
  v_intent_score integer := 50;
  v_matches integer := 0;
  v_industry text;
  v_keyword text;
  v_geo text;
  v_rev text;
  v_seg jsonb;
  v_segments jsonb;
  v_bed_count numeric;
  v_ec numeric;
  v_crit_total integer;
  v_crit_matched integer;
  v_best_seg_score integer := 0;
  v_any_seg_has_beds boolean := false;
  v_missing_vertical boolean := false;
  v_min_beds integer;
  v_max_beds integer;
  v_bed_range text;
  v_size_label text;
  v_size_min integer;
  v_size_max integer;
  v_matched_segment text := null;
  v_excluded boolean := false;
  v_ex_ind text;
BEGIN
  SELECT * INTO account_rec FROM public.accounts 
  WHERE external_id = calculate_account_score_readonly.account_external_id AND org_id = org_id_param;
  
  SELECT * INTO icp_rec FROM public.icp_profiles 
  WHERE id = calculate_account_score_readonly.icp_id AND org_id = org_id_param;
  
  IF account_rec IS NULL OR icp_rec IS NULL THEN
    RETURN jsonb_build_object('overall', 0, 'fit', 0, 'intent', v_intent_score, 'reachability', 0);
  END IF;

  -- Excluded industries check
  IF account_rec.industry_norm IS NOT NULL AND icp_rec.excluded_industries IS NOT NULL THEN
    FOREACH v_ex_ind IN ARRAY icp_rec.excluded_industries
    LOOP
      IF lower(account_rec.industry_norm) LIKE '%' || lower(v_ex_ind) || '%' THEN
        v_excluded := true;
        EXIT;
      END IF;
    END LOOP;
    IF v_excluded THEN
      RETURN jsonb_build_object('overall', 0, 'fit', 0, 'intent', v_intent_score, 'reachability', 0);
    END IF;
  END IF;

  -- Industry scoring (20 points)
  IF account_rec.industry_norm IS NOT NULL AND icp_rec.industries IS NOT NULL THEN
    FOREACH v_industry IN ARRAY icp_rec.industries
    LOOP
      IF lower(account_rec.industry_norm) LIKE '%' || lower(v_industry) || '%' 
         OR lower(v_industry) LIKE '%' || lower(account_rec.industry_norm) || '%' THEN
        v_industry_score := 20;
        v_matches := v_matches + 1;
        EXIT;
      END IF;
    END LOOP;
    
    IF v_industry_score = 0 AND icp_rec.company_keywords IS NOT NULL AND array_length(icp_rec.company_keywords, 1) > 0 THEN
      FOREACH v_keyword IN ARRAY icp_rec.company_keywords
      LOOP
        IF lower(account_rec.industry_norm) LIKE '%' || lower(v_keyword) || '%' THEN
          v_industry_score := 20;
          v_matches := v_matches + 1;
          EXIT;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Size scoring (15 points)
  IF account_rec.employee_count IS NOT NULL AND icp_rec.company_sizes IS NOT NULL AND array_length(icp_rec.company_sizes, 1) > 0 THEN
    DECLARE
      v_min_size integer;
      v_max_size integer;
      v_sizes integer[];
    BEGIN
      v_sizes := icp_rec.company_sizes;
      SELECT min(s), max(s) INTO v_min_size, v_max_size FROM unnest(v_sizes) s;
      IF account_rec.employee_count >= v_min_size AND account_rec.employee_count <= v_max_size THEN
        v_size_score := 15;
        v_matches := v_matches + 1;
      ELSIF account_rec.employee_count >= v_min_size * 0.5 AND account_rec.employee_count <= v_max_size * 2 THEN
        v_size_score := 8;
        v_matches := v_matches + 1;
      END IF;
    END;
  END IF;

  -- Geography scoring (10 points)
  IF account_rec.country IS NOT NULL AND icp_rec.geographies IS NOT NULL THEN
    FOREACH v_geo IN ARRAY icp_rec.geographies
    LOOP
      IF lower(account_rec.country) = lower(v_geo) THEN
        v_geo_score := 10;
        v_matches := v_matches + 1;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Revenue scoring (20 points, tiered)
  IF account_rec.revenue_range IS NOT NULL AND icp_rec.revenue_ranges IS NOT NULL THEN
    FOREACH v_rev IN ARRAY icp_rec.revenue_ranges
    LOOP
      IF account_rec.revenue_range = v_rev THEN
        IF v_rev IN ('$250M-$500M', '$500M-$1B', '$1B-$5B', '$5B+') THEN
          v_revenue_score := 20;
        ELSE
          v_revenue_score := 12;
        END IF;
        v_matches := v_matches + 1;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Segment scoring (30 points)
  v_ec := account_rec.employee_count;
  v_bed_count := CASE WHEN account_rec.custom_attributes IS NOT NULL 
    AND (account_rec.custom_attributes->>'bed_count') IS NOT NULL 
    THEN (account_rec.custom_attributes->>'bed_count')::numeric ELSE NULL END;

  IF icp_rec.vertical_filters IS NOT NULL AND icp_rec.vertical_filters ? 'segments' THEN
    v_segments := icp_rec.vertical_filters->'segments';
    IF jsonb_array_length(v_segments) > 0 THEN
      FOR v_seg IN SELECT * FROM jsonb_array_elements(v_segments)
      LOOP
        IF v_seg->>'bed_range' IS NOT NULL THEN
          v_any_seg_has_beds := true;
          EXIT;
        END IF;
      END LOOP;

      IF v_any_seg_has_beds AND v_bed_count IS NULL THEN
        v_missing_vertical := true;
      END IF;

      FOR v_seg IN SELECT * FROM jsonb_array_elements(v_segments)
      LOOP
        v_crit_total := 0;
        v_crit_matched := 0;

        v_bed_range := v_seg->>'bed_range';
        IF v_bed_range IS NOT NULL THEN
          v_crit_total := v_crit_total + 2;
          IF v_bed_count IS NOT NULL THEN
            v_min_beds := split_part(replace(v_bed_range, '+', ''), '-', 1)::integer;
            v_max_beds := CASE WHEN v_bed_range LIKE '%+' THEN 999999 
              ELSE COALESCE(NULLIF(split_part(replace(v_bed_range, '+', ''), '-', 2), '')::integer, 999999) END;
            IF v_bed_count >= v_min_beds AND v_bed_count <= v_max_beds THEN
              v_crit_matched := v_crit_matched + 2;
            END IF;
          END IF;
        END IF;

        v_size_label := lower(COALESCE(v_seg->>'size', ''));
        IF v_size_label != '' AND v_ec IS NOT NULL THEN
          v_crit_total := v_crit_total + 1;
          v_size_min := CASE v_size_label WHEN 'small' THEN 1 WHEN 'small-mid' THEN 30 WHEN 'mid-large' THEN 200 WHEN 'large' THEN 500 ELSE 0 END;
          v_size_max := CASE v_size_label WHEN 'small' THEN 100 WHEN 'small-mid' THEN 300 WHEN 'mid-large' THEN 5000 WHEN 'large' THEN 999999 ELSE 0 END;
          IF v_ec >= v_size_min AND v_ec <= v_size_max THEN
            v_crit_matched := v_crit_matched + 1;
          END IF;
        END IF;

        IF v_crit_total > 0 THEN
          DECLARE v_score integer;
          BEGIN
            v_score := round(30.0 * v_crit_matched / v_crit_total);
            IF v_score > v_best_seg_score THEN
              v_best_seg_score := v_score;
              v_matched_segment := v_seg->>'name';
            END IF;
          END;
        END IF;
      END LOOP;

      v_segment_score := v_best_seg_score;
      IF v_segment_score > 0 THEN v_matches := v_matches + 1; END IF;
    END IF;
  END IF;

  v_total_score := v_industry_score + v_size_score + v_geo_score + v_revenue_score + v_segment_score;
  IF v_matches >= 3 THEN v_total_score := LEAST(100, v_total_score + 5); END IF;

  v_fit_score := v_total_score;
  IF v_missing_vertical THEN
    v_total_score := LEAST(v_total_score, 69);
    v_fit_score := LEAST(v_fit_score, 69);
  END IF;

  RETURN jsonb_build_object(
    'overall', v_total_score,
    'fit', v_fit_score,
    'intent', v_intent_score,
    'reachability', 70,
    'missing_required_vertical', v_missing_vertical,
    'matched_segment', v_matched_segment
  );
END;
$function$;