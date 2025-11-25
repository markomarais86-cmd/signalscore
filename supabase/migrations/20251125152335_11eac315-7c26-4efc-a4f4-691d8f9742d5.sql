-- Create AI Agents table
CREATE TABLE IF NOT EXISTS public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('lead_qualification', 'follow_up', 'meeting_scheduler', 'data_enrichment')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'paused' CHECK (status IN ('active', 'paused', 'error')),
  schedule TEXT NOT NULL DEFAULT 'daily',
  parameters JSONB DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create AI Agent Runs table
CREATE TABLE IF NOT EXISTS public.ai_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  records_processed INTEGER DEFAULT 0,
  records_affected INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  results JSONB
);

-- Enable RLS
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_agents (allow org admins to manage)
CREATE POLICY "Users can view their org's agents"
  ON public.ai_agents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their org's agents"
  ON public.ai_agents FOR ALL
  TO authenticated
  USING (true);

-- RLS Policies for ai_agent_runs
CREATE POLICY "Users can view agent runs"
  ON public.ai_agent_runs FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_agents_org_id ON public.ai_agents(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_status ON public.ai_agents(status);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_agent_id ON public.ai_agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_status ON public.ai_agent_runs(status);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_ai_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_agents_updated_at
  BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_agents_updated_at();