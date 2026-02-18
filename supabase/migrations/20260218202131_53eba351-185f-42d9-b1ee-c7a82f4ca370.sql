CREATE OR REPLACE FUNCTION public.calculate_account_score_readonly(p_account_external_id text, p_org_id text, p_icp_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
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
  v_missing_required_vertical boolean := false;
BEGIN
  -- Get account
  SELECT * INTO account_rec FROM accounts
  WHERE external_id = p_account_external_id AND org_id = p_org_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'overall', 0, 'fit', 0, 'intent', 50, 'reachability', 70,
      'breakdown', jsonb_build_object(
        'industry_score', 0, 'size_score', 0, 'geo_score', 0,
        'revenue_score', 0, 'vertical_score', 0
      )
    );
  END IF;

  -- Get ICP
  IF p_icp_id IS NOT NULL THEN
    SELECT * INTO icp_rec FROM icp_profiles WHERE id = p_icp_id::uuid AND org_id = p_org_id;
  ELSE
    SELECT * INTO icp_rec FROM icp_profiles WHERE org_id = p_org_id AND (is_primary = true OR status = 'active') ORDER BY is_primary DESC NULLS LAST LIMIT 1;
  END IF;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('overall', 0, 'fit', 0, 'intent', 50, 'reachability', 70,
      'breakdown', jsonb_build_object('industry_score', 0, 'size_score', 0, 'geo_score', 0, 'revenue_score', 0, 'vertical_score', 0));
  END IF;

  -- Industry scoring (30 points)
  IF account_rec.industry_norm IS NOT NULL AND icp_rec.industries IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM unnest(icp_rec.industries) ind
      WHERE LOWER(account_rec.industry_norm) LIKE '%' || LOWER(ind) || '%'
         OR LOWER(ind) LIKE '%' || LOWER(account_rec.industry_norm) || '%'
    ) THEN
      industry_score := 30;
      matches := matches + 1;
    END IF;
  END IF;

  -- Size scoring (25 points)
  IF account_rec.employee_count IS NOT NULL AND icp_rec.company_sizes IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM unnest(icp_rec.company_sizes) s
      WHERE account_rec.employee_count BETWEEN s * 0.5 AND s * 2
    ) THEN
      size_score := 25;
      matches := matches + 1;
    END IF;
  END IF;

  -- Geography scoring (25 points)
  IF account_rec.country IS NOT NULL AND icp_rec.geographies IS NOT NULL THEN
    IF LOWER(account_rec.country) = ANY(SELECT LOWER(g) FROM unnest(icp_rec.geographies) g) THEN
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

  -- Vertical scoring (up to 15 bonus points)
  IF icp_rec.vertical_filters IS NOT NULL AND icp_rec.vertical_filters != '{}'::jsonb THEN
    -- Handle segments-based vertical_filters
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
        v_any_seg_has_beds boolean := false;
      BEGIN
        -- Check if ANY segment defines bed_range (meaning beds are required for this ICP)
        FOR v_seg IN SELECT * FROM jsonb_array_elements(icp_rec.vertical_filters -> 'segments')
        LOOP
          IF (v_seg ->> 'bed_range') IS NOT NULL THEN
            v_any_seg_has_beds := true;
            EXIT;
          END IF;
        END LOOP;

        -- If ICP requires beds but account has no bed_count, flag as missing required vertical
        IF v_any_seg_has_beds AND (
          account_rec.custom_attributes IS NULL 
          OR (account_rec.custom_attributes ->> 'bed_count') IS NULL
          OR TRIM(account_rec.custom_attributes ->> 'bed_count') = ''
        ) THEN
          v_missing_required_vertical := true;
        END IF;

        FOR v_seg IN SELECT * FROM jsonb_array_elements(icp_rec.vertical_filters -> 'segments')
        LOOP
          v_crit_total := 0;
          v_crit_matched := 0;

          -- Match on size label using employee_count
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

          -- Match on bed_range — ALWAYS count as a criterion if defined (even when bed_count is missing)
          v_bed_range := v_seg ->> 'bed_range';
          IF v_bed_range IS NOT NULL THEN
            v_crit_total := v_crit_total + 1;
            IF account_rec.custom_attributes IS NOT NULL 
               AND (account_rec.custom_attributes ->> 'bed_count') IS NOT NULL
               AND TRIM(account_rec.custom_attributes ->> 'bed_count') != '' THEN
              v_bed_count := (account_rec.custom_attributes ->> 'bed_count')::numeric;
              v_range_parts := string_to_array(REPLACE(v_bed_range, '+', ''), '-');
              v_min_beds := COALESCE(v_range_parts[1]::integer, 0);
              v_max_beds := CASE WHEN v_bed_range LIKE '%+' THEN 999999 
                                 ELSE COALESCE(v_range_parts[2]::integer, 999999) END;
              IF v_bed_count >= v_min_beds AND v_bed_count <= v_max_beds THEN
                v_crit_matched := v_crit_matched + 1;
              END IF;
            END IF;
            -- If bed_count is missing, v_crit_matched stays 0 for this criterion → penalized
          END IF;

          IF v_crit_total > 0 THEN
            v_seg_score := ROUND(15.0 * v_crit_matched / v_crit_total)::integer;
            v_best_score := GREATEST(v_best_score, v_seg_score);
          END IF;
        END LOOP;

        vertical_score := v_best_score;
        IF vertical_score > 0 THEN matches := matches + 1; END IF;
      END;
    -- Handle flat key-value vertical_filters (original logic)
    ELSIF account_rec.custom_attributes IS NOT NULL THEN
      DECLARE
        v_total_criteria integer := 0;
        v_matched_criteria integer := 0;
        v_key text;
        v_val jsonb;
      BEGIN
        FOR v_key, v_val IN SELECT * FROM jsonb_each(icp_rec.vertical_filters)
        LOOP
          IF v_val IS NULL OR v_val = 'null'::jsonb THEN CONTINUE; END IF;
          v_total_criteria := v_total_criteria + 1;
          IF v_key LIKE '%\_min' THEN
            IF (account_rec.custom_attributes ->> REPLACE(v_key, '_min', '')) IS NOT NULL
               AND (account_rec.custom_attributes ->> REPLACE(v_key, '_min', ''))::numeric >= v_val::text::numeric THEN
              v_matched_criteria := v_matched_criteria + 1;
            END IF;
          ELSIF v_key LIKE '%\_max' THEN
            IF (account_rec.custom_attributes ->> REPLACE(v_key, '_max', '')) IS NOT NULL
               AND (account_rec.custom_attributes ->> REPLACE(v_key, '_max', ''))::numeric <= v_val::text::numeric THEN
              v_matched_criteria := v_matched_criteria + 1;
            END IF;
          ELSIF jsonb_typeof(v_val) = 'array' THEN
            IF account_rec.custom_attributes ? v_key
               AND v_val @> to_jsonb(account_rec.custom_attributes ->> v_key) THEN
              v_matched_criteria := v_matched_criteria + 1;
            END IF;
          ELSE
            IF LOWER(COALESCE(account_rec.custom_attributes ->> v_key, '')) = LOWER(v_val #>> '{}') THEN
              v_matched_criteria := v_matched_criteria + 1;
            END IF;
          END IF;
        END LOOP;
        IF v_total_criteria > 0 THEN
          vertical_score := ROUND(15.0 * v_matched_criteria / v_total_criteria)::integer;
          IF v_matched_criteria > 0 THEN matches := matches + 1; END IF;
        END IF;
      END;
    END IF;
  END IF;

  -- Calculate totals
  total_score := industry_score + size_score + geo_score + revenue_score + vertical_score;
  IF matches >= 3 THEN total_score := LEAST(100, total_score + 10); END IF;
  fit_score := total_score;

  -- Cap score at Band C (Low Fit, max 69) if required vertical data is missing
  IF v_missing_required_vertical THEN
    total_score := LEAST(total_score, 69);
    fit_score := LEAST(fit_score, 69);
  END IF;

  RETURN jsonb_build_object(
    'overall', total_score,
    'fit', fit_score,
    'intent', 50,
    'reachability', 70,
    'breakdown', jsonb_build_object(
      'industry_score', industry_score,
      'size_score', size_score,
      'geo_score', geo_score,
      'revenue_score', revenue_score,
      'vertical_score', vertical_score,
      'matches', matches,
      'missing_required_vertical', v_missing_required_vertical
    )
  );
END;
$function$;