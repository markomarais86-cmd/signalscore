-- Create RPC to get accurate enrichment page stats
CREATE OR REPLACE FUNCTION public.get_enrichment_page_stats(p_org_id uuid)
RETURNS TABLE (
  total_accounts bigint,
  total_leads bigint,
  enriched_accounts bigint,
  enriched_leads bigint,
  accounts_with_contacts bigint,
  data_completeness_pct numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_accounts bigint;
  v_enriched_accounts bigint;
  v_accounts_with_key_fields bigint;
BEGIN
  -- Count total accounts
  SELECT COUNT(*) INTO v_total_accounts
  FROM accounts
  WHERE org_id = p_org_id;

  -- Count enriched accounts (has enriched_at)
  SELECT COUNT(*) INTO v_enriched_accounts
  FROM accounts
  WHERE org_id = p_org_id AND enriched_at IS NOT NULL;

  -- Count accounts with key fields for data completeness
  SELECT COUNT(*) INTO v_accounts_with_key_fields
  FROM accounts
  WHERE org_id = p_org_id 
    AND (employee_count IS NOT NULL OR revenue_range IS NOT NULL OR industry_norm IS NOT NULL);

  RETURN QUERY
  SELECT 
    v_total_accounts as total_accounts,
    (SELECT COUNT(*) FROM "Leads" WHERE org_id = p_org_id) as total_leads,
    v_enriched_accounts as enriched_accounts,
    (SELECT COUNT(*) FROM "Leads" WHERE org_id = p_org_id AND enriched_at IS NOT NULL) as enriched_leads,
    (SELECT COUNT(DISTINCT a.id) 
     FROM accounts a
     INNER JOIN "Leads" l ON l.account_external_id = a.external_id AND l.org_id = a.org_id
     WHERE a.org_id = p_org_id) as accounts_with_contacts,
    CASE 
      WHEN v_total_accounts = 0 THEN 0
      ELSE ROUND((v_accounts_with_key_fields::numeric / v_total_accounts::numeric) * 100, 1)
    END as data_completeness_pct;
END;
$$;