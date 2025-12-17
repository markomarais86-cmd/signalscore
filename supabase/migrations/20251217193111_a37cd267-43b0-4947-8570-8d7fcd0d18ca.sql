-- Phase 1: Pipeline Analytics Foundation
-- Create deals, deal_stage_history, and activities tables

-- Deals table (core pipeline data)
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_external_id TEXT,
  external_id TEXT, -- CRM deal ID (Salesforce, HubSpot)
  name TEXT NOT NULL,
  amount NUMERIC(15,2),
  stage TEXT NOT NULL,
  expected_close_date DATE,
  closed_date DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  loss_reason TEXT,
  owner_id TEXT,
  owner_name TEXT,
  probability INTEGER CHECK (probability >= 0 AND probability <= 100),
  deal_type TEXT,
  source TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT deals_org_external_unique UNIQUE (org_id, external_id)
);

-- Deal stage history (for accurate stage duration tracking)
CREATE TABLE public.deal_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  exited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activities table (calls, emails, meetings, tasks)
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  account_external_id TEXT,
  lead_id BIGINT REFERENCES public."Leads"(id) ON DELETE SET NULL,
  external_id TEXT, -- CRM activity ID
  activity_type TEXT NOT NULL CHECK (activity_type IN ('call', 'email', 'meeting', 'task', 'note', 'other')),
  subject TEXT,
  description TEXT,
  outcome TEXT,
  duration_minutes INTEGER,
  owner_id TEXT,
  owner_name TEXT,
  activity_date TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT activities_org_external_unique UNIQUE (org_id, external_id)
);

-- Create indexes for performance
CREATE INDEX idx_deals_org_id ON public.deals(org_id);
CREATE INDEX idx_deals_status ON public.deals(org_id, status);
CREATE INDEX idx_deals_stage ON public.deals(org_id, stage);
CREATE INDEX idx_deals_account ON public.deals(org_id, account_external_id);
CREATE INDEX idx_deals_expected_close ON public.deals(org_id, expected_close_date);
CREATE INDEX idx_deals_closed_date ON public.deals(org_id, closed_date);

CREATE INDEX idx_deal_stage_history_deal ON public.deal_stage_history(deal_id);
CREATE INDEX idx_deal_stage_history_org ON public.deal_stage_history(org_id);
CREATE INDEX idx_deal_stage_history_stage ON public.deal_stage_history(org_id, stage);

CREATE INDEX idx_activities_org ON public.activities(org_id);
CREATE INDEX idx_activities_deal ON public.activities(deal_id);
CREATE INDEX idx_activities_account ON public.activities(org_id, account_external_id);
CREATE INDEX idx_activities_type ON public.activities(org_id, activity_type);
CREATE INDEX idx_activities_date ON public.activities(org_id, activity_date);

-- Enable RLS
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- RLS policies for deals
CREATE POLICY "Users can view deals in their org" ON public.deals
  FOR SELECT USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can insert deals in their org" ON public.deals
  FOR INSERT WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Users can update deals in their org" ON public.deals
  FOR UPDATE USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete deals" ON public.deals
  FOR DELETE USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- RLS policies for deal_stage_history
CREATE POLICY "Users can view deal history in their org" ON public.deal_stage_history
  FOR SELECT USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can insert deal history in their org" ON public.deal_stage_history
  FOR INSERT WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "System can update deal history" ON public.deal_stage_history
  FOR UPDATE USING (true);

-- RLS policies for activities
CREATE POLICY "Users can view activities in their org" ON public.activities
  FOR SELECT USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can insert activities in their org" ON public.activities
  FOR INSERT WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Users can update activities in their org" ON public.activities
  FOR UPDATE USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete activities" ON public.activities
  FOR DELETE USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Trigger to update deals.updated_at
CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to record stage history on deal stage change
CREATE OR REPLACE FUNCTION public.record_deal_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Close the previous stage history entry
  UPDATE public.deal_stage_history
  SET exited_at = now()
  WHERE deal_id = NEW.id
    AND exited_at IS NULL
    AND stage != NEW.stage;

  -- Only create new entry if stage actually changed
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO public.deal_stage_history (deal_id, org_id, stage, entered_at)
    VALUES (NEW.id, NEW.org_id, NEW.stage, now());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER deal_stage_change_trigger
  AFTER UPDATE OF stage ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.record_deal_stage_change();

-- Trigger to create initial stage history on deal insert
CREATE OR REPLACE FUNCTION public.create_initial_deal_stage()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.deal_stage_history (deal_id, org_id, stage, entered_at)
  VALUES (NEW.id, NEW.org_id, NEW.stage, NEW.created_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER deal_initial_stage_trigger
  AFTER INSERT ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.create_initial_deal_stage();

-- Function to compute deal stage duration
CREATE OR REPLACE FUNCTION public.get_deal_stage_duration_hours(p_deal_id UUID, p_stage TEXT)
RETURNS NUMERIC AS $$
DECLARE
  v_duration NUMERIC;
BEGIN
  SELECT EXTRACT(EPOCH FROM (COALESCE(exited_at, now()) - entered_at)) / 3600
  INTO v_duration
  FROM public.deal_stage_history
  WHERE deal_id = p_deal_id AND stage = p_stage
  ORDER BY entered_at DESC
  LIMIT 1;
  
  RETURN COALESCE(v_duration, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;