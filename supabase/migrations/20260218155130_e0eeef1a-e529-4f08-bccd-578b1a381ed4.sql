-- Fix vertical scoring to handle segments-based vertical_filters structure
-- The 91.Life Heart+ ICP uses {segments: [{name, size, bed_range, key_personas}]}
-- but the scoring code expected flat key-value pairs.
-- This update handles both formats.

-- 1. Fix calculate_account_score_readonly
CREATE OR REPLACE FUNCTION public.calculate_account_score_readonly(
  p_account_external_id text,
  p_org_id text,
  p_icp_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
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
      BEGIN
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

          -- Match on bed_range if bed_count custom attribute exists
          v_bed_range := v_seg ->> 'bed_range';
          IF v_bed_range IS NOT NULL AND account_rec.custom_attributes IS NOT NULL 
             AND (account_rec.custom_attributes ->> 'bed_count') IS NOT NULL THEN
            v_crit_total := v_crit_total + 1;
            v_bed_count := (account_rec.custom_attributes ->> 'bed_count')::numeric;
            v_range_parts := string_to_array(REPLACE(v_bed_range, '+', ''), '-');
            v_min_beds := COALESCE(v_range_parts[1]::integer, 0);
            v_max_beds := CASE WHEN v_bed_range LIKE '%+' THEN 999999 
                               ELSE COALESCE(v_range_parts[2]::integer, 999999) END;
            IF v_bed_count >= v_min_beds AND v_bed_count <= v_max_beds THEN
              v_crit_matched := v_crit_matched + 1;
            END IF;
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
      'matches', matches
    )
  );
END;
$$;


-- 2. Fix calculate_account_score (write scorer) with same segments logic
-- We update only the vertical scoring block
CREATE OR REPLACE FUNCTION public.calculate_account_score(
  p_account_external_id text,
  p_org_id text,
  p_icp_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  account_rec RECORD;
  icp_rec RECORD;
  v_industry_score INTEGER := 0;
  v_size_score INTEGER := 0;
  v_revenue_score INTEGER := 0;
  v_geography_score INTEGER := 0;
  v_vertical_score INTEGER := 0;
  v_total_score INTEGER := 0;
  v_max_score INTEGER := 400;
  v_fit_score INTEGER := 0;
  v_intent_score INTEGER := 50;
  v_reachability_score INTEGER := 70;
  v_overall_score INTEGER := 0;
  v_breakdown jsonb := '[]'::jsonb;
  v_matches INTEGER := 0;
BEGIN
  SELECT * INTO account_rec FROM accounts
    WHERE external_id = p_account_external_id AND org_id = p_org_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Account not found');
  END IF;

  IF p_icp_id IS NOT NULL THEN
    SELECT * INTO icp_rec FROM icp_profiles WHERE id = p_icp_id::uuid AND org_id = p_org_id;
  ELSE
    SELECT * INTO icp_rec FROM icp_profiles
      WHERE org_id = p_org_id AND (is_primary = true OR status = 'active')
      ORDER BY is_primary DESC NULLS LAST LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'No ICP profile found');
  END IF;

  -- Industry (100 pts in v_max_score=400 system)
  IF account_rec.industry_norm IS NOT NULL AND icp_rec.industries IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM unnest(icp_rec.industries) ind
      WHERE LOWER(account_rec.industry_norm) LIKE '%' || LOWER(ind) || '%'
         OR LOWER(ind) LIKE '%' || LOWER(account_rec.industry_norm) || '%'
    ) THEN
      v_industry_score := 100;
      v_matches := v_matches + 1;
    END IF;
  END IF;
  v_breakdown := v_breakdown || jsonb_build_object('factor', 'industry', 'score', v_industry_score, 'match', v_industry_score > 0, 'value', COALESCE(account_rec.industry_norm, 'unknown'));

  -- Company size (100 pts)
  IF account_rec.employee_count IS NOT NULL AND icp_rec.company_sizes IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM unnest(icp_rec.company_sizes) s
      WHERE account_rec.employee_count BETWEEN s * 0.5 AND s * 2
    ) THEN
      v_size_score := 100;
      v_matches := v_matches + 1;
    END IF;
  END IF;
  v_breakdown := v_breakdown || jsonb_build_object('factor', 'company_size', 'score', v_size_score, 'match', v_size_score > 0, 'value', COALESCE(account_rec.employee_count::text, 'unknown'));

  -- Revenue (100 pts)
  IF account_rec.revenue_range IS NOT NULL AND icp_rec.revenue_ranges IS NOT NULL THEN
    IF account_rec.revenue_range = ANY(icp_rec.revenue_ranges) THEN
      v_revenue_score := 100;
      v_matches := v_matches + 1;
    END IF;
  END IF;
  v_breakdown := v_breakdown || jsonb_build_object('factor', 'revenue', 'score', v_revenue_score, 'match', v_revenue_score > 0, 'value', COALESCE(account_rec.revenue_range, 'unknown'));

  -- Geography (100 pts)
  IF account_rec.country IS NOT NULL AND icp_rec.geographies IS NOT NULL THEN
    IF LOWER(account_rec.country) = ANY(SELECT LOWER(g) FROM unnest(icp_rec.geographies) g) THEN
      v_geography_score := 100;
      v_matches := v_matches + 1;
    END IF;
  END IF;
  v_breakdown := v_breakdown || jsonb_build_object('factor', 'geography', 'score', v_geography_score, 'match', v_geography_score > 0, 'value', COALESCE(account_rec.country, 'unknown'));

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
            v_bed_count := (account_rec.custom_attributes ->> 'bed_count')::numeric;
            v_range_parts := string_to_array(REPLACE(v_bed_range, '+', ''), '-');
            v_min_beds := COALESCE(v_range_parts[1]::integer, 0);
            v_max_beds := CASE WHEN v_bed_range LIKE '%+' THEN 999999
                               ELSE COALESCE(v_range_parts[2]::integer, 999999) END;
            IF v_bed_count >= v_min_beds AND v_bed_count <= v_max_beds THEN
              v_crit_matched := v_crit_matched + 1;
            END IF;
          END IF;

          IF v_crit_total > 0 THEN
            v_seg_score := ROUND(15.0 * v_crit_matched / v_crit_total)::integer;
            v_best_score := GREATEST(v_best_score, v_seg_score);
          END IF;
        END LOOP;

        v_vertical_score := v_best_score;
        IF v_vertical_score > 0 THEN v_matches := v_matches + 1; END IF;
      END;
    -- Handle flat key-value vertical_filters
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
          IF v_mc > 0 THEN v_matches := v_matches + 1; END IF;
        END IF;
      END;
    END IF;
  END IF;

  v_breakdown := v_breakdown || jsonb_build_object('factor', 'vertical', 'score', v_vertical_score, 'match', v_vertical_score > 0, 'value', 'custom_attributes');

  v_total_score := v_industry_score + v_size_score + v_revenue_score + v_geography_score;
  v_fit_score := ROUND((v_total_score::NUMERIC / v_max_score) * 100)::INTEGER;
  v_fit_score := LEAST(100, v_fit_score + v_vertical_score);

  v_intent_score := public.calculate_intent_score(p_account_external_id, p_org_id);
  v_reachability_score := 70;
  v_overall_score := ROUND(v_fit_score * 0.5 + v_intent_score * 0.3 + v_reachability_score * 0.2)::INTEGER;

  INSERT INTO scores (org_id, account_external_id, overall, fit, intent, reachability, reasons, scoring_version, computed_at, icp_id)
  VALUES (
    p_org_id, p_account_external_id, v_overall_score, v_fit_score,
    v_intent_score, v_reachability_score, v_breakdown,
    'fuzzy_v4.2_vertical_segments', now(),
    icp_rec.id
  )
  ON CONFLICT (org_id, account_external_id)
  DO UPDATE SET
    overall = EXCLUDED.overall,
    fit = EXCLUDED.fit,
    intent = EXCLUDED.intent,
    reachability = EXCLUDED.reachability,
    reasons = EXCLUDED.reasons,
    scoring_version = EXCLUDED.scoring_version,
    computed_at = EXCLUDED.computed_at,
    icp_id = EXCLUDED.icp_id;

  RETURN jsonb_build_object(
    'overall', v_overall_score,
    'fit', v_fit_score,
    'intent', v_intent_score,
    'reachability', v_reachability_score,
    'breakdown', v_breakdown,
    'icp_id', icp_rec.id
  );
END;
$$;