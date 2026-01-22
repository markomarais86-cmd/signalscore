-- Create carrier cache table to store verified phone numbers
CREATE TABLE public.carrier_cache (
  phone_normalized TEXT PRIMARY KEY,
  carrier_name TEXT,
  line_type TEXT,
  country_code TEXT,
  country_name TEXT,
  valid BOOLEAN NOT NULL DEFAULT false,
  raw_response JSONB,
  org_id TEXT,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for expiration cleanup
CREATE INDEX idx_carrier_cache_expires_at ON public.carrier_cache(expires_at);

-- Create index for org lookups
CREATE INDEX idx_carrier_cache_org_id ON public.carrier_cache(org_id);

-- Enable RLS
ALTER TABLE public.carrier_cache ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions use service role)
CREATE POLICY "Service role has full access to carrier_cache"
  ON public.carrier_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.carrier_cache IS 'Cache for NumVerify carrier lookups to reduce API calls and handle rate limits';