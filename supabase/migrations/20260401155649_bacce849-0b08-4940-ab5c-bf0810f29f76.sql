-- Create a table to track accounts needing rescoring
CREATE TABLE IF NOT EXISTS public.rescore_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_external_id text NOT NULL,
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  reason text NOT NULL DEFAULT 'field_update',
  changed_fields text[] DEFAULT '{}',
  queued_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE(account_external_id, org_id, processed_at)
);

ALTER TABLE public.rescore_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org rescore queue"
  ON public.rescore_queue FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));

-- Trigger function that queues accounts for rescoring when key fields change
CREATE OR REPLACE FUNCTION public.queue_rescore_on_account_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed text[] := '{}';
BEGIN
  IF OLD.industry_norm IS DISTINCT FROM NEW.industry_norm THEN
    changed := array_append(changed, 'industry_norm');
  END IF;
  IF OLD.employee_count IS DISTINCT FROM NEW.employee_count THEN
    changed := array_append(changed, 'employee_count');
  END IF;
  IF OLD.revenue_range IS DISTINCT FROM NEW.revenue_range THEN
    changed := array_append(changed, 'revenue_range');
  END IF;
  IF OLD.country IS DISTINCT FROM NEW.country THEN
    changed := array_append(changed, 'country');
  END IF;
  IF OLD.tech_stack IS DISTINCT FROM NEW.tech_stack THEN
    changed := array_append(changed, 'tech_stack');
  END IF;
  IF OLD.domain IS DISTINCT FROM NEW.domain THEN
    changed := array_append(changed, 'domain');
  END IF;
  IF OLD.icp_qualified IS DISTINCT FROM NEW.icp_qualified THEN
    changed := array_append(changed, 'icp_qualified');
  END IF;

  IF array_length(changed, 1) > 0 THEN
    INSERT INTO public.rescore_queue (account_external_id, org_id, reason, changed_fields)
    VALUES (NEW.external_id, NEW.org_id, 'field_update', changed)
    ON CONFLICT (account_external_id, org_id, processed_at) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_rescore_on_update ON public.accounts;
CREATE TRIGGER trg_queue_rescore_on_update
  AFTER UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_rescore_on_account_update();