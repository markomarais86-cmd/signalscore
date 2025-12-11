-- Create campaigns table for storing campaign data
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  campaign_type TEXT NOT NULL DEFAULT 'outbound',
  status TEXT NOT NULL DEFAULT 'draft',
  account_ids TEXT[] DEFAULT '{}',
  contact_ids BIGINT[] DEFAULT '{}',
  total_accounts INTEGER DEFAULT 0,
  total_contacts INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add comments for documentation
COMMENT ON TABLE public.campaigns IS 'Stores campaign information created via AI Chat or UI';
COMMENT ON COLUMN public.campaigns.campaign_type IS 'Type of campaign: outbound, nurture, event';
COMMENT ON COLUMN public.campaigns.status IS 'Campaign status: draft, active, paused, completed';
COMMENT ON COLUMN public.campaigns.account_ids IS 'Array of account external_ids included in campaign';
COMMENT ON COLUMN public.campaigns.contact_ids IS 'Array of lead IDs included in campaign';

-- Enable Row Level Security
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for org-scoped access
CREATE POLICY "Users can view campaigns in their org"
ON public.campaigns
FOR SELECT
USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can insert campaigns in their org"
ON public.campaigns
FOR INSERT
WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Users can update campaigns in their org"
ON public.campaigns
FOR UPDATE
USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete campaigns in their org"
ON public.campaigns
FOR DELETE
USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Create indexes for performance
CREATE INDEX idx_campaigns_org_id ON public.campaigns(org_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaigns_created_at ON public.campaigns(created_at DESC);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();