-- Re-score all accounts using the new fuzzy matching algorithm
DO $$
DECLARE
  v_icp_id UUID;
  v_org_id UUID;
  v_account RECORD;
  v_result JSONB;
  v_scored INTEGER := 0;
BEGIN
  -- Get active ICP
  SELECT id, org_id INTO v_icp_id, v_org_id
  FROM public.icp_profiles
  WHERE status = 'active'
  LIMIT 1;
  
  IF v_icp_id IS NULL THEN
    RAISE NOTICE 'No active ICP found';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Rescoring accounts for org % with ICP %', v_org_id, v_icp_id;
  
  -- Score all accounts
  FOR v_account IN 
    SELECT external_id 
    FROM public.accounts 
    WHERE org_id = v_org_id
  LOOP
    v_result := public.calculate_account_score(v_account.external_id, v_icp_id, v_org_id);
    v_scored := v_scored + 1;
    
    IF v_scored % 1000 = 0 THEN
      RAISE NOTICE 'Scored % accounts...', v_scored;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Completed rescoring % accounts', v_scored;
END $$;