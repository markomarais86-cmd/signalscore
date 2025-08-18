-- Fix critical security issues (correcting table name)

-- 1. Add missing columns and RLS policies for Leads table (correct case)
ALTER TABLE public."Leads" ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE public."Leads" ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public."Leads" ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public."Leads" ADD COLUMN IF NOT EXISTS status text DEFAULT 'open';

-- Add RLS policies for Leads table
CREATE POLICY "Users can view leads in their org" ON public."Leads"
  FOR SELECT USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can insert leads" ON public."Leads"
  FOR INSERT WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Users can update leads" ON public."Leads"
  FOR UPDATE USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete leads" ON public."Leads"
  FOR DELETE USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- 2. Fix function search paths (security issue)
CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, auth
AS $function$
  SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, auth
AS $function$
  SELECT role = 'admin' FROM public.user_profiles WHERE user_id = auth.uid();
$function$;

-- 3. Create account scoring function
CREATE OR REPLACE FUNCTION public.calculate_account_score(
  account_external_id text,
  icp_id uuid,
  org_id_param uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  account_rec RECORD;
  icp_rec RECORD;
  industry_score integer := 0;
  size_score integer := 0;
  geo_score integer := 0;
  revenue_score integer := 0;
  total_score integer := 0;
  fit_score integer := 0;
BEGIN
  -- Get account data
  SELECT * INTO account_rec 
  FROM accounts 
  WHERE external_id = account_external_id AND org_id = org_id_param;
  
  -- Get ICP data  
  SELECT * INTO icp_rec 
  FROM icp_profiles 
  WHERE id = icp_id AND org_id = org_id_param;
  
  -- Return 0 scores if no data found
  IF account_rec IS NULL OR icp_rec IS NULL THEN
    RETURN jsonb_build_object(
      'overall', 0,
      'fit', 0,
      'intent', 0,
      'reachability', 0,
      'breakdown', jsonb_build_object(
        'industry_score', 0,
        'size_score', 0,
        'geo_score', 0,
        'revenue_score', 0
      )
    );
  END IF;
  
  -- Industry scoring
  IF account_rec.industry_norm IS NOT NULL AND icp_rec.industries IS NOT NULL THEN
    IF account_rec.industry_norm = ANY(icp_rec.industries) THEN
      industry_score := 25;
    END IF;
  END IF;
  
  -- Size scoring
  IF account_rec.employee_count IS NOT NULL AND icp_rec.company_sizes IS NOT NULL THEN
    IF account_rec.employee_count = ANY(icp_rec.company_sizes) THEN
      size_score := 25;
    END IF;
  END IF;
  
  -- Geography scoring
  IF account_rec.country IS NOT NULL AND icp_rec.geographies IS NOT NULL THEN
    IF account_rec.country = ANY(icp_rec.geographies) THEN
      geo_score := 25;
    END IF;
  END IF;
  
  -- Revenue scoring
  IF account_rec.revenue_range IS NOT NULL AND icp_rec.revenue_ranges IS NOT NULL THEN
    IF account_rec.revenue_range = ANY(icp_rec.revenue_ranges) THEN
      revenue_score := 25;
    END IF;
  END IF;
  
  -- Calculate totals
  total_score := industry_score + size_score + geo_score + revenue_score;
  fit_score := total_score;
  
  RETURN jsonb_build_object(
    'overall', total_score,
    'fit', fit_score,
    'intent', 50, -- Default intent score
    'reachability', 70, -- Default reachability score
    'breakdown', jsonb_build_object(
      'industry_score', industry_score,
      'size_score', size_score,
      'geo_score', geo_score,
      'revenue_score', revenue_score
    )
  );
END;
$function$;

-- 4. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_accounts_org_id ON accounts(org_id);
CREATE INDEX IF NOT EXISTS idx_accounts_industry_norm ON accounts(industry_norm);
CREATE INDEX IF NOT EXISTS idx_accounts_external_id ON accounts(external_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org_id ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_scores_account_external_id ON scores(account_external_id);
CREATE INDEX IF NOT EXISTS idx_icp_profiles_org_id ON icp_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- 5. Fix scores table constraints
ALTER TABLE scores ADD CONSTRAINT unique_score_per_account 
  UNIQUE (org_id, account_external_id);