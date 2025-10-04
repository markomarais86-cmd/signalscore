-- Phase 2: Create merge function and clean up duplicates (Fixed)

-- Step 1: Create the merge function
CREATE OR REPLACE FUNCTION public.merge_duplicate_accounts(p_org_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_duplicates_found INTEGER := 0;
  v_accounts_merged INTEGER := 0;
  v_leads_updated INTEGER := 0;
  v_scores_updated INTEGER := 0;
  v_contacts_updated INTEGER := 0;
  duplicate_rec RECORD;
  primary_account_id TEXT;
  duplicate_ids TEXT[];
BEGIN
  -- Validate org_id
  IF p_org_id != get_current_user_org_id() THEN
    RAISE EXCEPTION 'Access denied: Invalid organization';
  END IF;

  -- Find all duplicate domains and merge them
  FOR duplicate_rec IN
    SELECT 
      normalize_domain_text(domain) as normalized_domain,
      array_agg(external_id ORDER BY id ASC) as account_ids,
      COUNT(*) as dup_count
    FROM public.accounts
    WHERE org_id = p_org_id 
      AND domain IS NOT NULL
      AND normalize_domain_text(domain) IS NOT NULL
    GROUP BY normalize_domain_text(domain)
    HAVING COUNT(*) > 1
  LOOP
    v_duplicates_found := v_duplicates_found + 1;
    
    -- Keep the first account as primary
    primary_account_id := duplicate_rec.account_ids[1];
    duplicate_ids := duplicate_rec.account_ids[2:array_length(duplicate_rec.account_ids, 1)];
    
    -- Update leads
    WITH updated AS (
      UPDATE public."Leads"
      SET account_external_id = primary_account_id
      WHERE org_id = p_org_id AND account_external_id = ANY(duplicate_ids)
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_leads_updated FROM updated;
    
    -- Update contacts
    WITH updated AS (
      UPDATE public.contacts
      SET account_external_id = primary_account_id
      WHERE org_id = p_org_id AND account_external_id = ANY(duplicate_ids)
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_contacts_updated FROM updated;
    
    -- Merge scores (keep highest)
    WITH best_score AS (
      SELECT *
      FROM public.scores
      WHERE org_id = p_org_id AND account_external_id = ANY(duplicate_rec.account_ids)
      ORDER BY overall DESC LIMIT 1
    )
    INSERT INTO public.scores (org_id, account_external_id, overall, fit, intent, reachability, reasons, scoring_version, computed_at)
    SELECT p_org_id, primary_account_id, overall, fit, intent, reachability, reasons, scoring_version, computed_at
    FROM best_score
    ON CONFLICT (org_id, account_external_id) 
    DO UPDATE SET
      overall = EXCLUDED.overall,
      fit = EXCLUDED.fit,
      intent = EXCLUDED.intent,
      reachability = EXCLUDED.reachability,
      reasons = EXCLUDED.reasons
    WHERE EXCLUDED.overall > scores.overall;
    
    -- Delete duplicate scores
    DELETE FROM public.scores
    WHERE org_id = p_org_id AND account_external_id = ANY(duplicate_ids);
    
    -- Delete duplicate accounts
    DELETE FROM public.accounts
    WHERE org_id = p_org_id AND external_id = ANY(duplicate_ids);
    
    v_accounts_merged := v_accounts_merged + array_length(duplicate_ids, 1);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'duplicate_groups_found', v_duplicates_found,
    'duplicate_accounts_merged', v_accounts_merged,
    'leads_updated', v_leads_updated,
    'contacts_updated', v_contacts_updated,
    'scores_updated', v_scores_updated
  );
END;
$function$;

-- Step 2: Run the merge for the org
DO $$
DECLARE
  result jsonb;
BEGIN
  SELECT public.merge_duplicate_accounts('726a0dc0-99c7-43c2-b20f-b849f2760c3f'::uuid) INTO result;
  RAISE NOTICE 'Merge completed: %', result;
END $$;

-- Step 3: Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_unique_domain_per_org
ON public.accounts (org_id, (normalize_domain_text(domain)))
WHERE domain IS NOT NULL AND normalize_domain_text(domain) IS NOT NULL;