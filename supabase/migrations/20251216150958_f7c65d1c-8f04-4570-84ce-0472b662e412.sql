-- Create account_insights table for caching AI-generated insights
CREATE TABLE public.account_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_external_id TEXT NOT NULL,
  insight_type TEXT NOT NULL, -- 'engagement', 'buying_signals', 'similar_accounts', 'recommended_actions'
  content JSONB NOT NULL DEFAULT '{}',
  confidence NUMERIC(3,2),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, account_external_id, insight_type)
);

-- Create indexes for efficient querying
CREATE INDEX idx_account_insights_org_account ON public.account_insights(org_id, account_external_id);
CREATE INDEX idx_account_insights_expires ON public.account_insights(expires_at);

-- Enable RLS
ALTER TABLE public.account_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view insights in their org"
ON public.account_insights FOR SELECT
USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can insert insights in their org"
ON public.account_insights FOR INSERT
WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Users can update insights in their org"
ON public.account_insights FOR UPDATE
USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete insights"
ON public.account_insights FOR DELETE
USING (org_id = get_current_user_org_id() AND is_current_user_admin());