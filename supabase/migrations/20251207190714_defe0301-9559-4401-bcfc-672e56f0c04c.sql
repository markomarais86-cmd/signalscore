-- Phase 4: Sync enrichment_field_scores from enrichment_rows to source tables
-- This updates the sync trigger to also copy field_scores

-- Update the sync trigger to include field_scores
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

-- Create function to backfill field_scores from enrichment_rows to accounts/leads
CREATE OR REPLACE FUNCTION public.backfill_enrichment_field_scores(p_org_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_accounts_updated integer := 0;
  v_leads_updated integer := 0;
BEGIN
  -- Update accounts from enrichment_rows
  WITH row_data AS (
    SELECT DISTINCT ON (record_id)
      record_id,
      org_id,
      field_scores,
      overall_score,
      icp_pass,
      icp_fail_reasons,
      confidence
    FROM enrichment_rows
    WHERE record_type = 'account'
      AND status = 'completed'
      AND field_scores IS NOT NULL
      AND (p_org_id IS NULL OR org_id = p_org_id)
    ORDER BY record_id, updated_at DESC
  ),
  updated AS (
    UPDATE accounts a
    SET 
      enrichment_field_scores = rd.field_scores,
      enrichment_overall_score = COALESCE(a.enrichment_overall_score, rd.overall_score),
      icp_qualified = COALESCE(a.icp_qualified, rd.icp_pass),
      icp_fail_reasons = COALESCE(a.icp_fail_reasons, rd.icp_fail_reasons),
      enrichment_confidence = CASE 
        WHEN rd.confidence = 'high' THEN 0.9
        WHEN rd.confidence = 'medium' THEN 0.7
        ELSE 0.5
      END,
      updated_at = NOW()
    FROM row_data rd
    WHERE a.external_id = rd.record_id
      AND a.org_id = rd.org_id
      AND a.enrichment_field_scores IS NULL
    RETURNING a.id
  )
  SELECT COUNT(*) INTO v_accounts_updated FROM updated;

  -- Update leads from enrichment_rows
  WITH row_data AS (
    SELECT DISTINCT ON (record_id)
      record_id::integer as lead_id,
      org_id,
      field_scores,
      overall_score,
      icp_pass,
      icp_fail_reasons,
      confidence
    FROM enrichment_rows
    WHERE record_type = 'lead'
      AND status = 'completed'
      AND field_scores IS NOT NULL
      AND (p_org_id IS NULL OR org_id = p_org_id)
    ORDER BY record_id, updated_at DESC
  ),
  updated AS (
    UPDATE "Leads" l
    SET 
      enrichment_field_scores = rd.field_scores,
      enrichment_overall_score = COALESCE(l.enrichment_overall_score, rd.overall_score),
      icp_qualified = COALESCE(l.icp_qualified, rd.icp_pass),
      icp_fail_reasons = COALESCE(l.icp_fail_reasons, rd.icp_fail_reasons),
      updated_at = NOW()
    FROM row_data rd
    WHERE l.id = rd.lead_id
      AND l.org_id = rd.org_id
      AND l.enrichment_field_scores IS NULL
    RETURNING l.id
  )
  SELECT COUNT(*) INTO v_leads_updated FROM updated;

  RETURN jsonb_build_object(
    'success', true,
    'accounts_updated', v_accounts_updated,
    'leads_updated', v_leads_updated
  );
END;
$$;

-- Run the backfill for all existing data
SELECT public.backfill_enrichment_field_scores(NULL);

-- Create index for faster enrichment_source queries  
CREATE INDEX IF NOT EXISTS idx_leads_enrichment_source ON "Leads"(org_id, enrichment_source) WHERE enrichment_source IS NOT NULL;

-- Create index for discovered contacts
CREATE INDEX IF NOT EXISTS idx_leads_discovered_from ON "Leads"(org_id, discovered_from_account) WHERE discovered_from_account IS NOT NULL;