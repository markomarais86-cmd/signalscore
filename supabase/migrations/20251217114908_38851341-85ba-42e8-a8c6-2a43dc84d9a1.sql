-- Create service_health table for circuit breaker state persistence
CREATE TABLE IF NOT EXISTS public.service_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL UNIQUE,
  circuit_state TEXT DEFAULT 'closed' CHECK (circuit_state IN ('closed', 'open', 'half_open')),
  failure_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error_message TEXT,
  state_changed_at TIMESTAMPTZ DEFAULT now(),
  cooldown_until TIMESTAMPTZ,
  avg_response_time_ms INTEGER,
  total_requests INTEGER DEFAULT 0,
  total_failures INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_service_health_name ON public.service_health(service_name);
CREATE INDEX IF NOT EXISTS idx_service_health_state ON public.service_health(circuit_state);

-- Enable RLS
ALTER TABLE public.service_health ENABLE ROW LEVEL SECURITY;

-- Service health is system-wide, allow read for authenticated users
CREATE POLICY "Authenticated users can view service health"
  ON public.service_health FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can modify (edge functions use service role)
CREATE POLICY "Service role can manage service health"
  ON public.service_health FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_service_health_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER service_health_updated_at
  BEFORE UPDATE ON public.service_health
  FOR EACH ROW
  EXECUTE FUNCTION update_service_health_updated_at();

-- Insert default service entries
INSERT INTO public.service_health (service_name, circuit_state) VALUES
  ('pdl', 'closed'),
  ('clearbit', 'closed'),
  ('openai', 'closed'),
  ('anthropic', 'closed'),
  ('salesforce', 'closed'),
  ('hubspot', 'closed'),
  ('apollo', 'closed'),
  ('abacus', 'closed'),
  ('lovable', 'closed')
ON CONFLICT (service_name) DO NOTHING;