-- Phase 1: Agentic AI Foundation Tables

-- AI Memory: Persistent context storage for intelligent conversations
CREATE TABLE public.ai_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('session', 'preference', 'workflow', 'context')),
  memory_key TEXT NOT NULL,
  memory_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id, memory_type, memory_key)
);

-- AI Workflows: Multi-step workflow state machine
CREATE TABLE public.ai_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  workflow_type TEXT NOT NULL,
  workflow_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  current_step INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 0,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  step_outputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI Action Logs: Audit trail for all AI actions
CREATE TABLE public.ai_action_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  workflow_id UUID REFERENCES public.ai_workflows(id) ON DELETE SET NULL,
  action_name TEXT NOT NULL,
  action_parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_result JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_ai_memory_org_user ON public.ai_memory(org_id, user_id);
CREATE INDEX idx_ai_memory_type ON public.ai_memory(memory_type);
CREATE INDEX idx_ai_memory_expires ON public.ai_memory(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_ai_workflows_org_user ON public.ai_workflows(org_id, user_id);
CREATE INDEX idx_ai_workflows_status ON public.ai_workflows(status);
CREATE INDEX idx_ai_action_logs_org ON public.ai_action_logs(org_id);
CREATE INDEX idx_ai_action_logs_workflow ON public.ai_action_logs(workflow_id);
CREATE INDEX idx_ai_action_logs_created ON public.ai_action_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_action_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_memory
CREATE POLICY "Users can view their own memory" ON public.ai_memory
  FOR SELECT USING (org_id = get_current_user_org_id() AND user_id = auth.uid());

CREATE POLICY "Users can insert their own memory" ON public.ai_memory
  FOR INSERT WITH CHECK (org_id = get_current_user_org_id() AND user_id = auth.uid());

CREATE POLICY "Users can update their own memory" ON public.ai_memory
  FOR UPDATE USING (org_id = get_current_user_org_id() AND user_id = auth.uid());

CREATE POLICY "Users can delete their own memory" ON public.ai_memory
  FOR DELETE USING (org_id = get_current_user_org_id() AND user_id = auth.uid());

-- RLS Policies for ai_workflows
CREATE POLICY "Users can view their own workflows" ON public.ai_workflows
  FOR SELECT USING (org_id = get_current_user_org_id() AND user_id = auth.uid());

CREATE POLICY "Users can insert their own workflows" ON public.ai_workflows
  FOR INSERT WITH CHECK (org_id = get_current_user_org_id() AND user_id = auth.uid());

CREATE POLICY "Users can update their own workflows" ON public.ai_workflows
  FOR UPDATE USING (org_id = get_current_user_org_id() AND user_id = auth.uid());

CREATE POLICY "Users can delete their own workflows" ON public.ai_workflows
  FOR DELETE USING (org_id = get_current_user_org_id() AND user_id = auth.uid());

-- RLS Policies for ai_action_logs
CREATE POLICY "Users can view action logs in their org" ON public.ai_action_logs
  FOR SELECT USING (org_id = get_current_user_org_id());

CREATE POLICY "System can insert action logs" ON public.ai_action_logs
  FOR INSERT WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_ai_memory_updated_at
  BEFORE UPDATE ON public.ai_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_workflows_updated_at
  BEFORE UPDATE ON public.ai_workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();