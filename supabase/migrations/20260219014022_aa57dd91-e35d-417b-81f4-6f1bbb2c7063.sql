
CREATE OR REPLACE FUNCTION public.get_data_completeness(p_data_org_id uuid, p_child_org_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
DECLARE
  v_total bigint;
  v_industry bigint;
  v_employee bigint;
  v_revenue bigint;
  v_country bigint;
  v_domain bigint;
  v_completeness int;
BEGIN
  IF p_child_org_id IS NOT NULL AND p_child_org_id != p_data_org_id THEN
    -- Child org: sample up to 5000 scored accounts for speed
    WITH scored_accounts AS (
      SELECT a.industry_norm, a.employee_count, a.revenue_range, a.country, a.domain
      FROM scores s
      INNER JOIN accounts a ON a.external_id = s.account_external_id AND a.org_id = p_data_org_id
      WHERE s.org_id = p_child_org_id
      LIMIT 5000
    )
    SELECT 
      COUNT(*),
      COUNT(industry_norm),
      COUNT(employee_count),
      COUNT(revenue_range),
      COUNT(country),
      COUNT(domain)
    INTO v_total, v_industry, v_employee, v_revenue, v_country, v_domain
    FROM scored_accounts;
  ELSE
    -- Parent / standalone org: all accounts
    SELECT 
      COUNT(*),
      COUNT(industry_norm),
      COUNT(employee_count),
      COUNT(revenue_range),
      COUNT(country),
      COUNT(domain)
    INTO v_total, v_industry, v_employee, v_revenue, v_country, v_domain
    FROM accounts
    WHERE org_id = p_data_org_id;
  END IF;

  IF v_total = 0 THEN
    v_completeness := 0;
  ELSE
    v_completeness := ROUND(((v_industry + v_employee + v_revenue + v_country + v_domain)::numeric / (v_total * 5)) * 100);
  END IF;

  RETURN jsonb_build_object('completeness', v_completeness, 'total', v_total);
END;
$function$;
