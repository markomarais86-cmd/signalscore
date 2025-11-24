-- ============================================
-- Week 2: Dynamic Intent & Reachability Scoring
-- ============================================

-- Function to calculate dynamic Intent Score
-- Based on: funding signals, tech stack, enrichment freshness
CREATE OR REPLACE FUNCTION public.calculate_intent_score(
  p_account_external_id TEXT,
  p_org_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score INTEGER := 0;
  v_account RECORD;
  v_recent_funding BOOLEAN := FALSE;
  v_tech_signals INTEGER := 0;
  v_enrichment_age_days INTEGER;
BEGIN
  -- Get account data
  SELECT 
    last_funding_date,
    last_funding_round,
    tech_stack,
    enriched_at,
    total_raised_usd
  INTO v_account
  FROM accounts
  WHERE external_id = p_account_external_id 
    AND org_id = p_org_id;
  
  IF NOT FOUND THEN
    RETURN 50; -- Default for missing accounts
  END IF;
  
  -- 1. Funding Signals (30 points)
  IF v_account.last_funding_date IS NOT NULL THEN
    -- Recent funding (within 12 months) = high intent
    IF v_account.last_funding_date >= (now() - interval '12 months') THEN
      v_score := v_score + 30;
      v_recent_funding := TRUE;
    -- Funding within 24 months = medium intent
    ELSIF v_account.last_funding_date >= (now() - interval '24 months') THEN
      v_score := v_score + 20;
    -- Older funding = low intent
    ELSE
      v_score := v_score + 10;
    END IF;
  END IF;
  
  -- Bonus: High funding amount = buying mode
  IF v_account.total_raised_usd IS NOT NULL AND v_account.total_raised_usd > 10000000 THEN
    v_score := v_score + 10;
  END IF;
  
  -- 2. Technology Stack Signals (30 points)
  IF v_account.tech_stack IS NOT NULL THEN
    v_tech_signals := array_length(v_account.tech_stack, 1);
    IF v_tech_signals >= 10 THEN
      v_score := v_score + 30; -- Sophisticated tech stack = active buyer
    ELSIF v_tech_signals >= 5 THEN
      v_score := v_score + 20;
    ELSIF v_tech_signals >= 2 THEN
      v_score := v_score + 10;
    END IF;
  END IF;
  
  -- 3. Data Freshness (30 points)
  IF v_account.enriched_at IS NOT NULL THEN
    v_enrichment_age_days := EXTRACT(DAY FROM (now() - v_account.enriched_at));
    IF v_enrichment_age_days <= 30 THEN
      v_score := v_score + 30; -- Fresh data = active monitoring
    ELSIF v_enrichment_age_days <= 90 THEN
      v_score := v_score + 20;
    ELSIF v_enrichment_age_days <= 180 THEN
      v_score := v_score + 10;
    END IF;
  END IF;
  
  -- 4. Base Intent (10 points for having data)
  IF v_account.last_funding_date IS NOT NULL OR v_account.tech_stack IS NOT NULL THEN
    v_score := v_score + 10;
  END IF;
  
  -- Normalize to 0-100 scale
  v_score := LEAST(v_score, 100);
  v_score := GREATEST(v_score, 0);
  
  RETURN v_score;
END;
$$;

-- Function to calculate dynamic Reachability Score
-- Based on: contact count, email availability, phone availability
CREATE OR REPLACE FUNCTION public.calculate_reachability_score(
  p_account_external_id TEXT,
  p_org_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score INTEGER := 0;
  v_contact_count INTEGER;
  v_email_count INTEGER;
  v_phone_count INTEGER;
  v_mobile_count INTEGER;
  v_email_rate NUMERIC;
  v_phone_rate NUMERIC;
BEGIN
  -- Get contact metrics
  SELECT 
    COUNT(*) as total_contacts,
    COUNT(*) FILTER (WHERE email IS NOT NULL AND email LIKE '%@%') as emails,
    COUNT(*) FILTER (WHERE phone IS NOT NULL OR mobile IS NOT NULL) as phones,
    COUNT(*) FILTER (WHERE mobile IS NOT NULL) as mobiles
  INTO v_contact_count, v_email_count, v_phone_count, v_mobile_count
  FROM "Leads"
  WHERE account_external_id = p_account_external_id
    AND org_id = p_org_id;
  
  -- Default for accounts with no contacts
  IF v_contact_count = 0 THEN
    RETURN 30; -- Low reachability
  END IF;
  
  -- 1. Contact Volume (40 points)
  IF v_contact_count >= 10 THEN
    v_score := v_score + 40; -- Excellent contact coverage
  ELSIF v_contact_count >= 5 THEN
    v_score := v_score + 30;
  ELSIF v_contact_count >= 3 THEN
    v_score := v_score + 20;
  ELSIF v_contact_count >= 1 THEN
    v_score := v_score + 10;
  END IF;
  
  -- 2. Email Availability (30 points)
  v_email_rate := (v_email_count::NUMERIC / v_contact_count) * 100;
  IF v_email_rate >= 90 THEN
    v_score := v_score + 30; -- Excellent email coverage
  ELSIF v_email_rate >= 70 THEN
    v_score := v_score + 20;
  ELSIF v_email_rate >= 50 THEN
    v_score := v_score + 10;
  END IF;
  
  -- 3. Phone Availability (30 points)
  v_phone_rate := (v_phone_count::NUMERIC / v_contact_count) * 100;
  IF v_phone_rate >= 70 THEN
    v_score := v_score + 30; -- Excellent phone coverage
  ELSIF v_phone_rate >= 50 THEN
    v_score := v_score + 20;
  ELSIF v_phone_rate >= 30 THEN
    v_score := v_score + 10;
  END IF;
  
  -- Bonus: Mobile numbers (higher quality)
  IF v_mobile_count > 0 THEN
    v_score := v_score + 10;
  END IF;
  
  -- Normalize to 0-100 scale
  v_score := LEAST(v_score, 100);
  v_score := GREATEST(v_score, 0);
  
  RETURN v_score;
END;
$$;

-- Update the existing calculate_account_score to use dynamic scoring
CREATE OR REPLACE FUNCTION public.calculate_account_score(
  p_account_external_id TEXT,
  p_icp_id UUID,
  p_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Calculate Fit Score (same as before)
  IF account_rec.industry_norm = ANY(icp_rec.industries) THEN
    v_industry_score := 100;
    v_breakdown := v_breakdown || jsonb_build_object(
      'factor', 'industry',
      'score', 100,
      'match', true,
      'value', account_rec.industry_norm
    );
  END IF;

  IF account_rec.employee_count = ANY(icp_rec.company_sizes) THEN
    v_size_score := 100;
    v_breakdown := v_breakdown || jsonb_build_object(
      'factor', 'size',
      'score', 100,
      'match', true,
      'value', account_rec.employee_count
    );
  END IF;

  IF account_rec.revenue_range = ANY(icp_rec.revenue_ranges) THEN
    v_revenue_score := 100;
    v_breakdown := v_breakdown || jsonb_build_object(
      'factor', 'revenue',
      'score', 100,
      'match', true,
      'value', account_rec.revenue_range
    );
  END IF;

  IF account_rec.country = ANY(icp_rec.geographies) THEN
    v_geography_score := 100;
    v_breakdown := v_breakdown || jsonb_build_object(
      'factor', 'geography',
      'score', 100,
      'match', true,
      'value', account_rec.country
    );
  END IF;

  v_total_score := v_industry_score + v_size_score + v_revenue_score + v_geography_score;
  v_fit_score := ROUND((v_total_score::NUMERIC / v_max_score) * 100)::INTEGER;

  -- Calculate dynamic Intent Score (NEW!)
  v_intent_score := public.calculate_intent_score(p_account_external_id, p_org_id);
  
  -- Calculate dynamic Reachability Score (NEW!)
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
    'dynamic_v3.0',
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

COMMENT ON FUNCTION public.calculate_intent_score IS 'Calculates dynamic intent score based on funding signals, tech stack, and data freshness';
COMMENT ON FUNCTION public.calculate_reachability_score IS 'Calculates dynamic reachability score based on contact volume, email/phone availability';
COMMENT ON FUNCTION public.calculate_account_score IS 'Updated to use dynamic intent and reachability scoring (v3.0)';