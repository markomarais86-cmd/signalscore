-- Create feature importance weights cache table
CREATE TABLE IF NOT EXISTS public.icp_feature_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  icp_id UUID NOT NULL REFERENCES public.icp_profiles(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  r_value NUMERIC NOT NULL,
  p_value NUMERIC NOT NULL,
  weight NUMERIC NOT NULL, -- |r_value| × (1 - p_value)
  is_significant BOOLEAN NOT NULL DEFAULT false,
  sample_size INTEGER,
  computed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, icp_id, feature_name)
);

-- Enable RLS
ALTER TABLE public.icp_feature_weights ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view feature weights in their org"
  ON public.icp_feature_weights FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "System can insert feature weights"
  ON public.icp_feature_weights FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update feature weights"
  ON public.icp_feature_weights FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete feature weights"
  ON public.icp_feature_weights FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Index for performance
CREATE INDEX idx_feature_weights_org_icp ON public.icp_feature_weights(org_id, icp_id);
CREATE INDEX idx_feature_weights_computed ON public.icp_feature_weights(computed_at DESC);

-- Function to calculate weighted account score using cached feature weights
CREATE OR REPLACE FUNCTION public.calculate_weighted_account_score(
  p_account_external_id TEXT,
  p_icp_id UUID,
  p_org_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_account RECORD;
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
BEGIN
  -- Get account data
  SELECT * INTO v_account
  FROM public.accounts
  WHERE external_id = p_account_external_id AND org_id = p_org_id;

  IF v_account IS NULL THEN
    RETURN jsonb_build_object('error', 'Account not found');
  END IF;

  -- Get feature weights for this ICP
  FOR v_weights IN
    SELECT feature_name, r_value, p_value, weight, is_significant
    FROM public.icp_feature_weights
    WHERE org_id = p_org_id AND icp_id = p_icp_id
    ORDER BY weight DESC
  LOOP
    v_normalized_value := 0;
    
    -- Calculate normalized feature value based on feature type
    CASE v_weights.feature_name
      WHEN 'industry' THEN
        v_normalized_value := CASE WHEN v_account.industry_norm IS NOT NULL THEN 1 ELSE 0 END;
      WHEN 'size' THEN
        v_normalized_value := CASE WHEN v_account.employee_count IS NOT NULL THEN 1 ELSE 0 END;
      WHEN 'revenue' THEN
        v_normalized_value := CASE WHEN v_account.revenue_range IS NOT NULL THEN 1 ELSE 0 END;
      WHEN 'geography' THEN
        v_normalized_value := CASE WHEN v_account.country IS NOT NULL THEN 1 ELSE 0 END;
      WHEN 'contacts' THEN
        -- Count leads for this account
        SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END INTO v_normalized_value
        FROM public."Leads"
        WHERE account_external_id = p_account_external_id AND org_id = p_org_id;
      WHEN 'data_quality' THEN
        -- Calculate data completeness
        v_normalized_value := (
          CASE WHEN v_account.industry_norm IS NOT NULL THEN 0.25 ELSE 0 END +
          CASE WHEN v_account.employee_count IS NOT NULL THEN 0.25 ELSE 0 END +
          CASE WHEN v_account.revenue_range IS NOT NULL THEN 0.25 ELSE 0 END +
          CASE WHEN v_account.country IS NOT NULL THEN 0.25 ELSE 0 END
        );
    END CASE;

    -- Calculate contribution: weight × normalized_value
    v_contribution := v_weights.weight * v_normalized_value;
    v_score := v_score + v_contribution;
    v_max_score := v_max_score + v_weights.weight;

    -- Track significant features
    IF v_weights.is_significant THEN
      v_significant_count := v_significant_count + 1;
      v_total_weight := v_total_weight + ABS(v_weights.r_value);
    END IF;

    -- Store feature breakdown
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
    v_overall_score := 50; -- Default if no weights available
  END IF;

  -- Calculate confidence
  IF v_significant_count > 0 THEN
    v_confidence := ROUND(
      (v_significant_count::NUMERIC / 6) * 60 + -- 6 possible features
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;