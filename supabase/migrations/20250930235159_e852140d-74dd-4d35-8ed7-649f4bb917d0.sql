-- Drop ALL Zapier-related triggers
DROP TRIGGER IF EXISTS zapier_account_insert ON public.accounts CASCADE;
DROP TRIGGER IF EXISTS zapier_account_update ON public.accounts CASCADE;
DROP TRIGGER IF EXISTS trigger_zapier_account_change ON public.accounts CASCADE;
DROP TRIGGER IF EXISTS notify_zapier_on_account_insert ON public.accounts CASCADE;

DROP TRIGGER IF EXISTS zapier_contact_insert ON public.contacts CASCADE;
DROP TRIGGER IF EXISTS zapier_contact_update ON public.contacts CASCADE;
DROP TRIGGER IF EXISTS trigger_zapier_contact_change ON public.contacts CASCADE;
DROP TRIGGER IF EXISTS notify_zapier_on_contact_insert ON public.contacts CASCADE;

DROP TRIGGER IF EXISTS zapier_lead_insert ON public."Leads" CASCADE;
DROP TRIGGER IF EXISTS zapier_lead_update ON public."Leads" CASCADE;
DROP TRIGGER IF EXISTS trigger_zapier_lead_change ON public."Leads" CASCADE;
DROP TRIGGER IF EXISTS notify_zapier_on_lead_insert ON public."Leads" CASCADE;

DROP TRIGGER IF EXISTS zapier_score_update ON public.scores CASCADE;
DROP TRIGGER IF EXISTS trigger_zapier_score_change ON public.scores CASCADE;
DROP TRIGGER IF EXISTS notify_zapier_on_score_update ON public.scores CASCADE;

-- Now drop the functions
DROP FUNCTION IF EXISTS public.notify_zapier_account_change() CASCADE;
DROP FUNCTION IF EXISTS public.notify_zapier_contact_change() CASCADE;
DROP FUNCTION IF EXISTS public.notify_zapier_lead_change() CASCADE;
DROP FUNCTION IF EXISTS public.notify_zapier_score_change() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_zapier_webhook(text, uuid, jsonb) CASCADE;