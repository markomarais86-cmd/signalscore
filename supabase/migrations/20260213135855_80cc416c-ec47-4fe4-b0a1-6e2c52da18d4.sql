
-- Add service_type to distinguish managed vs self-service customers
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'self_service'
  CHECK (service_type IN ('managed', 'self_service'));

-- Add Stripe billing fields
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive'
  CHECK (subscription_status IN ('inactive', 'trialing', 'active', 'past_due', 'canceled'));
