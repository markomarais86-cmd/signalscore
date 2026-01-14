-- Fix sync_firmographics_to_leads_batch to use correct column names
CREATE OR REPLACE FUNCTION public.sync_firmographics_to_leads_batch(p_org_id uuid, p_batch_size integer DEFAULT 1000, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_updated_count INTEGER := 0;
  v_total_remaining INTEGER := 0;
BEGIN
  -- Update leads with account data in batches
  WITH batch_leads AS (
    SELECT l.id as lead_id, a.revenue_range, a.employee_count, a.industry_raw, 
           a.country, COALESCE(a.city, a.hq_city) as city, a.state_province
    FROM "Leads" l
    INNER JOIN accounts a ON a.external_id = l.account_external_id AND a.org_id = p_org_id
    WHERE l.org_id = p_org_id
      AND l.account_external_id IS NOT NULL
    ORDER BY l.id
    LIMIT p_batch_size OFFSET p_offset
  ),
  updated AS (
    UPDATE "Leads" l
    SET 
      revenue_range = COALESCE(l.revenue_range, b.revenue_range),
      employee_count = COALESCE(l.employee_count, b.employee_count),
      industry = COALESCE(l.industry, b.industry_raw),
      country = COALESCE(l.country, b.country),
      location_city = COALESCE(l.location_city, b.city),
      state_province = COALESCE(l.state_province, b.state_province),
      updated_at = NOW()
    FROM batch_leads b
    WHERE l.id = b.lead_id
      AND (
        (l.revenue_range IS NULL AND b.revenue_range IS NOT NULL) OR
        (l.employee_count IS NULL AND b.employee_count IS NOT NULL) OR
        (l.industry IS NULL AND b.industry_raw IS NOT NULL) OR
        (l.country IS NULL AND b.country IS NOT NULL) OR
        (l.location_city IS NULL AND b.city IS NOT NULL) OR
        (l.state_province IS NULL AND b.state_province IS NOT NULL)
      )
    RETURNING l.id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  -- Check if more records remain
  SELECT COUNT(*) INTO v_total_remaining 
  FROM (
    SELECT l.id 
    FROM "Leads" l
    WHERE l.org_id = p_org_id AND l.account_external_id IS NOT NULL
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