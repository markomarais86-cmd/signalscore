-- Create function to trigger Zapier webhooks
CREATE OR REPLACE FUNCTION public.trigger_zapier_webhook(
  event_type_param text,
  org_id_param uuid,
  data_param jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call the zapier-sync edge function using pg_net
  PERFORM net.http_post(
    url := CONCAT(current_setting('app.settings.supabase_url'), '/functions/v1/zapier-sync'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', CONCAT('Bearer ', current_setting('app.settings.supabase_anon_key'))
    ),
    body := jsonb_build_object(
      'event_type', event_type_param,
      'org_id', org_id_param,
      'data', data_param
    )
  );
END;
$$;

-- Trigger function for accounts
CREATE OR REPLACE FUNCTION public.notify_zapier_account_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM trigger_zapier_webhook(
    'account_created',
    NEW.org_id,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

-- Trigger function for contacts
CREATE OR REPLACE FUNCTION public.notify_zapier_contact_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM trigger_zapier_webhook(
    'contact_created',
    NEW.org_id,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

-- Trigger function for leads
CREATE OR REPLACE FUNCTION public.notify_zapier_lead_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM trigger_zapier_webhook(
    'lead_created',
    NEW.org_id,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

-- Trigger function for scores
CREATE OR REPLACE FUNCTION public.notify_zapier_score_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM trigger_zapier_webhook(
    'score_updated',
    NEW.org_id,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

-- Create triggers for accounts table
DROP TRIGGER IF EXISTS zapier_account_insert ON public.accounts;
CREATE TRIGGER zapier_account_insert
  AFTER INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_zapier_account_change();

DROP TRIGGER IF EXISTS zapier_account_update ON public.accounts;
CREATE TRIGGER zapier_account_update
  AFTER UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_zapier_account_change();

-- Create triggers for contacts table
DROP TRIGGER IF EXISTS zapier_contact_insert ON public.contacts;
CREATE TRIGGER zapier_contact_insert
  AFTER INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_zapier_contact_change();

DROP TRIGGER IF EXISTS zapier_contact_update ON public.contacts;
CREATE TRIGGER zapier_contact_update
  AFTER UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_zapier_contact_change();

-- Create triggers for Leads table
DROP TRIGGER IF EXISTS zapier_lead_insert ON public."Leads";
CREATE TRIGGER zapier_lead_insert
  AFTER INSERT ON public."Leads"
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_zapier_lead_change();

DROP TRIGGER IF EXISTS zapier_lead_update ON public."Leads";
CREATE TRIGGER zapier_lead_update
  AFTER UPDATE ON public."Leads"
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_zapier_lead_change();

-- Create triggers for scores table
DROP TRIGGER IF EXISTS zapier_score_insert ON public.scores;
CREATE TRIGGER zapier_score_insert
  AFTER INSERT ON public.scores
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_zapier_score_change();

DROP TRIGGER IF EXISTS zapier_score_update ON public.scores;
CREATE TRIGGER zapier_score_update
  AFTER UPDATE ON public.scores
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_zapier_score_change();