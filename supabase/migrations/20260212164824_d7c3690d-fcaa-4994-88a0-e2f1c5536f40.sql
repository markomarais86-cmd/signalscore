
-- Funnel events table for health monitoring
CREATE TABLE IF NOT EXISTS public.funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id),
  event_type text NOT NULL, -- 'phone_verification', 'conversion_push', 'calendly_booking', 'webhook_failure', 'enrichment'
  event_status text NOT NULL DEFAULT 'success', -- 'success', 'failure', 'pending'
  event_source text, -- 'numverify', 'ga4', 'meta_capi', 'linkedin_capi', 'calendly'
  lead_id uuid,
  metadata jsonb DEFAULT '{}',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view funnel events"
  ON public.funnel_events FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE INDEX idx_funnel_events_org_type ON public.funnel_events(org_id, event_type, created_at DESC);
CREATE INDEX idx_funnel_events_status ON public.funnel_events(event_status, created_at DESC);

-- Add phone_verified column to marketing_leads if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketing_leads' AND column_name = 'phone') THEN
    ALTER TABLE public.marketing_leads ADD COLUMN phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketing_leads' AND column_name = 'phone_valid') THEN
    ALTER TABLE public.marketing_leads ADD COLUMN phone_valid boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketing_leads' AND column_name = 'phone_carrier') THEN
    ALTER TABLE public.marketing_leads ADD COLUMN phone_carrier text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketing_leads' AND column_name = 'phone_line_type') THEN
    ALTER TABLE public.marketing_leads ADD COLUMN phone_line_type text;
  END IF;
END $$;
