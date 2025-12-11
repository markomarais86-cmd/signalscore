-- Create ai_agent_feedback table for agent learning
CREATE TABLE public.ai_agent_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  lead_id TEXT,
  account_id UUID,
  decision_type TEXT NOT NULL, -- 'qualified', 'follow_up', 'meeting_scheduled', 'enriched', 'prioritized'
  ai_reasoning TEXT,
  confidence_score NUMERIC,
  outcome TEXT, -- 'converted', 'lost', 'no_response', 'meeting_held', 'pending'
  outcome_at TIMESTAMPTZ,
  feedback_score INTEGER CHECK (feedback_score >= 1 AND feedback_score <= 5),
  feedback_notes TEXT,
  context_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add pipeline columns to Leads table
ALTER TABLE public."Leads" 
ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'new',
ADD COLUMN IF NOT EXISTS pipeline_triggered_by TEXT,
ADD COLUMN IF NOT EXISTS pipeline_updated_at TIMESTAMPTZ;

-- Create index for efficient queries
CREATE INDEX idx_ai_agent_feedback_org_id ON public.ai_agent_feedback(org_id);
CREATE INDEX idx_ai_agent_feedback_agent_id ON public.ai_agent_feedback(agent_id);
CREATE INDEX idx_ai_agent_feedback_decision_type ON public.ai_agent_feedback(decision_type);
CREATE INDEX idx_ai_agent_feedback_outcome ON public.ai_agent_feedback(outcome);
CREATE INDEX idx_leads_pipeline_stage ON public."Leads"(pipeline_stage);

-- Enable RLS
ALTER TABLE public.ai_agent_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_agent_feedback
CREATE POLICY "Users can view feedback in their org" 
ON public.ai_agent_feedback 
FOR SELECT 
USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can insert feedback in their org" 
ON public.ai_agent_feedback 
FOR INSERT 
WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Users can update feedback in their org" 
ON public.ai_agent_feedback 
FOR UPDATE 
USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete feedback" 
ON public.ai_agent_feedback 
FOR DELETE 
USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- System policy for edge functions
CREATE POLICY "System can manage feedback" 
ON public.ai_agent_feedback 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_ai_agent_feedback_updated_at
BEFORE UPDATE ON public.ai_agent_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();