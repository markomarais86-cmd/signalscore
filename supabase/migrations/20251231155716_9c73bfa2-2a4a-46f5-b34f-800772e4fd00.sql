-- Create account_signals table for real-time signal detection
CREATE TABLE public.account_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_external_id TEXT NOT NULL,
  account_name TEXT,
  signal_type TEXT NOT NULL,
  signal_priority TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  actioned_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_account_signals_org ON public.account_signals(org_id);
CREATE INDEX idx_account_signals_priority ON public.account_signals(signal_priority);
CREATE INDEX idx_account_signals_type ON public.account_signals(signal_type);
CREATE INDEX idx_account_signals_created ON public.account_signals(created_at DESC);
CREATE INDEX idx_account_signals_active ON public.account_signals(org_id, dismissed_at) WHERE dismissed_at IS NULL;

-- Enable RLS
ALTER TABLE public.account_signals ENABLE ROW LEVEL SECURITY;

-- RLS Policies using user_profiles table
CREATE POLICY "Users can view signals for their org" ON public.account_signals
  FOR SELECT USING (org_id IN (
    SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update signals for their org" ON public.account_signals
  FOR UPDATE USING (org_id IN (
    SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert signals for their org" ON public.account_signals
  FOR INSERT WITH CHECK (org_id IN (
    SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete signals for their org" ON public.account_signals
  FOR DELETE USING (org_id IN (
    SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()
  ));