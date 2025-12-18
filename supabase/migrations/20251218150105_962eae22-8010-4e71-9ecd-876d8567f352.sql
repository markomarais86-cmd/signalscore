-- ================================================
-- Phase 1: Conversation Intelligence Foundation
-- ================================================

-- Call recordings and transcriptions
CREATE TABLE public.call_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_external_id TEXT,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  lead_id INTEGER REFERENCES public."Leads"(id) ON DELETE SET NULL,
  recording_url TEXT,
  transcript TEXT,
  duration_seconds INTEGER,
  participants JSONB DEFAULT '[]'::jsonb,
  call_type TEXT CHECK (call_type IN ('discovery', 'demo', 'negotiation', 'follow_up', 'closing', 'support', 'other')),
  source TEXT CHECK (source IN ('zoom', 'gong', 'teams', 'google_meet', 'manual', 'other')),
  external_id TEXT,
  recorded_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Call insights extracted by AI
CREATE TABLE public.call_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES public.call_recordings(id) ON DELETE CASCADE,
  summary TEXT,
  key_topics JSONB DEFAULT '[]'::jsonb,
  objections JSONB DEFAULT '[]'::jsonb,
  action_items JSONB DEFAULT '[]'::jsonb,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  sentiment_score NUMERIC,
  buying_signals JSONB DEFAULT '[]'::jsonb,
  risk_indicators JSONB DEFAULT '[]'::jsonb,
  next_steps TEXT,
  competitor_mentions JSONB DEFAULT '[]'::jsonb,
  decision_makers_identified JSONB DEFAULT '[]'::jsonb,
  budget_discussed BOOLEAN DEFAULT false,
  timeline_discussed BOOLEAN DEFAULT false,
  confidence NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
  ai_model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email threads and analysis
CREATE TABLE public.email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_external_id TEXT,
  lead_id INTEGER REFERENCES public."Leads"(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  thread_id TEXT,
  subject TEXT,
  participants JSONB DEFAULT '[]'::jsonb,
  message_count INTEGER DEFAULT 0,
  first_message_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  last_sender TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  intent TEXT CHECK (intent IN ('buying', 'evaluating', 'objecting', 'closing', 'churning', 'support', 'other')),
  urgency TEXT CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  response_time_avg_hours NUMERIC,
  source TEXT CHECK (source IN ('gmail', 'outlook', 'salesforce', 'hubspot', 'manual', 'other')),
  external_id TEXT,
  labels JSONB DEFAULT '[]'::jsonb,
  summary TEXT,
  key_points JSONB DEFAULT '[]'::jsonb,
  action_required BOOLEAN DEFAULT false,
  action_required_by TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, thread_id)
);

-- ================================================
-- Phase 2: Next Best Action (NBA) Engine
-- ================================================

-- Action templates for common scenarios
CREATE TABLE public.action_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  action_type TEXT NOT NULL CHECK (action_type IN ('call', 'email', 'meeting', 'send_content', 'escalate', 'follow_up', 'demo', 'proposal', 'contract', 'other')),
  trigger_conditions JSONB DEFAULT '{}'::jsonb,
  content_template TEXT,
  subject_template TEXT,
  variables JSONB DEFAULT '[]'::jsonb,
  suggested_delay_hours INTEGER,
  priority_weight INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  success_rate NUMERIC,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Next best action recommendations
CREATE TABLE public.next_best_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_external_id TEXT,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  lead_id INTEGER REFERENCES public."Leads"(id) ON DELETE SET NULL,
  user_id UUID,
  template_id UUID REFERENCES public.action_templates(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('call', 'email', 'meeting', 'send_content', 'escalate', 'follow_up', 'demo', 'proposal', 'contract', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  reasoning TEXT,
  context_summary TEXT,
  suggested_content JSONB DEFAULT '{}'::jsonb,
  suggested_subject TEXT,
  suggested_talking_points JSONB DEFAULT '[]'::jsonb,
  related_call_id UUID REFERENCES public.call_recordings(id) ON DELETE SET NULL,
  related_email_id UUID REFERENCES public.email_threads(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'dismissed', 'expired')),
  dismissed_reason TEXT,
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  outcome TEXT,
  outcome_notes TEXT,
  effectiveness_score NUMERIC,
  ai_model TEXT,
  ai_confidence NUMERIC CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  source TEXT DEFAULT 'ai' CHECK (source IN ('ai', 'rule', 'manual', 'workflow')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================
-- Enable RLS
-- ================================================

ALTER TABLE public.call_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.next_best_actions ENABLE ROW LEVEL SECURITY;

-- ================================================
-- RLS Policies
-- ================================================

-- Call recordings policies
CREATE POLICY "Users can view call recordings in their org"
  ON public.call_recordings FOR SELECT
  USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can create call recordings in their org"
  ON public.call_recordings FOR INSERT
  WITH CHECK (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can update call recordings in their org"
  ON public.call_recordings FOR UPDATE
  USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can delete call recordings in their org"
  ON public.call_recordings FOR DELETE
  USING (org_id = public.get_current_user_org_id());

-- Call insights policies
CREATE POLICY "Users can view call insights in their org"
  ON public.call_insights FOR SELECT
  USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can create call insights in their org"
  ON public.call_insights FOR INSERT
  WITH CHECK (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can update call insights in their org"
  ON public.call_insights FOR UPDATE
  USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can delete call insights in their org"
  ON public.call_insights FOR DELETE
  USING (org_id = public.get_current_user_org_id());

-- Email threads policies
CREATE POLICY "Users can view email threads in their org"
  ON public.email_threads FOR SELECT
  USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can create email threads in their org"
  ON public.email_threads FOR INSERT
  WITH CHECK (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can update email threads in their org"
  ON public.email_threads FOR UPDATE
  USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can delete email threads in their org"
  ON public.email_threads FOR DELETE
  USING (org_id = public.get_current_user_org_id());

-- Action templates policies
CREATE POLICY "Users can view action templates in their org"
  ON public.action_templates FOR SELECT
  USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can create action templates in their org"
  ON public.action_templates FOR INSERT
  WITH CHECK (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can update action templates in their org"
  ON public.action_templates FOR UPDATE
  USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Admins can delete action templates in their org"
  ON public.action_templates FOR DELETE
  USING (org_id = public.get_current_user_org_id() AND public.is_current_user_admin());

-- Next best actions policies
CREATE POLICY "Users can view next best actions in their org"
  ON public.next_best_actions FOR SELECT
  USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can create next best actions in their org"
  ON public.next_best_actions FOR INSERT
  WITH CHECK (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can update next best actions in their org"
  ON public.next_best_actions FOR UPDATE
  USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can delete next best actions in their org"
  ON public.next_best_actions FOR DELETE
  USING (org_id = public.get_current_user_org_id());

-- ================================================
-- Indexes for Performance
-- ================================================

CREATE INDEX idx_call_recordings_org_id ON public.call_recordings(org_id);
CREATE INDEX idx_call_recordings_account ON public.call_recordings(org_id, account_external_id);
CREATE INDEX idx_call_recordings_deal ON public.call_recordings(deal_id);
CREATE INDEX idx_call_recordings_status ON public.call_recordings(processing_status);
CREATE INDEX idx_call_recordings_recorded_at ON public.call_recordings(recorded_at DESC);

CREATE INDEX idx_call_insights_call_id ON public.call_insights(call_id);
CREATE INDEX idx_call_insights_org_id ON public.call_insights(org_id);
CREATE INDEX idx_call_insights_sentiment ON public.call_insights(sentiment);

CREATE INDEX idx_email_threads_org_id ON public.email_threads(org_id);
CREATE INDEX idx_email_threads_account ON public.email_threads(org_id, account_external_id);
CREATE INDEX idx_email_threads_deal ON public.email_threads(deal_id);
CREATE INDEX idx_email_threads_status ON public.email_threads(processing_status);
CREATE INDEX idx_email_threads_last_message ON public.email_threads(last_message_at DESC);
CREATE INDEX idx_email_threads_action_required ON public.email_threads(action_required) WHERE action_required = true;

CREATE INDEX idx_action_templates_org_id ON public.action_templates(org_id);
CREATE INDEX idx_action_templates_type ON public.action_templates(action_type);
CREATE INDEX idx_action_templates_active ON public.action_templates(is_active) WHERE is_active = true;

CREATE INDEX idx_next_best_actions_org_id ON public.next_best_actions(org_id);
CREATE INDEX idx_next_best_actions_account ON public.next_best_actions(org_id, account_external_id);
CREATE INDEX idx_next_best_actions_deal ON public.next_best_actions(deal_id);
CREATE INDEX idx_next_best_actions_user ON public.next_best_actions(user_id);
CREATE INDEX idx_next_best_actions_status ON public.next_best_actions(status);
CREATE INDEX idx_next_best_actions_priority ON public.next_best_actions(priority DESC) WHERE status = 'pending';
CREATE INDEX idx_next_best_actions_due_date ON public.next_best_actions(due_date) WHERE status IN ('pending', 'accepted');

-- ================================================
-- Triggers for updated_at
-- ================================================

CREATE TRIGGER update_call_recordings_updated_at
  BEFORE UPDATE ON public.call_recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_threads_updated_at
  BEFORE UPDATE ON public.email_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_action_templates_updated_at
  BEFORE UPDATE ON public.action_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_next_best_actions_updated_at
  BEFORE UPDATE ON public.next_best_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ================================================
-- Insert default action templates
-- ================================================

INSERT INTO public.action_templates (org_id, name, description, action_type, trigger_conditions, content_template, is_system, priority_weight)
SELECT 
  id as org_id,
  'Follow Up After Demo' as name,
  'Send a follow-up email after a product demo' as description,
  'email' as action_type,
  '{"after_event": "demo", "delay_hours": 24}'::jsonb as trigger_conditions,
  'Hi {{contact_name}},

Thank you for taking the time to see our demo today. I wanted to follow up on the key points we discussed:

{{key_points}}

As a next step, I''d suggest {{next_step}}. Would {{suggested_date}} work for a follow-up call?

Best regards' as content_template,
  true as is_system,
  8 as priority_weight
FROM public.organizations;

INSERT INTO public.action_templates (org_id, name, description, action_type, trigger_conditions, content_template, is_system, priority_weight)
SELECT 
  id as org_id,
  'Re-engage Stalled Deal' as name,
  'Reach out when a deal has gone quiet' as description,
  'call' as action_type,
  '{"no_activity_days": 14, "deal_stage": ["negotiation", "proposal"]}'::jsonb as trigger_conditions,
  'Call to re-engage. Key talking points:
- Reference last conversation: {{last_interaction_summary}}
- Address potential concerns
- Propose concrete next step' as content_template,
  true as is_system,
  9 as priority_weight
FROM public.organizations;

INSERT INTO public.action_templates (org_id, name, description, action_type, trigger_conditions, content_template, is_system, priority_weight)
SELECT 
  id as org_id,
  'Send Case Study' as name,
  'Share relevant case study based on industry/use case' as description,
  'send_content' as action_type,
  '{"stage": "evaluation", "has_industry_match": true}'::jsonb as trigger_conditions,
  'Hi {{contact_name}},

I thought you might find this case study relevant - it covers how {{case_study_company}} in {{industry}} achieved {{key_result}}.

{{case_study_link}}

Happy to discuss how we could help you achieve similar results.

Best regards' as content_template,
  true as is_system,
  6 as priority_weight
FROM public.organizations;

INSERT INTO public.action_templates (org_id, name, description, action_type, trigger_conditions, content_template, is_system, priority_weight)
SELECT 
  id as org_id,
  'Escalate to Manager' as name,
  'Escalate deal to sales manager when at risk' as description,
  'escalate' as action_type,
  '{"risk_score": "high", "deal_value_min": 50000}'::jsonb as trigger_conditions,
  'Deal requires manager attention:
- Account: {{account_name}}
- Value: {{deal_value}}
- Risk indicators: {{risk_indicators}}
- Recommended action: {{recommended_action}}' as content_template,
  true as is_system,
  10 as priority_weight
FROM public.organizations;