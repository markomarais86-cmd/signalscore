-- Ultra-fast bulk scoring function that processes all accounts in SQL
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
  
  -- Get total account count
  SELECT COUNT(*) INTO v_total_accounts
  FROM accounts
  WHERE org_id = p_org_id;
  
  -- Get ICP IDs to score against
  IF p_icp_id IS NOT NULL THEN
    v_icp_ids := ARRAY[p_icp_id];
  ELSE
    SELECT ARRAY_AGG(id) INTO v_icp_ids
    FROM icp_profiles
    WHERE org_id = p_org_id AND status = 'active';
  END IF;
  
  -- Create job record
  INSERT INTO bulk_scoring_jobs (
    org_id,
    icp_id,
    total_accounts,
    total_chunks,
    chunk_size,
    status,
    started_at
  ) VALUES (
    p_org_id,
    p_icp_id,
    v_total_accounts,
    1,
    v_total_accounts,
    'processing',
    v_start_time
  ) RETURNING id INTO v_job_id;
  
  -- Score all accounts using set-based SQL (super fast!)
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
    a.org_id,
    a.external_id,
    COALESCE((score_result->>'overall')::INTEGER, 0) as overall,
    COALESCE((score_result->>'fit')::INTEGER, 0) as fit,
    50 as intent,
    70 as reachability,
    COALESCE(score_result->'breakdown', '{}'::jsonb) as reasons,
    'sql_bulk_v1.0' as scoring_version,
    NOW() as computed_at
  FROM accounts a
  CROSS JOIN LATERAL (
    SELECT calculate_account_score(a.external_id, icp.id, p_org_id) as score_result
    FROM UNNEST(v_icp_ids) AS icp(id)
    ORDER BY (calculate_account_score(a.external_id, icp.id, p_org_id)->>'overall')::INTEGER DESC
    LIMIT 1
  ) scores
  WHERE a.org_id = p_org_id
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
  
  -- Mark job as complete
  UPDATE bulk_scoring_jobs
  SET 
    processed_accounts = v_processed,
    successful_scores = v_processed,
    status = 'completed',
    completed_at = v_end_time,
    current_chunk = 1
  WHERE id = v_job_id;
  
  -- Log audit entry
  INSERT INTO audit_logs (org_id, actor, action, meta)
  VALUES (
    p_org_id,
    'system',
    'bulk_score_sql_completed',
    jsonb_build_object(
      'job_id', v_job_id,
      'total_accounts', v_total_accounts,
      'processed', v_processed,
      'duration_ms', EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000,
      'method', 'sql_bulk'
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_job_id,
    'total_accounts', v_total_accounts,
    'processed', v_processed,
    'duration_seconds', EXTRACT(EPOCH FROM (v_end_time - v_start_time)),
    'method', 'sql_bulk'
  );
END;
$$;