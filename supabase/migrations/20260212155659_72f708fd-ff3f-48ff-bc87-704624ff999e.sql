
-- Add UTM tracking and qualification columns to marketing_leads
ALTER TABLE public.marketing_leads
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS utm_content TEXT,
ADD COLUMN IF NOT EXISTS utm_term TEXT,
ADD COLUMN IF NOT EXISTS qualification_score INTEGER,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- Create quiz_responses table
CREATE TABLE public.quiz_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  marketing_lead_id UUID REFERENCES public.marketing_leads(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  qualification_score INTEGER,
  company_size TEXT,
  industry TEXT,
  current_tools TEXT,
  budget_range TEXT,
  timeline TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quiz_responses ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public quiz form)
CREATE POLICY "Allow anonymous quiz submissions"
ON public.quiz_responses
FOR INSERT
WITH CHECK (true);

-- Only authenticated users can read quiz responses
CREATE POLICY "Authenticated users can read quiz responses"
ON public.quiz_responses
FOR SELECT
USING (auth.role() = 'authenticated');

-- Create index for lookups
CREATE INDEX idx_quiz_responses_email ON public.quiz_responses(email);
CREATE INDEX idx_quiz_responses_marketing_lead ON public.quiz_responses(marketing_lead_id);
CREATE INDEX idx_marketing_leads_utm ON public.marketing_leads(utm_source, utm_campaign);
