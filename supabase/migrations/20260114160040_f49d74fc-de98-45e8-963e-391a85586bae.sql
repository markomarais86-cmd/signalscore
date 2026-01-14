-- Fix sync_firmographics_to_accounts_batch to use correct column names (location_city for Leads)
CREATE OR REPLACE FUNCTION public.sync_firmographics_to_accounts_batch(p_org_id uuid, p_batch_size integer DEFAULT 500, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_updated_count INTEGER := 0;
  v_total_remaining INTEGER := 0;
BEGIN
  -- Update accounts with aggregated lead data in batches
  WITH lead_aggregates AS (
    SELECT DISTINCT ON (account_external_id)
      account_external_id,
      revenue_range,
      employee_count,
      industry,
      country,
      location_city as city,
      state_province
    FROM "Leads"
    WHERE org_id = p_org_id
      AND account_external_id IS NOT NULL
    ORDER BY account_external_id, updated_at DESC NULLS LAST
  ),
  batch_accounts AS (
    SELECT la.* 
    FROM lead_aggregates la
    INNER JOIN accounts a ON a.external_id = la.account_external_id AND a.org_id = p_org_id
    ORDER BY la.account_external_id
    LIMIT p_batch_size OFFSET p_offset
  ),
  updated AS (
    UPDATE accounts a
    SET 
      revenue_range = COALESCE(a.revenue_range, b.revenue_range),
      employee_count = COALESCE(a.employee_count, b.employee_count),
      industry_raw = COALESCE(a.industry_raw, b.industry),
      country = COALESCE(a.country, b.country),
      city = COALESCE(a.city, b.city),
      state_province = COALESCE(a.state_province, b.state_province),
      updated_at = NOW()
    FROM batch_accounts b
    WHERE a.external_id = b.account_external_id 
      AND a.org_id = p_org_id
      AND (
        (a.revenue_range IS NULL AND b.revenue_range IS NOT NULL) OR
        (a.employee_count IS NULL AND b.employee_count IS NOT NULL) OR
        (a.industry_raw IS NULL AND b.industry IS NOT NULL) OR
        (a.country IS NULL AND b.country IS NOT NULL) OR
        (a.city IS NULL AND b.city IS NOT NULL) OR
        (a.state_province IS NULL AND b.state_province IS NOT NULL)
      )
    RETURNING a.external_id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  -- Check if more records remain
  SELECT COUNT(*) INTO v_total_remaining 
  FROM (
    SELECT DISTINCT account_external_id 
    FROM "Leads" 
    WHERE org_id = p_org_id AND account_external_id IS NOT NULL
    OFFSET p_offset + p_batch_size
  ) remaining;

  RETURN jsonb_build_object(
    'updated', v_updated_count,
    'offset', p_offset,
    'batch_size', p_batch_size,
    'has_more', v_total_remaining > 0
  );
END;
$function$;