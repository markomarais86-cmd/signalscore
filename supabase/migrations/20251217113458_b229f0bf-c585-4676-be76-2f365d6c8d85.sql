-- Create idempotency_keys table for request deduplication
CREATE TABLE public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  request_hash TEXT,
  response JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT unique_idempotency_key UNIQUE (idempotency_key, endpoint)
);

-- Index for fast lookups and cleanup
CREATE INDEX idx_idempotency_key_lookup ON public.idempotency_keys(idempotency_key, endpoint);
CREATE INDEX idx_idempotency_expires ON public.idempotency_keys(expires_at);
CREATE INDEX idx_idempotency_org ON public.idempotency_keys(org_id);

-- Enable RLS
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- System can manage idempotency keys (edge functions use service role)
CREATE POLICY "System can manage idempotency keys"
ON public.idempotency_keys
FOR ALL
USING (true)
WITH CHECK (true);

-- Users can view their org's idempotency keys (for debugging)
CREATE POLICY "Users can view idempotency keys in their org"
ON public.idempotency_keys
FOR SELECT
USING (org_id = get_current_user_org_id());

-- Function to clean up expired keys (can be called via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.idempotency_keys
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;