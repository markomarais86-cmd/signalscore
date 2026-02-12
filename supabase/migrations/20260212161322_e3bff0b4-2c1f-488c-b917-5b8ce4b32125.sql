
-- Lead Routing Rules table
CREATE TABLE public.lead_routing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  conditions JSONB NOT NULL DEFAULT '{}',
  assigned_to UUID,
  sla_minutes INTEGER NOT NULL DEFAULT 60,
  auto_tasks JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org routing rules"
  ON public.lead_routing_rules FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert routing rules for their org"
  ON public.lead_routing_rules FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their org routing rules"
  ON public.lead_routing_rules FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their org routing rules"
  ON public.lead_routing_rules FOR DELETE
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_routing_rules_org_priority ON public.lead_routing_rules (org_id, priority);

-- Lead Tasks table
CREATE TABLE public.lead_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  lead_id TEXT NOT NULL,
  lead_type TEXT NOT NULL DEFAULT 'marketing_lead',
  assigned_to UUID,
  task_type TEXT NOT NULL DEFAULT 'call',
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  routing_rule_id UUID REFERENCES public.lead_routing_rules(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org tasks"
  ON public.lead_tasks FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert tasks for their org"
  ON public.lead_tasks FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their org tasks"
  ON public.lead_tasks FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their org tasks"
  ON public.lead_tasks FOR DELETE
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_lead_tasks_org_status ON public.lead_tasks (org_id, status);
CREATE INDEX idx_lead_tasks_assigned ON public.lead_tasks (assigned_to, status);
CREATE INDEX idx_lead_tasks_due ON public.lead_tasks (due_at) WHERE status = 'pending';

-- Add routing columns to marketing_leads
ALTER TABLE public.marketing_leads
  ADD COLUMN IF NOT EXISTS assigned_to UUID,
  ADD COLUMN IF NOT EXISTS routed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS routing_rule_id UUID REFERENCES public.lead_routing_rules(id),
  ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_breached BOOLEAN DEFAULT false;

-- Updated_at trigger for routing rules
CREATE TRIGGER update_lead_routing_rules_updated_at
  BEFORE UPDATE ON public.lead_routing_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
