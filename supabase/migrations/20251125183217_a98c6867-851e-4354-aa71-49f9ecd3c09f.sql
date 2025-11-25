-- ============================================================================
-- ENTERPRISE SCALABILITY PART 2: Batch Processing Functions
-- ============================================================================

-- 1. Bulk Account Creation Function
CREATE OR REPLACE FUNCTION bulk_create_accounts(
  p_org_id UUID,
  p_accounts JSONB
) RETURNS TABLE(
  created_count INT,
  skipped_count INT,
  account_ids TEXT[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created INT := 0;
  v_skipped INT := 0;
  v_ids TEXT[] := ARRAY[]::TEXT[];
  v_account JSONB;
  v_normalized_domain TEXT;
  v_external_id TEXT;
BEGIN
  FOR v_account IN SELECT * FROM jsonb_array_elements(p_accounts)
  LOOP
    v_normalized_domain := normalize_domain_text(v_account->>'domain');
    v_external_id := v_account->>'external_id';
    
    IF EXISTS (
      SELECT 1 FROM accounts 
      WHERE org_id = p_org_id 
      AND domain = v_normalized_domain
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    
    INSERT INTO accounts (
      org_id, external_id, name, domain, industry_norm,
      employee_count, revenue_range, country, state_province,
      phone, mobile, data_source
    ) VALUES (
      p_org_id, v_external_id, v_account->>'name', v_normalized_domain,
      v_account->>'industry_norm', (v_account->>'employee_count')::INT,
      v_account->>'revenue_range', v_account->>'country',
      v_account->>'state_province', v_account->>'phone',
      v_account->>'mobile', COALESCE(v_account->>'data_source', 'crm')
    )
    ON CONFLICT (org_id, domain) DO NOTHING
    RETURNING external_id INTO v_external_id;
    
    IF v_external_id IS NOT NULL THEN
      v_created := v_created + 1;
      v_ids := array_append(v_ids, v_external_id);
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_created, v_skipped, v_ids;
END;
$$;

-- 2. Bulk Scoring Function
CREATE OR REPLACE FUNCTION bulk_score_accounts_batch(
  p_org_id UUID,
  p_account_ids TEXT[],
  p_icp_id UUID
) RETURNS TABLE(
  processed_count INT,
  success_count INT,
  failed_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processed INT := 0;
  v_success INT := 0;
  v_failed INT := 0;
  v_account_id TEXT;
BEGIN
  FOREACH v_account_id IN ARRAY p_account_ids
  LOOP
    BEGIN
      PERFORM calculate_account_score(p_org_id, v_account_id, p_icp_id);
      v_success := v_success + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      INSERT INTO failed_scores (org_id, account_external_id, error_message)
      VALUES (p_org_id, v_account_id, SQLERRM)
      ON CONFLICT DO NOTHING;
    END;
    v_processed := v_processed + 1;
  END LOOP;
  
  RETURN QUERY SELECT v_processed, v_success, v_failed;
END;
$$;

-- 3. Processing Lock Management
CREATE OR REPLACE FUNCTION acquire_processing_lock(
  p_org_id UUID,
  p_process_name TEXT,
  p_duration_minutes INT DEFAULT 60
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM processing_locks WHERE expires_at < now();
  
  INSERT INTO processing_locks (org_id, process_name, expires_at)
  VALUES (
    p_org_id,
    p_process_name,
    now() + (p_duration_minutes || ' minutes')::INTERVAL
  )
  ON CONFLICT (org_id, process_name) DO NOTHING;
  
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION release_processing_lock(
  p_org_id UUID,
  p_process_name TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM processing_locks
  WHERE org_id = p_org_id
  AND process_name = p_process_name;
  
  RETURN FOUND;
END;
$$;

-- 4. Data Quality Validation
CREATE OR REPLACE FUNCTION validate_data_quality(
  p_org_id UUID
) RETURNS TABLE(
  issue_type TEXT,
  issue_count INT,
  severity TEXT,
  details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'duplicate_domains'::TEXT,
    COUNT(*)::INT,
    'high'::TEXT,
    jsonb_agg(jsonb_build_object('domain', domain, 'count', cnt))
  FROM (
    SELECT domain, COUNT(*) as cnt
    FROM accounts
    WHERE org_id = p_org_id AND domain IS NOT NULL
    GROUP BY domain
    HAVING COUNT(*) > 1
  ) dups;
  
  RETURN QUERY
  SELECT
    'unlinked_leads'::TEXT,
    COUNT(*)::INT,
    'medium'::TEXT,
    jsonb_build_object('count', COUNT(*))
  FROM "Leads"
  WHERE org_id = p_org_id AND account_external_id IS NULL;
  
  RETURN QUERY
  SELECT
    'unscored_accounts'::TEXT,
    COUNT(*)::INT,
    'medium'::TEXT,
    jsonb_build_object('count', COUNT(*))
  FROM accounts a
  WHERE a.org_id = p_org_id
  AND NOT EXISTS (
    SELECT 1 FROM scores s 
    WHERE s.org_id = a.org_id 
    AND s.account_external_id = a.external_id
  );
END;
$$;

-- 5. Performance Monitoring View
CREATE OR REPLACE VIEW account_processing_stats AS
SELECT
  a.org_id,
  COUNT(*) as total_accounts,
  COUNT(*) FILTER (WHERE a.enriched_at IS NOT NULL) as enriched_accounts,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM scores s 
    WHERE s.account_external_id = a.external_id 
    AND s.org_id = a.org_id
  )) as scored_accounts,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM "Leads" l
    WHERE l.account_external_id = a.external_id
    AND l.org_id = a.org_id
  )) as accounts_with_leads,
  COUNT(*) FILTER (WHERE a.data_source = 'crm') as crm_accounts,
  COUNT(*) FILTER (WHERE a.data_source = 'database') as database_accounts,
  COUNT(*) FILTER (WHERE a.data_source = 'both') as both_sources
FROM accounts a
GROUP BY a.org_id;

COMMENT ON FUNCTION bulk_create_accounts IS 'ENTERPRISE: Creates 1000+ accounts in single transaction';
COMMENT ON FUNCTION bulk_score_accounts_batch IS 'ENTERPRISE: Batch scores multiple accounts';
COMMENT ON FUNCTION validate_data_quality IS 'Identifies duplicates, unlinked leads, and data quality issues';
COMMENT ON VIEW account_processing_stats IS 'Real-time overview of account processing status for monitoring';