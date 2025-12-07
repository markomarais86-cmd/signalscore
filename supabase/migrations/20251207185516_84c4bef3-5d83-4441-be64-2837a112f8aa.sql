-- Phase 2: Sync account scores from scores table to accounts table
-- This creates a function to copy scores.overall → accounts.enrichment_overall_score
-- and scores.fit → accounts.icp_qualified

-- Create function to sync scores to accounts
CREATE OR REPLACE FUNCTION public.sync_account_scores_from_scores_table(p_org_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated_count integer := 0;
  v_processed_orgs text[] := '{}';
BEGIN
  -- Update accounts with scores from scores table
  WITH score_data AS (
    SELECT 
      s.org_id,
      s.account_external_id,
      s.overall,
      s.fit,
      s.intent,
      s.reachability,
      s.computed_at
    FROM scores s
    WHERE (p_org_id IS NULL OR s.org_id = p_org_id)
  ),
  updated AS (
    UPDATE accounts a
    SET 
      enrichment_overall_score = sd.overall,
      icp_qualified = CASE WHEN sd.fit >= 70 THEN true ELSE false END,
      propensity_score = COALESCE(a.propensity_score, sd.intent), -- Fallback to intent if no propensity
      updated_at = NOW()
    FROM score_data sd
    WHERE a.external_id = sd.account_external_id
      AND a.org_id = sd.org_id
      AND (
        a.enrichment_overall_score IS DISTINCT FROM sd.overall
        OR a.icp_qualified IS DISTINCT FROM (sd.fit >= 70)
      )
    RETURNING a.external_id, a.org_id
  )
  SELECT COUNT(*), array_agg(DISTINCT u.org_id::text)
  INTO v_updated_count, v_processed_orgs
  FROM updated u;

  RETURN jsonb_build_object(
    'success', true,
    'accounts_updated', v_updated_count,
    'organizations_processed', v_processed_orgs
  );
END;
$$;

-- Create trigger to auto-sync when scores change
CREATE OR REPLACE FUNCTION public.sync_score_to_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When a score is inserted or updated, sync to the account
  UPDATE accounts
  SET 
    enrichment_overall_score = NEW.overall,
    icp_qualified = CASE WHEN NEW.fit >= 70 THEN true ELSE false END,
    updated_at = NOW()
  WHERE external_id = NEW.account_external_id
    AND org_id = NEW.org_id;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS sync_score_to_account_trigger ON scores;

-- Create trigger on scores table
CREATE TRIGGER sync_score_to_account_trigger
AFTER INSERT OR UPDATE ON scores
FOR EACH ROW
EXECUTE FUNCTION public.sync_score_to_account();

-- Run initial backfill for all existing scores
SELECT public.sync_account_scores_from_scores_table(NULL);

-- Add index for faster icp_qualified queries
CREATE INDEX IF NOT EXISTS idx_accounts_icp_qualified ON accounts(org_id, icp_qualified) WHERE icp_qualified = true;

-- Add index for enrichment_overall_score filtering
CREATE INDEX IF NOT EXISTS idx_accounts_enrichment_score ON accounts(org_id, enrichment_overall_score) WHERE enrichment_overall_score IS NOT NULL;