
-- Campaign automation rules: configurable triggers that auto-create campaigns
CREATE TABLE public.campaign_automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) NOT NULL,
  name text NOT NULL,
  description text,
  signal_type text NOT NULL,
  fuel_line_type text NOT NULL,
  sequence_template text NOT NULL DEFAULT 'enterprise',
  min_signals integer NOT NULL DEFAULT 3,
  min_accounts integer NOT NULL DEFAULT 2,
  priority_filter text[] NOT NULL DEFAULT '{high,critical}',
  cooldown_hours integer NOT NULL DEFAULT 72,
  is_enabled boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  trigger_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org automation rules"
  ON public.campaign_automation_rules FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their org automation rules"
  ON public.campaign_automation_rules FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));

-- Log of auto-triggered campaigns
CREATE TABLE public.campaign_automation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) NOT NULL,
  rule_id uuid REFERENCES public.campaign_automation_rules(id) ON DELETE SET NULL,
  rule_name text NOT NULL,
  signal_type text NOT NULL,
  fuel_line_type text NOT NULL,
  signal_count integer NOT NULL DEFAULT 0,
  account_count integer NOT NULL DEFAULT 0,
  signal_ids text[] NOT NULL DEFAULT '{}',
  account_external_ids text[] NOT NULL DEFAULT '{}',
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  campaign_name text,
  status text NOT NULL DEFAULT 'created',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_automation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org automation log"
  ON public.campaign_automation_log FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Service can insert automation log"
  ON public.campaign_automation_log FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid()));
