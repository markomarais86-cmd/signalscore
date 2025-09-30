-- Create table for Zapier webhook configurations
CREATE TABLE public.zapier_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'account_created', 'contact_created', 'lead_created', 'score_updated'
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.zapier_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view webhooks in their org"
ON public.zapier_webhooks
FOR SELECT
USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can insert webhooks"
ON public.zapier_webhooks
FOR INSERT
WITH CHECK (org_id = get_current_user_org_id() AND is_current_user_admin());

CREATE POLICY "Admins can update webhooks"
ON public.zapier_webhooks
FOR UPDATE
USING (org_id = get_current_user_org_id() AND is_current_user_admin());

CREATE POLICY "Admins can delete webhooks"
ON public.zapier_webhooks
FOR DELETE
USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Create index for faster lookups
CREATE INDEX idx_zapier_webhooks_org_event ON public.zapier_webhooks(org_id, event_type, is_active);