-- Phase 5: Score History Audit Trail
CREATE TABLE IF NOT EXISTS public.score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  account_external_id TEXT NOT NULL,
  icp_id UUID,
  old_score JSONB,
  new_score JSONB,
  changed_by UUID REFERENCES auth.users(id),
  change_reason TEXT,
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.score_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for score_history
CREATE POLICY "Users can view score history in their org"
  ON public.score_history
  FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can insert score history"
  ON public.score_history
  FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id());

-- Index for performance
CREATE INDEX idx_score_history_org_account ON public.score_history(org_id, account_external_id);
CREATE INDEX idx_score_history_computed_at ON public.score_history(computed_at DESC);

-- Phase 5: Rate Limiting Infrastructure
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  requests_count INTEGER DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
  window_duration_seconds INTEGER DEFAULT 60,
  max_requests_per_window INTEGER DEFAULT 100,
  last_request_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(org_id, endpoint)
);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rate_limits
CREATE POLICY "Admins can view rate limits in their org"
  ON public.rate_limits
  FOR SELECT
  USING ((org_id = get_current_user_org_id()) AND is_current_user_admin());

CREATE POLICY "System can manage rate limits"
  ON public.rate_limits
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to check and update rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_org_id UUID,
  p_endpoint TEXT,
  p_max_requests INTEGER DEFAULT 100,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count INTEGER;
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_allowed BOOLEAN;
BEGIN
  -- Get or create rate limit record
  INSERT INTO public.rate_limits (org_id, endpoint, max_requests_per_window, window_duration_seconds)
  VALUES (p_org_id, p_endpoint, p_max_requests, p_window_seconds)
  ON CONFLICT (org_id, endpoint) DO NOTHING;

  -- Get current window info
  SELECT requests_count, window_start
  INTO v_current_count, v_window_start
  FROM public.rate_limits
  WHERE org_id = p_org_id AND endpoint = p_endpoint;

  -- Check if window has expired
  IF v_window_start + (p_window_seconds || ' seconds')::INTERVAL < now() THEN
    -- Reset window
    UPDATE public.rate_limits
    SET requests_count = 1,
        window_start = now(),
        last_request_at = now()
    WHERE org_id = p_org_id AND endpoint = p_endpoint;
    
    v_allowed := true;
    v_current_count := 1;
  ELSIF v_current_count >= p_max_requests THEN
    -- Rate limit exceeded
    v_allowed := false;
  ELSE
    -- Increment counter
    UPDATE public.rate_limits
    SET requests_count = requests_count + 1,
        last_request_at = now()
    WHERE org_id = p_org_id AND endpoint = p_endpoint;
    
    v_allowed := true;
    v_current_count := v_current_count + 1;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'current_count', v_current_count,
    'max_requests', p_max_requests,
    'window_seconds', p_window_seconds,
    'reset_at', v_window_start + (p_window_seconds || ' seconds')::INTERVAL
  );
END;
$$;

-- Trigger to log score changes to history
CREATE OR REPLACE FUNCTION public.log_score_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log if score actually changed
  IF (OLD.overall IS DISTINCT FROM NEW.overall OR 
      OLD.fit IS DISTINCT FROM NEW.fit OR 
      OLD.intent IS DISTINCT FROM NEW.intent OR 
      OLD.reachability IS DISTINCT FROM NEW.reachability) THEN
    
    INSERT INTO public.score_history (
      org_id,
      account_external_id,
      old_score,
      new_score,
      computed_at
    ) VALUES (
      NEW.org_id,
      NEW.account_external_id,
      jsonb_build_object(
        'overall', OLD.overall,
        'fit', OLD.fit,
        'intent', OLD.intent,
        'reachability', OLD.reachability,
        'reasons', OLD.reasons
      ),
      jsonb_build_object(
        'overall', NEW.overall,
        'fit', NEW.fit,
        'intent', NEW.intent,
        'reachability', NEW.reachability,
        'reasons', NEW.reasons
      ),
      NEW.computed_at
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for score changes
DROP TRIGGER IF EXISTS track_score_changes ON public.scores;
CREATE TRIGGER track_score_changes
  AFTER UPDATE ON public.scores
  FOR EACH ROW
  EXECUTE FUNCTION public.log_score_change();

-- Also log on insert (initial score)
DROP TRIGGER IF EXISTS track_initial_score ON public.scores;
CREATE TRIGGER track_initial_score
  AFTER INSERT ON public.scores
  FOR EACH ROW
  EXECUTE FUNCTION public.log_score_change();