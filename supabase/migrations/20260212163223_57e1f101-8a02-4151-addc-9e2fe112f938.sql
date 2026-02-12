
-- Step 1: Add tier, OTP, click IDs, funnel variant, meeting columns to marketing_leads
ALTER TABLE public.marketing_leads ADD COLUMN IF NOT EXISTS lp_tier text;
ALTER TABLE public.marketing_leads ADD COLUMN IF NOT EXISTS otp_status text DEFAULT 'pending';
ALTER TABLE public.marketing_leads ADD COLUMN IF NOT EXISTS click_ids jsonb DEFAULT '{}';
ALTER TABLE public.marketing_leads ADD COLUMN IF NOT EXISTS funnel_variant text;
ALTER TABLE public.marketing_leads ADD COLUMN IF NOT EXISTS meeting_booked_at timestamptz;

-- Index on tier for dashboard filtering
CREATE INDEX IF NOT EXISTS idx_marketing_leads_lp_tier ON public.marketing_leads (lp_tier);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_funnel_variant ON public.marketing_leads (funnel_variant);
