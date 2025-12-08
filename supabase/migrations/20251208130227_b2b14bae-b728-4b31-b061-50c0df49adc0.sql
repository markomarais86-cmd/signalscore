-- Phase 5: AI Provider Abstraction, Memory & Learning

-- AI Usage Tracking table for cost and performance analytics
CREATE TABLE public.ai_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  task_type TEXT,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  cost_estimate DECIMAL(10,6) DEFAULT 0,
  latency_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Action Templates for saved successful patterns
CREATE TABLE public.ai_action_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  action_type TEXT NOT NULL,
  parameters JSONB DEFAULT '{}'::jsonb,
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 100.00,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Provider Health tracking
CREATE TABLE public.ai_provider_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'healthy',
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  avg_latency_ms INTEGER,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add preference columns to ai_memory
ALTER TABLE public.ai_memory 
ADD COLUMN IF NOT EXISTS preference_type TEXT,
ADD COLUMN IF NOT EXISTS confidence DECIMAL(3,2) DEFAULT 0.50,
ADD COLUMN IF NOT EXISTS learned_from TEXT[];

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_usage_tracking_org_id ON public.ai_usage_tracking(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tracking_created_at ON public.ai_usage_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tracking_provider ON public.ai_usage_tracking(provider);
CREATE INDEX IF NOT EXISTS idx_ai_action_templates_org_id ON public.ai_action_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_action_templates_action_type ON public.ai_action_templates(action_type);
CREATE INDEX IF NOT EXISTS idx_ai_provider_health_provider ON public.ai_provider_health(provider);

-- Enable RLS
ALTER TABLE public.ai_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_action_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_health ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_usage_tracking
CREATE POLICY "Users can view their org's AI usage" ON public.ai_usage_tracking
  FOR SELECT USING (org_id = public.get_current_user_org_id());

CREATE POLICY "System can insert AI usage" ON public.ai_usage_tracking
  FOR INSERT WITH CHECK (true);

-- RLS Policies for ai_action_templates
CREATE POLICY "Users can view their org's templates" ON public.ai_action_templates
  FOR SELECT USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can create templates for their org" ON public.ai_action_templates
  FOR INSERT WITH CHECK (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can update their org's templates" ON public.ai_action_templates
  FOR UPDATE USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can delete their org's templates" ON public.ai_action_templates
  FOR DELETE USING (org_id = public.get_current_user_org_id());

-- RLS Policies for ai_provider_health (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view provider health" ON public.ai_provider_health
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "System can manage provider health" ON public.ai_provider_health
  FOR ALL USING (true);

-- Trigger for updating updated_at on ai_action_templates
CREATE TRIGGER update_ai_action_templates_updated_at
  BEFORE UPDATE ON public.ai_action_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();