
-- Create marketing_leads table
CREATE TABLE public.marketing_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  subject TEXT,
  message TEXT,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (visitors can submit)
CREATE POLICY "Anyone can insert marketing leads"
ON public.marketing_leads
FOR INSERT
WITH CHECK (true);

-- Only super admins can view leads
CREATE POLICY "Admins can view marketing leads"
ON public.marketing_leads
FOR SELECT
USING (public.is_super_admin());

-- Only super admins can update leads
CREATE POLICY "Admins can update marketing leads"
ON public.marketing_leads
FOR UPDATE
USING (public.is_super_admin());

-- Only super admins can delete leads
CREATE POLICY "Admins can delete marketing leads"
ON public.marketing_leads
FOR DELETE
USING (public.is_super_admin());

-- Unique partial index to prevent duplicate signups from the same source
CREATE UNIQUE INDEX idx_marketing_leads_email_source ON public.marketing_leads (email, source);

-- Trigger for updated_at
CREATE TRIGGER update_marketing_leads_updated_at
BEFORE UPDATE ON public.marketing_leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
