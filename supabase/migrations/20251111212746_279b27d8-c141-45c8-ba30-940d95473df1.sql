-- Fix SQL bulk scoring with read-only function and proper error handling

-- Step 1: Create read-only version of calculate_account_score (no inserts)
CREATE OR REPLACE FUNCTION public.calculate_account_score_readonly(
  account_external_id text, 
  icp_id uuid, 
  org_id_param uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  account_rec RECORD;
  icp_rec RECORD;
  industry_score integer := 0;
  size_score integer := 0;
  geo_score integer := 0;
  revenue_score integer := 0;
  total_score integer := 0;
  fit_score integer := 0;
  matches integer := 0;
BEGIN
  -- Get account data
  SELECT * INTO account_rec 
  FROM public.accounts 
  WHERE external_id = account_external_id AND org_id = org_id_param;
  
  -- Get ICP data  
  SELECT * INTO icp_rec 
  FROM public.icp_profiles 
  WHERE id = icp_id AND org_id = org_id_param;
  
  -- Return 0 scores if no data found
  IF account_rec IS NULL OR icp_rec IS NULL THEN
    RETURN jsonb_build_object(
      'overall', 0,
      'fit', 0,
      'intent', 0,
      'reachability', 0,
      'breakdown', jsonb_build_object(
        'industry_score', 0,
        'size_score', 0,
        'geo_score', 0,
        'revenue_score', 0
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
  
  -- Calculate totals
  total_score := industry_score + size_score + geo_score + revenue_score;
  
  -- Boost if multiple criteria match
  IF matches >= 3 THEN
    total_score := LEAST(100, total_score + 10);
  END IF;
  
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
      'matches', matches
    )
  );
END;
$$;

-- Step 2: Fix bulk_score_all_accounts to use read-only function
CREATE OR REPLACE FUNCTION public.bulk_score_all_accounts(
  p_org_id UUID,
  p_icp_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job_id UUID;
  v_total_accounts INTEGER;
  v_processed INTEGER := 0;
  v_icp_ids UUID[];
  v_start_time TIMESTAMP;
  v_end_time TIMESTAMP;
BEGIN
  v_start_time := clock_timestamp();
  
  -- Get ICP IDs
  IF p_icp_id IS NOT NULL THEN
    v_icp_ids := ARRAY[p_icp_id];
  ELSE
    SELECT ARRAY_AGG(id) INTO v_icp_ids
    FROM icp_profiles
    WHERE org_id = p_org_id AND status = 'active';
  END IF;
  
  -- Count accounts
  SELECT COUNT(*) INTO v_total_accounts
  FROM accounts
  WHERE org_id = p_org_id;
  
  -- Create job record
  INSERT INTO bulk_scoring_jobs (
    org_id, icp_id, total_accounts, total_chunks,
    chunk_size, status, started_at
  ) VALUES (
    p_org_id, p_icp_id, v_total_accounts, 1,
    v_total_accounts, 'processing', v_start_time
  ) RETURNING id INTO v_job_id;
  
  -- Score all accounts using read-only function + single INSERT
  WITH scored_accounts AS (
    SELECT 
      a.org_id,
      a.external_id as account_external_id,
      (
        SELECT calculate_account_score_readonly(a.external_id, icp_id, p_org_id)
        FROM UNNEST(v_icp_ids) AS icp_id
        ORDER BY (calculate_account_score_readonly(a.external_id, icp_id, p_org_id)->>'overall')::INTEGER DESC
        LIMIT 1
      ) as best_score
    FROM accounts a
    WHERE a.org_id = p_org_id
  )
  INSERT INTO scores (
    org_id,
    account_external_id,
    overall,
    fit,
    intent,
    reachability,
    reasons,
    scoring_version,
    computed_at
  )
  SELECT 
    org_id,
    account_external_id,
    COALESCE((best_score->>'overall')::INTEGER, 0),
    COALESCE((best_score->>'fit')::INTEGER, 0),
    50,
    70,
    COALESCE(best_score->'breakdown', '{}'::jsonb),
    'sql_bulk_v1.1',
    NOW()
  FROM scored_accounts
  ON CONFLICT (org_id, account_external_id) 
  DO UPDATE SET
    overall = EXCLUDED.overall,
    fit = EXCLUDED.fit,
    intent = EXCLUDED.intent,
    reachability = EXCLUDED.reachability,
    reasons = EXCLUDED.reasons,
    scoring_version = EXCLUDED.scoring_version,
    computed_at = EXCLUDED.computed_at;
  
  GET DIAGNOSTICS v_processed = ROW_COUNT;
  v_end_time := clock_timestamp();
  
  -- Mark job complete
  UPDATE bulk_scoring_jobs
  SET 
    processed_accounts = v_processed,
    successful_scores = v_processed,
    status = 'completed',
    completed_at = v_end_time,
    current_chunk = 1
  WHERE id = v_job_id;
  
  -- Audit log
  INSERT INTO audit_logs (org_id, actor, action, meta)
  VALUES (
    p_org_id, 'system', 'bulk_score_sql_completed',
    jsonb_build_object(
      'job_id', v_job_id,
      'total_accounts', v_total_accounts,
      'processed', v_processed,
      'duration_ms', EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_job_id,
    'processed', v_processed,
    'total_accounts', v_total_accounts,
    'duration_seconds', EXTRACT(EPOCH FROM (v_end_time - v_start_time))
  );
END;
$$;

-- Step 3: Clean up stuck jobs
UPDATE bulk_scoring_jobs
SET 
  status = 'failed',
  completed_at = NOW(),
  error_message = 'Stuck job cleaned up during SQL fix deployment'
WHERE status = 'processing'
  AND processed_accounts < total_accounts
  AND started_at < NOW() - INTERVAL '10 minutes';