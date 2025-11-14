-- Create function to update updated_at timestamp if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create campaign_templates table for saving reusable campaign configurations
CREATE TABLE public.campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  persona_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT campaign_templates_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

-- Create index for faster queries
CREATE INDEX idx_campaign_templates_org_id ON public.campaign_templates(org_id);
CREATE INDEX idx_campaign_templates_created_by ON public.campaign_templates(created_by);

-- Enable RLS
ALTER TABLE public.campaign_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view templates from their org
CREATE POLICY "Users can view their org's campaign templates"
  ON public.campaign_templates
  FOR SELECT
  USING (org_id = get_current_user_org_id());

-- Policy: Users can create templates
CREATE POLICY "Users can create campaign templates"
  ON public.campaign_templates
  FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id() AND created_by = auth.uid());

-- Policy: Users can update their own templates
CREATE POLICY "Users can update their own campaign templates"
  ON public.campaign_templates
  FOR UPDATE
  USING (org_id = get_current_user_org_id() AND created_by = auth.uid());

-- Policy: Users can delete their own templates
CREATE POLICY "Users can delete their own campaign templates"
  ON public.campaign_templates
  FOR DELETE
  USING (org_id = get_current_user_org_id() AND created_by = auth.uid());

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_campaign_templates_updated_at
  BEFORE UPDATE ON public.campaign_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();