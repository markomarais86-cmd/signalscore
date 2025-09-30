-- Phase 7: Closed Won Data Architecture
-- Create table for closed won deals to analyze ICP from actual wins

CREATE TABLE IF NOT EXISTS public.closed_won_deals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  account_external_id text NOT NULL,
  deal_value numeric NOT NULL,
  close_date date NOT NULL,
  sales_cycle_days integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(org_id, account_external_id, close_date)
);

-- Enable RLS
ALTER TABLE public.closed_won_deals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view closed won deals in their org" 
ON public.closed_won_deals 
FOR SELECT 
USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can insert closed won deals" 
ON public.closed_won_deals 
FOR INSERT 
WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Admins can update closed won deals" 
ON public.closed_won_deals 
FOR UPDATE 
USING (org_id = get_current_user_org_id() AND is_current_user_admin());

CREATE POLICY "Admins can delete closed won deals" 
ON public.closed_won_deals 
FOR DELETE 
USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Add index for performance
CREATE INDEX idx_closed_won_org_account ON public.closed_won_deals(org_id, account_external_id);

-- Add comment
COMMENT ON TABLE public.closed_won_deals IS 'Historical closed won deals used for ICP analysis and revenue calculations';