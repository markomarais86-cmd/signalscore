-- Trigger function to auto-score newly created accounts
CREATE OR REPLACE FUNCTION public.trigger_auto_score_new_account()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Call the auto_score_account function for the new account
  PERFORM public.auto_score_account(NEW.external_id, NEW.org_id);
  RETURN NEW;
END;
$$;

-- Attach trigger to accounts table
CREATE TRIGGER auto_score_on_account_insert
AFTER INSERT ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.trigger_auto_score_new_account();

-- Trigger to log when ICP changes (for potential re-scoring)
CREATE OR REPLACE FUNCTION public.trigger_rescore_on_icp_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only trigger if ICP is active
  IF NEW.status = 'active' THEN
    -- Log the re-scoring request
    INSERT INTO public.audit_logs (org_id, actor, action, meta)
    VALUES (
      NEW.org_id,
      'system',
      'icp_changed_trigger_rescore',
      jsonb_build_object(
        'icp_id', NEW.id,
        'icp_name', NEW.name
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to icp_profiles table
CREATE TRIGGER rescore_on_icp_update
AFTER INSERT OR UPDATE ON public.icp_profiles
FOR EACH ROW
WHEN (NEW.status = 'active')
EXECUTE FUNCTION public.trigger_rescore_on_icp_change();

-- Trigger to re-score account when firmographic data is enriched
CREATE OR REPLACE FUNCTION public.trigger_rescore_on_enrichment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only re-score if key firmographic fields changed
  IF (NEW.industry_norm IS DISTINCT FROM OLD.industry_norm) OR
     (NEW.employee_count IS DISTINCT FROM OLD.employee_count) OR
     (NEW.revenue_range IS DISTINCT FROM OLD.revenue_range) OR
     (NEW.country IS DISTINCT FROM OLD.country) THEN
    
    PERFORM public.auto_score_account(NEW.external_id, NEW.org_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to accounts table for updates
CREATE TRIGGER auto_rescore_on_account_update
AFTER UPDATE ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.trigger_rescore_on_enrichment();