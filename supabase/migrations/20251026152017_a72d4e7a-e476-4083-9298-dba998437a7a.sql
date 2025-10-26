-- Fix auto-scoring trigger to remove updated_at reference
CREATE OR REPLACE FUNCTION public.trigger_auto_score_new_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Call the auto_score_account function for the new account
  PERFORM public.auto_score_account(NEW.external_id, NEW.org_id);
  RETURN NEW;
END;
$function$;