-- Fix critical security issues

-- 1. Add missing RLS policies for Leads table
CREATE POLICY "Users can view leads in their org" ON public.Leads
  FOR SELECT USING (true); -- Temporary policy - needs org_id column first

CREATE POLICY "Users can insert leads" ON public.Leads
  FOR INSERT WITH CHECK (true); -- Temporary policy - needs org_id column first

-- 2. Add org_id to Leads table for proper RLS
ALTER TABLE public.Leads ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE public.Leads ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.Leads ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.Leads ADD COLUMN IF NOT EXISTS status text DEFAULT 'open';

-- Drop temporary policies and create proper ones
DROP POLICY IF EXISTS "Users can view leads in their org" ON public.Leads;
DROP POLICY IF EXISTS "Users can insert leads" ON public.Leads;

CREATE POLICY "Users can view leads in their org" ON public.Leads
  FOR SELECT USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can insert leads" ON public.Leads
  FOR INSERT WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Users can update leads" ON public.Leads
  FOR UPDATE USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete leads" ON public.Leads
  FOR DELETE USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- 3. Fix function search paths
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

CREATE OR REPLACE FUNCTION public.refresh_reporting_views()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW public.mv_score_distribution;
  REFRESH MATERIALIZED VIEW public.mv_leads_by_week;
END;
$function$;

-- 4. Create account scoring function
CREATE OR REPLACE FUNCTION public.calculate_account_score(
  account_id uuid,
  icp_id uuid
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
  SELECT * INTO account_rec FROM accounts WHERE id = account_id;
  
  -- Get ICP data  
  SELECT * INTO icp_rec FROM icp_profiles WHERE id = icp_id;
  
  -- Industry scoring
  IF account_rec.industry_norm = ANY(icp_rec.industries) THEN
    industry_score := 25;
  END IF;
  
  -- Size scoring
  IF account_rec.employee_count IS NOT NULL AND icp_rec.company_sizes IS NOT NULL THEN
    IF account_rec.employee_count = ANY(icp_rec.company_sizes) THEN
      size_score := 25;
    END IF;
  END IF;
  
  -- Geography scoring
  IF account_rec.country = ANY(icp_rec.geographies) THEN
    geo_score := 25;
  END IF;
  
  -- Revenue scoring
  IF account_rec.revenue_range = ANY(icp_rec.revenue_ranges) THEN
    revenue_score := 25;
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

-- 5. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_org_id ON accounts(org_id);
CREATE INDEX IF NOT EXISTS idx_accounts_industry_norm ON accounts(industry_norm);
CREATE INDEX IF NOT EXISTS idx_contacts_org_id ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_scores_account_external_id ON scores(account_external_id);
CREATE INDEX IF NOT EXISTS idx_icp_profiles_org_id ON icp_profiles(org_id);

-- 6. Create triggers for automatic score updates
CREATE OR REPLACE FUNCTION public.update_account_scores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  icp_record RECORD;
  score_result jsonb;
BEGIN
  -- Update scores for all ICPs when account is updated
  FOR icp_record IN 
    SELECT id FROM icp_profiles WHERE org_id = NEW.org_id AND status = 'active'
  LOOP
    score_result := calculate_account_score(NEW.id, icp_record.id);
    
    INSERT INTO scores (
      org_id, 
      account_external_id, 
      overall, 
      fit, 
      intent, 
      reachability,
      reasons,
      scoring_version
    ) VALUES (
      NEW.org_id,
      NEW.external_id,
      (score_result->>'overall')::integer,
      (score_result->>'fit')::integer,
      (score_result->>'intent')::integer,
      (score_result->>'reachability')::integer,
      score_result->'breakdown',
      '1.0'
    )
    ON CONFLICT (org_id, account_external_id) 
    DO UPDATE SET
      overall = EXCLUDED.overall,
      fit = EXCLUDED.fit,
      intent = EXCLUDED.intent,
      reachability = EXCLUDED.reachability,
      reasons = EXCLUDED.reasons,
      computed_at = now();
  END LOOP;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for automatic scoring
DROP TRIGGER IF EXISTS trigger_update_account_scores ON accounts;
CREATE TRIGGER trigger_update_account_scores
  AFTER INSERT OR UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_account_scores();