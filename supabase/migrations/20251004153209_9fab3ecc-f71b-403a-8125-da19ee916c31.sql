-- Create function to count high fit leads
CREATE OR REPLACE FUNCTION public.count_high_fit_leads(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(DISTINCT l.id)::integer INTO v_count
  FROM "Leads" l
  INNER JOIN scores s ON l.account_external_id = s.account_external_id
  WHERE l.org_id = p_org_id
    AND s.org_id = p_org_id
    AND s.overall >= 70;
  
  RETURN COALESCE(v_count, 0);
END;
$function$;

-- Create function to count campaign ready accounts
CREATE OR REPLACE FUNCTION public.count_campaign_ready_accounts(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(DISTINCT a.external_id)::integer INTO v_count
  FROM accounts a
  INNER JOIN scores s ON a.external_id = s.account_external_id
  INNER JOIN contacts c ON a.external_id = c.account_external_id
  WHERE a.org_id = p_org_id
    AND s.org_id = p_org_id
    AND c.org_id = p_org_id
    AND s.overall >= 70;
  
  RETURN COALESCE(v_count, 0);
END;
$function$;

-- Create function to calculate data completeness
CREATE OR REPLACE FUNCTION public.calculate_data_completeness(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total integer;
  v_completeness numeric;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM accounts
  WHERE org_id = p_org_id;
  
  IF v_total = 0 THEN
    RETURN 0;
  END IF;
  
  SELECT ROUND(
    (
      COUNT(*) FILTER (WHERE industry_norm IS NOT NULL)::numeric / v_total * 25 +
      COUNT(*) FILTER (WHERE employee_count IS NOT NULL)::numeric / v_total * 25 +
      COUNT(*) FILTER (WHERE revenue_range IS NOT NULL)::numeric / v_total * 25 +
      COUNT(*) FILTER (WHERE country IS NOT NULL)::numeric / v_total * 25
    )
  )::integer INTO v_completeness
  FROM accounts
  WHERE org_id = p_org_id;
  
  RETURN COALESCE(v_completeness, 0);
END;
$function$;