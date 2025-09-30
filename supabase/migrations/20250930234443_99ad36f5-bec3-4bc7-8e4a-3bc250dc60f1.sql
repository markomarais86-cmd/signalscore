-- Drop Zapier webhook triggers that are blocking uploads
DROP TRIGGER IF EXISTS notify_zapier_on_account_insert ON public.accounts;
DROP TRIGGER IF EXISTS notify_zapier_on_contact_insert ON public.contacts;
DROP TRIGGER IF EXISTS notify_zapier_on_lead_insert ON public."Leads";
DROP TRIGGER IF EXISTS notify_zapier_on_score_update ON public.scores;