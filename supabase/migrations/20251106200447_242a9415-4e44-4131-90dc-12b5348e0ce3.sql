-- Create table to track dismissed recommendations
CREATE TABLE IF NOT EXISTS public.dismissed_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  user_id UUID NOT NULL,
  recommendation_id TEXT NOT NULL,
  recommendation_type TEXT NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  UNIQUE(org_id, user_id, recommendation_id)
);

-- Create table to track recommendation history for better suggestions
CREATE TABLE IF NOT EXISTS public.recommendation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  recommendation_type TEXT NOT NULL,
  recommendation_data JSONB NOT NULL,
  priority_score INTEGER NOT NULL,
  impact_estimate TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acted_on BOOLEAN DEFAULT FALSE,
  acted_on_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.dismissed_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dismissed_recommendations
CREATE POLICY "Users can view their dismissed recommendations"
  ON public.dismissed_recommendations FOR SELECT
  USING (org_id = get_current_user_org_id() AND user_id = auth.uid());

CREATE POLICY "Users can dismiss recommendations"
  ON public.dismissed_recommendations FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id() AND user_id = auth.uid());

CREATE POLICY "Users can delete their dismissals"
  ON public.dismissed_recommendations FOR DELETE
  USING (org_id = get_current_user_org_id() AND user_id = auth.uid());

-- RLS Policies for recommendation_history
CREATE POLICY "Users can view recommendation history in their org"
  ON public.recommendation_history FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "System can manage recommendation history"
  ON public.recommendation_history FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_dismissed_recommendations_org_user ON public.dismissed_recommendations(org_id, user_id);
CREATE INDEX idx_dismissed_recommendations_id ON public.dismissed_recommendations(recommendation_id);
CREATE INDEX idx_recommendation_history_org ON public.recommendation_history(org_id);
CREATE INDEX idx_recommendation_history_created ON public.recommendation_history(created_at DESC);