-- Fix calculate_account_score to use fuzzy industry matching and range-based employee scoring
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
  v_min_size INTEGER;
  v_max_size INTEGER;
BEGIN
  -- Get account data
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

  -- FUZZY INDUSTRY MATCHING
  -- Check if account industry contains any ICP industry keyword (case-insensitive)
  IF account_rec.industry_norm IS NOT NULL OR account_rec.industry_raw IS NOT NULL THEN
    FOREACH v_icp_industry IN ARRAY COALESCE(icp_rec.industries, ARRAY[]::TEXT[])
    LOOP
      IF (account_rec.industry_norm ILIKE '%' || v_icp_industry || '%') OR
         (account_rec.industry_raw ILIKE '%' || v_icp_industry || '%') OR
         -- Handle common variations
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
        EXIT; -- Found a match, no need to continue
      END IF;
    END LOOP;
    
    v_breakdown := v_breakdown || jsonb_build_object(
      'factor', 'industry',
      'score', v_industry_score,
      'match', v_industry_score > 0,
      'value', COALESCE(account_rec.industry_norm, account_rec.industry_raw)
    );
  END IF;

  -- RANGE-BASED EMPLOYEE COUNT SCORING
  -- Get min and max from ICP company_sizes array
  IF account_rec.employee_count IS NOT NULL AND icp_rec.company_sizes IS NOT NULL AND array_length(icp_rec.company_sizes, 1) > 0 THEN
    SELECT MIN(s), MAX(s) INTO v_min_size, v_max_size
    FROM unnest(icp_rec.company_sizes) AS s;
    
    -- Score based on how well employee count fits the range
    IF account_rec.employee_count >= v_min_size AND account_rec.employee_count <= v_max_size THEN
      v_size_score := 100; -- Perfect fit within range
    ELSIF account_rec.employee_count >= (v_min_size * 0.5) AND account_rec.employee_count <= (v_max_size * 2) THEN
      v_size_score := 75; -- Close to range (within 50%-200%)
    ELSIF account_rec.employee_count >= (v_min_size * 0.25) AND account_rec.employee_count <= (v_max_size * 4) THEN
      v_size_score := 50; -- Somewhat close (within 25%-400%)
    ELSE
      v_size_score := 25; -- Has data but outside ideal range
    END IF;
    
    v_breakdown := v_breakdown || jsonb_build_object(
      'factor', 'size',
      'score', v_size_score,
      'match', v_size_score >= 75,
      'value', account_rec.employee_count,
      'icp_range', jsonb_build_object('min', v_min_size, 'max', v_max_size)
    );
  END IF;

  -- FUZZY REVENUE MATCHING (partial string match)
  IF account_rec.revenue_range IS NOT NULL AND icp_rec.revenue_ranges IS NOT NULL THEN
    IF account_rec.revenue_range = ANY(icp_rec.revenue_ranges) THEN
      v_revenue_score := 100;
    ELSE
      -- Try partial matching for revenue ranges
      DECLARE
        v_rev_range TEXT;
      BEGIN
        FOREACH v_rev_range IN ARRAY icp_rec.revenue_ranges
        LOOP
          -- Extract key numbers and compare (e.g., "$10M-$50M" contains "10M" or "50M")
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

  -- GEOGRAPHY MATCHING (exact for now, could be expanded)
  IF account_rec.country IS NOT NULL AND icp_rec.geographies IS NOT NULL THEN
    IF account_rec.country = ANY(icp_rec.geographies) THEN
      v_geography_score := 100;
    ELSE
      -- Try partial matching for geography
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

  -- Calculate dynamic Intent Score
  v_intent_score := public.calculate_intent_score(p_account_external_id, p_org_id);
  
  -- Calculate dynamic Reachability Score
  v_reachability_score := public.calculate_reachability_score(p_account_external_id, p_org_id);

  -- Calculate overall score (weighted average)
  -- Fit: 60%, Intent: 20%, Reachability: 20%
  v_overall_score := ROUND(
    (v_fit_score * 0.6) + 
    (v_intent_score * 0.2) + 
    (v_reachability_score * 0.2)
  )::INTEGER;

  -- Insert/update score with dynamic values
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
    v_intent_score,
    v_reachability_score,
    v_breakdown,
    'fuzzy_v4.0',
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
    'intent', v_intent_score,
    'reachability', v_reachability_score,
    'breakdown', v_breakdown
  );
END;
$$;

-- Also fix calculate_weighted_account_score to actually compare against ICP criteria
CREATE OR REPLACE FUNCTION public.calculate_weighted_account_score(
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
  v_account RECORD;
  v_icp RECORD;
  v_weights RECORD;
  v_score NUMERIC := 0;
  v_max_score NUMERIC := 0;
  v_feature_scores JSONB := '[]'::jsonb;
  v_normalized_value NUMERIC;
  v_contribution NUMERIC;
  v_significant_count INTEGER := 0;
  v_total_weight NUMERIC := 0;
  v_confidence NUMERIC;
  v_overall_score INTEGER;
  v_band TEXT;
  v_icp_industry TEXT;
  v_min_size INTEGER;
  v_max_size INTEGER;
BEGIN
  -- Get account data
  SELECT * INTO v_account
  FROM public.accounts
  WHERE external_id = p_account_external_id AND org_id = p_org_id;

  IF v_account IS NULL THEN
    RETURN jsonb_build_object('error', 'Account not found');
  END IF;

  -- Get ICP profile for matching criteria
  SELECT * INTO v_icp
  FROM public.icp_profiles
  WHERE id = p_icp_id AND org_id = p_org_id;

  -- Get feature weights for this ICP
  FOR v_weights IN
    SELECT feature_name, r_value, p_value, weight, is_significant
    FROM public.icp_feature_weights
    WHERE org_id = p_org_id AND icp_id = p_icp_id
    ORDER BY weight DESC
  LOOP
    v_normalized_value := 0;
    
    -- Calculate normalized feature value based on actual ICP matching
    CASE v_weights.feature_name
      WHEN 'industry' THEN
        -- FUZZY INDUSTRY MATCHING
        IF v_account.industry_norm IS NOT NULL OR v_account.industry_raw IS NOT NULL THEN
          IF v_icp IS NOT NULL AND v_icp.industries IS NOT NULL THEN
            FOREACH v_icp_industry IN ARRAY v_icp.industries
            LOOP
              IF (v_account.industry_norm ILIKE '%' || v_icp_industry || '%') OR
                 (v_account.industry_raw ILIKE '%' || v_icp_industry || '%') OR
                 (v_icp_industry = 'Technology' AND (v_account.industry_norm ILIKE '%Software%' OR v_account.industry_norm ILIKE '%IT%' OR v_account.industry_norm ILIKE '%Computer%')) OR
                 (v_icp_industry = 'Software' AND (v_account.industry_norm ILIKE '%Software%' OR v_account.industry_norm ILIKE '%Computer%')) OR
                 (v_icp_industry = 'Healthcare' AND (v_account.industry_norm ILIKE '%Health%' OR v_account.industry_norm ILIKE '%Hospital%' OR v_account.industry_norm ILIKE '%Medical%')) OR
                 (v_icp_industry = 'Manufacturing' AND v_account.industry_norm ILIKE '%Manufactur%') OR
                 (v_icp_industry = 'Education' AND (v_account.industry_norm ILIKE '%Education%' OR v_account.industry_norm ILIKE '%University%' OR v_account.industry_norm ILIKE '%College%')) OR
                 (v_icp_industry = 'Financial Services' AND (v_account.industry_norm ILIKE '%Financial%' OR v_account.industry_norm ILIKE '%Banking%' OR v_account.industry_norm ILIKE '%Insurance%')) OR
                 (v_icp_industry = 'Energy & Utilities' AND (v_account.industry_norm ILIKE '%Energy%' OR v_account.industry_norm ILIKE '%Oil%' OR v_account.industry_norm ILIKE '%Utilit%')) OR
                 (v_icp_industry = 'Media & Entertainment' AND (v_account.industry_norm ILIKE '%Media%' OR v_account.industry_norm ILIKE '%Entertainment%')) OR
                 (v_icp_industry = 'Telecommunications' AND v_account.industry_norm ILIKE '%Telecom%') OR
                 (v_icp_industry = 'Professional Services' AND (v_account.industry_norm ILIKE '%Professional%' OR v_account.industry_norm ILIKE '%Consulting%' OR v_account.industry_norm ILIKE '%Services%')) OR
                 (v_icp_industry = 'IT Services' AND (v_account.industry_norm ILIKE '%IT%' OR v_account.industry_norm ILIKE '%Information Tech%')) OR
                 (v_icp_industry = 'Consulting' AND v_account.industry_norm ILIKE '%Consult%') OR
                 (v_icp_industry = 'Business Services' AND (v_account.industry_norm ILIKE '%Business%' OR v_account.industry_norm ILIKE '%Services%')) OR
                 (v_icp_industry = 'Retail' AND v_account.industry_norm ILIKE '%Retail%')
              THEN
                v_normalized_value := 1;
                EXIT;
              END IF;
            END LOOP;
          ELSE
            v_normalized_value := 0.5; -- Has industry data but no ICP to compare
          END IF;
        END IF;
        
      WHEN 'size' THEN
        -- RANGE-BASED SIZE MATCHING
        IF v_account.employee_count IS NOT NULL THEN
          IF v_icp IS NOT NULL AND v_icp.company_sizes IS NOT NULL AND array_length(v_icp.company_sizes, 1) > 0 THEN
            SELECT MIN(s), MAX(s) INTO v_min_size, v_max_size
            FROM unnest(v_icp.company_sizes) AS s;
            
            IF v_account.employee_count >= v_min_size AND v_account.employee_count <= v_max_size THEN
              v_normalized_value := 1.0; -- Perfect fit
            ELSIF v_account.employee_count >= (v_min_size * 0.5) AND v_account.employee_count <= (v_max_size * 2) THEN
              v_normalized_value := 0.75; -- Close
            ELSIF v_account.employee_count >= (v_min_size * 0.25) AND v_account.employee_count <= (v_max_size * 4) THEN
              v_normalized_value := 0.5; -- Somewhat close
            ELSE
              v_normalized_value := 0.25; -- Has data but outside range
            END IF;
          ELSE
            v_normalized_value := 0.5; -- Has size data but no ICP to compare
          END IF;
        END IF;
        
      WHEN 'revenue' THEN
        IF v_account.revenue_range IS NOT NULL THEN
          IF v_icp IS NOT NULL AND v_icp.revenue_ranges IS NOT NULL AND v_account.revenue_range = ANY(v_icp.revenue_ranges) THEN
            v_normalized_value := 1;
          ELSE
            v_normalized_value := 0.5; -- Has data but doesn't match
          END IF;
        END IF;
        
      WHEN 'geography' THEN
        IF v_account.country IS NOT NULL THEN
          IF v_icp IS NOT NULL AND v_icp.geographies IS NOT NULL AND v_account.country = ANY(v_icp.geographies) THEN
            v_normalized_value := 1;
          ELSE
            v_normalized_value := 0.5; -- Has data but doesn't match
          END IF;
        END IF;
        
      WHEN 'contacts' THEN
        SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END INTO v_normalized_value
        FROM public."Leads"
        WHERE account_external_id = p_account_external_id AND org_id = p_org_id;
        
      WHEN 'data_quality' THEN
        v_normalized_value := (
          CASE WHEN v_account.industry_norm IS NOT NULL THEN 0.25 ELSE 0 END +
          CASE WHEN v_account.employee_count IS NOT NULL THEN 0.25 ELSE 0 END +
          CASE WHEN v_account.revenue_range IS NOT NULL THEN 0.25 ELSE 0 END +
          CASE WHEN v_account.country IS NOT NULL THEN 0.25 ELSE 0 END
        );
    END CASE;

    v_contribution := v_weights.weight * v_normalized_value;
    v_score := v_score + v_contribution;
    v_max_score := v_max_score + v_weights.weight;

    IF v_weights.is_significant THEN
      v_significant_count := v_significant_count + 1;
      v_total_weight := v_total_weight + ABS(v_weights.r_value);
    END IF;

    v_feature_scores := v_feature_scores || jsonb_build_object(
      'feature', v_weights.feature_name,
      'weight', v_weights.weight,
      'value', v_normalized_value,
      'contribution', v_contribution,
      'r_value', v_weights.r_value,
      'p_value', v_weights.p_value,
      'significant', v_weights.is_significant
    );
  END LOOP;

  -- Normalize score to 0-100 range
  IF v_max_score > 0 THEN
    v_overall_score := ROUND((v_score / v_max_score) * 100)::INTEGER;
  ELSE
    v_overall_score := 50;
  END IF;

  -- Calculate confidence
  IF v_significant_count > 0 THEN
    v_confidence := ROUND(
      (v_significant_count::NUMERIC / 6) * 60 +
      (v_total_weight / v_significant_count) * 40
    )::INTEGER;
  ELSE
    v_confidence := 0;
  END IF;

  -- Determine score band
  IF v_overall_score >= 70 THEN
    v_band := 'A';
  ELSIF v_overall_score >= 40 THEN
    v_band := 'B';
  ELSE
    v_band := 'C';
  END IF;

  RETURN jsonb_build_object(
    'overall', v_overall_score,
    'band', v_band,
    'confidence', v_confidence,
    'breakdown', v_feature_scores,
    'significant_features', v_significant_count,
    'max_score', v_max_score,
    'raw_score', v_score
  );
END;
$$;