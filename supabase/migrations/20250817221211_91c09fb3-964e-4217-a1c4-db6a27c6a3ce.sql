-- Create organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_profiles table 
CREATE TABLE public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create ICP profiles table
CREATE TABLE public.icp_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industries TEXT[],
  company_sizes INTEGER[],
  revenue_ranges TEXT[],
  geographies TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create accounts table
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT,
  domain TEXT,
  industry_raw TEXT,
  industry_norm TEXT,
  employee_count INTEGER,
  revenue_range TEXT,
  country TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(org_id, external_id)
);

-- Create contacts table
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  account_external_id TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  title_raw TEXT,
  persona TEXT,
  level TEXT,
  country TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(org_id, external_id)
);

-- Create signals_raw table
CREATE TABLE public.signals_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_external_id TEXT,
  type TEXT,
  vendor TEXT,
  value JSONB,
  observed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create scores table
CREATE TABLE public.scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_external_id TEXT,
  overall INTEGER,
  fit INTEGER,
  intent INTEGER,
  reachability INTEGER,
  reasons JSONB,
  scoring_version TEXT,
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(org_id, account_external_id, scoring_version)
);

-- Create sync_jobs table
CREATE TABLE public.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_system TEXT,
  job_type TEXT,
  received INTEGER DEFAULT 0,
  inserted INTEGER DEFAULT 0,
  updated INTEGER DEFAULT 0,
  rejected INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE
);

-- Create rejections table
CREATE TABLE public.rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.sync_jobs(id) ON DELETE CASCADE,
  row_index INTEGER,
  reason TEXT,
  raw JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor TEXT,
  action TEXT,
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icp_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rejections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create security definer function to get user's org_id
CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT org_id FROM public.user_profiles WHERE user_id = auth.uid();
$$;

-- Create security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role = 'admin' FROM public.user_profiles WHERE user_id = auth.uid();
$$;

-- RLS policies for organizations
CREATE POLICY "Users can view their organization" ON public.organizations
  FOR SELECT USING (id = public.get_current_user_org_id());

-- RLS policies for user_profiles
CREATE POLICY "Users can view profiles in their org" ON public.user_profiles
  FOR SELECT USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE USING (user_id = auth.uid());

-- RLS policies for icp_profiles
CREATE POLICY "Users can view ICPs in their org" ON public.icp_profiles
  FOR SELECT USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Admins can insert ICPs" ON public.icp_profiles
  FOR INSERT WITH CHECK (org_id = public.get_current_user_org_id() AND public.is_current_user_admin());

CREATE POLICY "Admins can update ICPs" ON public.icp_profiles
  FOR UPDATE USING (org_id = public.get_current_user_org_id() AND public.is_current_user_admin());

-- RLS policies for accounts
CREATE POLICY "Users can view accounts in their org" ON public.accounts
  FOR SELECT USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can insert accounts" ON public.accounts
  FOR INSERT WITH CHECK (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can update accounts" ON public.accounts
  FOR UPDATE USING (org_id = public.get_current_user_org_id());

-- RLS policies for contacts
CREATE POLICY "Users can view contacts in their org" ON public.contacts
  FOR SELECT USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can insert contacts" ON public.contacts
  FOR INSERT WITH CHECK (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can update contacts" ON public.contacts
  FOR UPDATE USING (org_id = public.get_current_user_org_id());

-- RLS policies for signals_raw
CREATE POLICY "Users can view signals in their org" ON public.signals_raw
  FOR SELECT USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can insert signals" ON public.signals_raw
  FOR INSERT WITH CHECK (org_id = public.get_current_user_org_id());

-- RLS policies for scores
CREATE POLICY "Users can view scores in their org" ON public.scores
  FOR SELECT USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can insert scores" ON public.scores
  FOR INSERT WITH CHECK (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can update scores" ON public.scores
  FOR UPDATE USING (org_id = public.get_current_user_org_id());

-- RLS policies for sync_jobs
CREATE POLICY "Users can view sync jobs in their org" ON public.sync_jobs
  FOR SELECT USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can insert sync jobs" ON public.sync_jobs
  FOR INSERT WITH CHECK (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can update sync jobs" ON public.sync_jobs
  FOR UPDATE USING (org_id = public.get_current_user_org_id());

-- RLS policies for rejections
CREATE POLICY "Users can view rejections in their org" ON public.rejections
  FOR SELECT USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can insert rejections" ON public.rejections
  FOR INSERT WITH CHECK (org_id = public.get_current_user_org_id());

-- RLS policies for audit_logs
CREATE POLICY "Users can view audit logs in their org" ON public.audit_logs
  FOR SELECT USING (org_id = public.get_current_user_org_id());

CREATE POLICY "Users can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (org_id = public.get_current_user_org_id());

-- Admin delete policies
CREATE POLICY "Admins can delete ICPs" ON public.icp_profiles
  FOR DELETE USING (org_id = public.get_current_user_org_id() AND public.is_current_user_admin());

CREATE POLICY "Admins can delete accounts" ON public.accounts
  FOR DELETE USING (org_id = public.get_current_user_org_id() AND public.is_current_user_admin());

CREATE POLICY "Admins can delete contacts" ON public.contacts
  FOR DELETE USING (org_id = public.get_current_user_org_id() AND public.is_current_user_admin());

CREATE POLICY "Admins can delete signals" ON public.signals_raw
  FOR DELETE USING (org_id = public.get_current_user_org_id() AND public.is_current_user_admin());

CREATE POLICY "Admins can delete scores" ON public.scores
  FOR DELETE USING (org_id = public.get_current_user_org_id() AND public.is_current_user_admin());

CREATE POLICY "Admins can delete sync jobs" ON public.sync_jobs
  FOR DELETE USING (org_id = public.get_current_user_org_id() AND public.is_current_user_admin());

CREATE POLICY "Admins can delete rejections" ON public.rejections
  FOR DELETE USING (org_id = public.get_current_user_org_id() AND public.is_current_user_admin());

CREATE POLICY "Admins can delete audit logs" ON public.audit_logs
  FOR DELETE USING (org_id = public.get_current_user_org_id() AND public.is_current_user_admin());

-- Create materialized views for reporting
CREATE MATERIALIZED VIEW public.mv_score_distribution AS
SELECT 
  org_id,
  CASE 
    WHEN overall BETWEEN 0 AND 10 THEN '0-10'
    WHEN overall BETWEEN 11 AND 20 THEN '11-20'
    WHEN overall BETWEEN 21 AND 30 THEN '21-30'
    WHEN overall BETWEEN 31 AND 40 THEN '31-40'
    WHEN overall BETWEEN 41 AND 50 THEN '41-50'
    WHEN overall BETWEEN 51 AND 60 THEN '51-60'
    WHEN overall BETWEEN 61 AND 70 THEN '61-70'
    WHEN overall BETWEEN 71 AND 80 THEN '71-80'
    WHEN overall BETWEEN 81 AND 90 THEN '81-90'
    WHEN overall BETWEEN 91 AND 100 THEN '91-100'
  END as score_bucket,
  COUNT(*) as account_count
FROM public.scores
GROUP BY org_id, 
  CASE 
    WHEN overall BETWEEN 0 AND 10 THEN '0-10'
    WHEN overall BETWEEN 11 AND 20 THEN '11-20'
    WHEN overall BETWEEN 21 AND 30 THEN '21-30'
    WHEN overall BETWEEN 31 AND 40 THEN '31-40'
    WHEN overall BETWEEN 41 AND 50 THEN '41-50'
    WHEN overall BETWEEN 51 AND 60 THEN '51-60'
    WHEN overall BETWEEN 61 AND 70 THEN '61-70'
    WHEN overall BETWEEN 71 AND 80 THEN '71-80'
    WHEN overall BETWEEN 81 AND 90 THEN '81-90'
    WHEN overall BETWEEN 91 AND 100 THEN '91-100'
  END;

CREATE MATERIALIZED VIEW public.mv_leads_by_week AS
SELECT 
  a.org_id,
  DATE_TRUNC('week', a.updated_at) as week_start,
  COUNT(*) as total_leads,
  COUNT(CASE WHEN s.overall >= 70 THEN 1 END) as qualified_leads
FROM public.accounts a
LEFT JOIN public.scores s ON a.org_id = s.org_id AND a.external_id = s.account_external_id
WHERE a.updated_at >= NOW() - INTERVAL '12 weeks'
GROUP BY a.org_id, DATE_TRUNC('week', a.updated_at)
ORDER BY week_start;

-- Create indexes for performance
CREATE INDEX idx_accounts_org_id ON public.accounts(org_id);
CREATE INDEX idx_contacts_org_id ON public.contacts(org_id);
CREATE INDEX idx_scores_org_id ON public.scores(org_id);
CREATE INDEX idx_accounts_updated_at ON public.accounts(updated_at);
CREATE INDEX idx_scores_account ON public.scores(org_id, account_external_id);

-- Create function to refresh materialized views
CREATE OR REPLACE FUNCTION public.refresh_reporting_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.mv_score_distribution;
  REFRESH MATERIALIZED VIEW public.mv_leads_by_week;
END;
$$;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY definer SET search_path = public
AS $$
BEGIN
  -- Create a default organization for new users if they don't have one
  INSERT INTO public.user_profiles (user_id, org_id, full_name, role)
  VALUES (
    NEW.id,
    gen_random_uuid(), -- This will need to be handled properly in the app
    NEW.raw_user_meta_data ->> 'full_name',
    'user'
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();