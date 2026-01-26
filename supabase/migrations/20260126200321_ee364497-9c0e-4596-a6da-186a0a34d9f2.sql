-- Phase 1: Agent Registry and Discovery Protocol
-- Create enum for agent status
CREATE TYPE agent_registry_status AS ENUM ('active', 'inactive', 'degraded', 'starting');

-- Create Agent Registry Table
CREATE TABLE public.ai_agent_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '[]',
  input_schema JSONB DEFAULT '{}',
  output_schema JSONB DEFAULT '{}',
  status agent_registry_status NOT NULL DEFAULT 'inactive',
  health_score FLOAT DEFAULT 1.0,
  avg_latency_ms INTEGER DEFAULT 0,
  success_rate FLOAT DEFAULT 1.0,
  total_invocations INTEGER DEFAULT 0,
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, agent_name)
);

-- Enable RLS
ALTER TABLE public.ai_agent_registry ENABLE ROW LEVEL SECURITY;

-- RLS Policies using user_profiles
CREATE POLICY "Users can view their org's agent registry"
  ON public.ai_agent_registry FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage agent registry"
  ON public.ai_agent_registry FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for capability discovery
CREATE INDEX idx_agent_registry_capabilities ON public.ai_agent_registry USING GIN (capabilities);
CREATE INDEX idx_agent_registry_status ON public.ai_agent_registry (org_id, status);
CREATE INDEX idx_agent_registry_type ON public.ai_agent_registry (org_id, agent_type);

-- Add trigger for updated_at
CREATE TRIGGER update_ai_agent_registry_updated_at
  BEFORE UPDATE ON public.ai_agent_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Phase 2: Task Queue for Inter-Agent Communication
CREATE TYPE task_queue_status AS ENUM ('pending', 'claimed', 'running', 'completed', 'failed', 'timeout');
CREATE TYPE task_priority AS ENUM ('low', 'normal', 'high', 'critical');

CREATE TABLE public.ai_task_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES public.ai_task_queue(id),
  requesting_agent TEXT NOT NULL,
  assigned_agent TEXT,
  required_capabilities JSONB NOT NULL DEFAULT '[]',
  priority task_priority NOT NULL DEFAULT 'normal',
  status task_queue_status NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 300,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  claimed_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.ai_task_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's task queue"
  ON public.ai_task_queue FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage task queue"
  ON public.ai_task_queue FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indexes for task queue operations
CREATE INDEX idx_task_queue_pending ON public.ai_task_queue (org_id, status, priority) WHERE status = 'pending';
CREATE INDEX idx_task_queue_agent ON public.ai_task_queue (assigned_agent, status);
CREATE INDEX idx_task_queue_parent ON public.ai_task_queue (parent_task_id);

-- Phase 3: Planning Rules Engine
CREATE TABLE public.ai_planning_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  description TEXT,
  trigger_condition JSONB NOT NULL,
  action_workflow TEXT NOT NULL,
  parameters_template JSONB DEFAULT '{}',
  confidence_threshold FLOAT DEFAULT 0.8,
  auto_execute BOOLEAN DEFAULT false,
  requires_approval BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  trigger_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.ai_planning_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's planning rules"
  ON public.ai_planning_rules FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their org's planning rules"
  ON public.ai_planning_rules FOR ALL
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_planning_rules_active ON public.ai_planning_rules (org_id, is_active);

CREATE TRIGGER update_ai_planning_rules_updated_at
  BEFORE UPDATE ON public.ai_planning_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Phase 4: Enhance ai_agent_runs with real-time columns
ALTER TABLE public.ai_agent_runs
  ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_step TEXT,
  ADD COLUMN IF NOT EXISTS step_details JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS live_metrics JSONB DEFAULT '{}';

-- Phase 5: Universal Decision Feedback
CREATE TYPE feedback_decision AS ENUM ('approved', 'rejected', 'modified', 'pending');

CREATE TABLE public.ai_decision_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  ai_recommendation JSONB NOT NULL,
  confidence FLOAT NOT NULL,
  user_decision feedback_decision DEFAULT 'pending',
  user_feedback TEXT,
  modified_recommendation JSONB,
  outcome_tracked BOOLEAN DEFAULT false,
  outcome_success BOOLEAN,
  outcome_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_decision_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's decision feedback"
  ON public.ai_decision_feedback FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their org's decision feedback"
  ON public.ai_decision_feedback FOR ALL
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_decision_feedback_pending ON public.ai_decision_feedback (org_id, user_decision) WHERE user_decision = 'pending';
CREATE INDEX idx_decision_feedback_agent ON public.ai_decision_feedback (org_id, agent_name, decision_type);
CREATE INDEX idx_decision_feedback_entity ON public.ai_decision_feedback (entity_type, entity_id);