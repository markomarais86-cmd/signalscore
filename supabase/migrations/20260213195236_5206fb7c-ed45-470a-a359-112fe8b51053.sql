
-- 1. Create account_segments junction table
CREATE TABLE public.account_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES public.segments(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID,
  UNIQUE(account_id, segment_id)
);

-- Enable RLS
ALTER TABLE public.account_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view account_segments in their org"
  ON public.account_segments FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert account_segments in their org"
  ON public.account_segments FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete account_segments in their org"
  ON public.account_segments FOR DELETE
  USING (org_id IN (SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid()));

-- Index for fast lookups
CREATE INDEX idx_account_segments_account ON public.account_segments(account_id);
CREATE INDEX idx_account_segments_segment ON public.account_segments(segment_id);
CREATE INDEX idx_account_segments_org ON public.account_segments(org_id);

-- 2. Add status column to segments table
ALTER TABLE public.segments ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- 3. Create get_account_lineage function
CREATE OR REPLACE FUNCTION public.get_account_lineage(p_account_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'account', row_to_json(a),
    'segments', COALESCE((
      SELECT json_agg(row_to_json(s))
      FROM account_segments aseg
      JOIN segments s ON s.id = aseg.segment_id
      WHERE aseg.account_id = a.id
    ), '[]'::json),
    'scores', COALESCE((
      SELECT json_agg(json_build_object(
        'icp_id', sc.icp_id,
        'icp_name', ip.name,
        'overall_score', sc.overall_score,
        'fit_score', sc.fit_score,
        'score_band', sc.score_band
      ))
      FROM scores sc
      LEFT JOIN icp_profiles ip ON ip.id = sc.icp_id
      WHERE sc.account_external_id = a.external_id AND sc.org_id = a.org_id
    ), '[]'::json),
    'leads', COALESCE((
      SELECT json_agg(json_build_object(
        'id', l.id,
        'first_name', l.first_name,
        'last_name', l.last_name,
        'title', l.title,
        'seniority', l.seniority,
        'department', l.department,
        'email', l.email
      ))
      FROM "Leads" l
      WHERE l.account_external_id = a.external_id AND l.org_id = a.org_id
    ), '[]'::json),
    'region', json_build_object(
      'country', a.country,
      'state', a.state_province,
      'city', a.city
    ),
    'industry', json_build_object(
      'raw', a.industry_raw,
      'normalized', a.industry_norm,
      'sub_industry', a.sub_industry
    )
  ) INTO result
  FROM accounts a
  WHERE a.id = p_account_id;

  RETURN result;
END;
$$;

-- 4. Tier change logging trigger
CREATE OR REPLACE FUNCTION public.log_tier_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.score_band IS DISTINCT FROM NEW.score_band THEN
    INSERT INTO audit_logs (org_id, action, actor, meta)
    VALUES (
      NEW.org_id,
      'tier_change',
      NULL,
      json_build_object(
        'account_external_id', NEW.account_external_id,
        'old_tier', OLD.score_band,
        'new_tier', NEW.score_band,
        'old_score', OLD.overall_score,
        'new_score', NEW.overall_score
      )::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_tier_change
  AFTER UPDATE ON public.scores
  FOR EACH ROW
  EXECUTE FUNCTION public.log_tier_change();
