
-- Fix SECURITY DEFINER functions missing SET search_path

CREATE OR REPLACE FUNCTION public.check_materialized_view_exists(view_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM pg_matviews 
    WHERE matviewname = view_name 
    AND schemaname = 'public'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_enrichment_credits(p_org_id uuid, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE organizations
  SET enrichment_credits_used = COALESCE(enrichment_credits_used, 0) + p_amount
  WHERE id = p_org_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_dashboard_metrics(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RAISE NOTICE 'Dashboard metrics refresh requested for org %', p_org_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_materialized_view_concurrently(view_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = view_name AND schemaname = 'public') THEN
    RAISE EXCEPTION 'Materialized view % does not exist', view_name;
  END IF;
  
  BEGIN
    EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY public.%I', view_name);
  EXCEPTION WHEN OTHERS THEN
    EXECUTE format('REFRESH MATERIALIZED VIEW public.%I', view_name);
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_plan_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_credit_limit INTEGER;
BEGIN
  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id AND NEW.plan_id IS NOT NULL THEN
    SELECT enrichment_credits_monthly INTO new_credit_limit
    FROM plan_limits WHERE id = NEW.plan_id;
    
    NEW.enrichment_credits_total := COALESCE(new_credit_limit, NEW.enrichment_credits_total);
    
    INSERT INTO credit_adjustments (
      org_id, adjustment_type, previous_total, new_total, 
      previous_used, new_used, previous_bonus, new_bonus,
      reason, performed_by
    ) VALUES (
      NEW.id, 'plan_change', OLD.enrichment_credits_total, NEW.enrichment_credits_total,
      OLD.enrichment_credits_used, NEW.enrichment_credits_used,
      OLD.enrichment_credits_bonus, NEW.enrichment_credits_bonus,
      'Plan changed to ' || NEW.plan_id, 'system'
    );
  END IF;
  RETURN NEW;
END;
$function$;
