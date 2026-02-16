
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
  v_account RECORD;
  v_recency_score INTEGER := 0;
  v_momentum_score INTEGER := 0;
  v_contact_score INTEGER := 0;
  v_funding_score INTEGER := 0;
  v_tech_score INTEGER := 0;
  v_total INTEGER := 0;
  v_latest_score_change TIMESTAMPTZ;
  v_score_delta NUMERIC;
  v_lead_count INTEGER;
  v_months_since_funding NUMERIC;
  v_tech_count INTEGER;
BEGIN
  -- Get the account record
  SELECT enriched_at, last_funding_date, total_raised_usd, tech_stack
  INTO v_account
  FROM accounts
  WHERE external_id = p_account_external_id
    AND org_id = p_org_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- ==========================================
  -- DIMENSION 1: Engagement Recency (25 pts)
  -- ==========================================
  -- Check score_history for most recent change
  SELECT MAX(changed_at) INTO v_latest_score_change
  FROM score_history
  WHERE account_external_id = p_account_external_id
    AND org_id = p_org_id;

  IF v_latest_score_change IS NOT NULL AND v_latest_score_change >= NOW() - INTERVAL '7 days' THEN
    v_recency_score := 25;
  ELSIF v_latest_score_change IS NOT NULL AND v_latest_score_change >= NOW() - INTERVAL '30 days' THEN
    v_recency_score := 18;
  ELSIF v_account.enriched_at IS NOT NULL AND v_account.enriched_at::timestamptz >= NOW() - INTERVAL '30 days' THEN
    v_recency_score := 12;
  ELSIF v_account.enriched_at IS NOT NULL AND v_account.enriched_at::timestamptz >= NOW() - INTERVAL '90 days' THEN
    v_recency_score := 6;
  END IF;

  -- ==========================================
  -- DIMENSION 2: Score Momentum (25 pts)
  -- ==========================================
  -- Calculate net score change over last 30 days from score_history
  SELECT COALESCE(SUM(
    COALESCE((new_score::jsonb->>'overall')::numeric, 0) - 
    COALESCE((old_score::jsonb->>'overall')::numeric, 0)
  ), NULL)
  INTO v_score_delta
  FROM score_history
  WHERE account_external_id = p_account_external_id
    AND org_id = p_org_id
    AND changed_at >= NOW() - INTERVAL '30 days';

  IF v_score_delta IS NULL THEN
    -- No score history at all -> neutral
    v_momentum_score := 8;
  ELSIF v_score_delta >= 15 THEN
    v_momentum_score := 25;
  ELSIF v_score_delta >= 5 THEN
    v_momentum_score := 18;
  ELSIF v_score_delta >= -5 THEN
    v_momentum_score := 10;
  ELSE
    -- Drop >= 5
    v_momentum_score := 5;
  END IF;

  -- ==========================================
  -- DIMENSION 3: Contact Density (20 pts)
  -- ==========================================
  SELECT COUNT(*) INTO v_lead_count
  FROM "Leads"
  WHERE account_external_id = p_account_external_id
    AND org_id = p_org_id;

  IF v_lead_count >= 5 THEN
    v_contact_score := 20;
  ELSIF v_lead_count >= 3 THEN
    v_contact_score := 15;
  ELSIF v_lead_count >= 2 THEN
    v_contact_score := 10;
  ELSIF v_lead_count >= 1 THEN
    v_contact_score := 5;
  END IF;

  -- ==========================================
  -- DIMENSION 4: Funding Signals (15 pts)
  -- ==========================================
  IF v_account.last_funding_date IS NOT NULL THEN
    v_months_since_funding := EXTRACT(EPOCH FROM (NOW() - v_account.last_funding_date::timestamptz)) / (60*60*24*30);
    
    IF v_months_since_funding <= 6 THEN
      v_funding_score := 15;
    ELSIF v_months_since_funding <= 12 THEN
      v_funding_score := 10;
    ELSIF v_months_since_funding <= 24 THEN
      v_funding_score := 5;
    END IF;
  ELSIF v_account.total_raised_usd IS NOT NULL AND v_account.total_raised_usd > 0 THEN
    -- Has funding amount but no date
    IF v_account.total_raised_usd >= 50000000 THEN
      v_funding_score := 8;
    ELSIF v_account.total_raised_usd >= 10000000 THEN
      v_funding_score := 5;
    ELSE
      v_funding_score := 3;
    END IF;
  END IF;

  -- ==========================================
  -- DIMENSION 5: Tech Stack Depth (15 pts)
  -- ==========================================
  v_tech_count := COALESCE(array_length(v_account.tech_stack, 1), 0);

  IF v_tech_count >= 10 THEN
    v_tech_score := 15;
  ELSIF v_tech_count >= 5 THEN
    v_tech_score := 10;
  ELSIF v_tech_count >= 1 THEN
    v_tech_score := 5;
  END IF;

  -- ==========================================
  -- TOTAL
  -- ==========================================
  v_total := v_recency_score + v_momentum_score + v_contact_score + v_funding_score + v_tech_score;

  -- Clamp to 0-100
  RETURN LEAST(100, GREATEST(0, v_total));
END;
$$;
