-- Enhanced ICP Profiles Schema
-- Add comprehensive fields for advanced ICP targeting and management

-- Add persona targeting fields
ALTER TABLE public.icp_profiles 
ADD COLUMN IF NOT EXISTS persona_job_titles text[],
ADD COLUMN IF NOT EXISTS persona_seniority_levels text[],
ADD COLUMN IF NOT EXISTS persona_departments text[],
ADD COLUMN IF NOT EXISTS persona_decision_roles text[];

-- Add detailed industry and company classification
ALTER TABLE public.icp_profiles 
ADD COLUMN IF NOT EXISTS sub_industries text[],
ADD COLUMN IF NOT EXISTS company_stages text[];

-- Add technographics and firmographics
ALTER TABLE public.icp_profiles 
ADD COLUMN IF NOT EXISTS tech_stack text[],
ADD COLUMN IF NOT EXISTS growth_stage text[],
ADD COLUMN IF NOT EXISTS funding_status text[];

-- Add advanced geographic targeting
ALTER TABLE public.icp_profiles 
ADD COLUMN IF NOT EXISTS regions text[],
ADD COLUMN IF NOT EXISTS cities text[],
ADD COLUMN IF NOT EXISTS timezones text[];

-- Add buying signals and intent data
ALTER TABLE public.icp_profiles 
ADD COLUMN IF NOT EXISTS intent_signals text[],
ADD COLUMN IF NOT EXISTS buying_triggers text[];

-- Add exclusion criteria
ALTER TABLE public.icp_profiles 
ADD COLUMN IF NOT EXISTS excluded_companies text[],
ADD COLUMN IF NOT EXISTS excluded_industries text[];

-- Add seasonal and budget patterns
ALTER TABLE public.icp_profiles 
ADD COLUMN IF NOT EXISTS seasonal_patterns text[],
ADD COLUMN IF NOT EXISTS budget_indicators text[];

-- Add metadata and performance tracking
ALTER TABLE public.icp_profiles 
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS use_case text,
ADD COLUMN IF NOT EXISTS template_source text,
ADD COLUMN IF NOT EXISTS confidence_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS match_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS tam_estimate bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS last_validated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS tags text[];

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_icp_profiles_status ON public.icp_profiles(org_id, status);
CREATE INDEX IF NOT EXISTS idx_icp_profiles_industries ON public.icp_profiles USING GIN(industries);
CREATE INDEX IF NOT EXISTS idx_icp_profiles_sub_industries ON public.icp_profiles USING GIN(sub_industries);
CREATE INDEX IF NOT EXISTS idx_icp_profiles_tags ON public.icp_profiles USING GIN(tags);

-- Create ICP templates table for pre-built templates
CREATE TABLE IF NOT EXISTS public.icp_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text NOT NULL,
  industries text[],
  sub_industries text[],
  company_sizes integer[],
  revenue_ranges text[],
  geographies text[],
  persona_job_titles text[],
  persona_seniority_levels text[],
  persona_departments text[],
  company_stages text[],
  tech_stack text[],
  use_cases text[],
  is_public boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on templates
ALTER TABLE public.icp_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for templates
CREATE POLICY "Public templates are viewable by everyone" 
ON public.icp_templates 
FOR SELECT 
USING (is_public = true);

CREATE POLICY "Users can create private templates" 
ON public.icp_templates 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own templates" 
ON public.icp_templates 
FOR UPDATE 
USING (created_by = auth.uid());

-- Insert some default templates
INSERT INTO public.icp_templates (name, description, category, industries, sub_industries, company_sizes, revenue_ranges, geographies, persona_job_titles, persona_seniority_levels, persona_departments, company_stages, tech_stack, use_cases) VALUES
('Enterprise SaaS', 'Large software companies seeking enterprise solutions', 'Technology', 
 ARRAY['Technology'], ARRAY['SaaS', 'Enterprise Software'], ARRAY[1000, 5000, 10000], 
 ARRAY['$100M-$500M', '$500M+'], ARRAY['United States', 'Canada', 'United Kingdom'],
 ARRAY['CTO', 'VP Engineering', 'Head of IT', 'Chief Digital Officer'], 
 ARRAY['Executive', 'Senior'], ARRAY['Engineering', 'IT', 'Product'],
 ARRAY['Scale-up', 'Enterprise'], ARRAY['AWS', 'Salesforce', 'Microsoft Office 365'],
 ARRAY['Digital Transformation', 'Infrastructure Modernization']),

('Mid-Market Healthcare', 'Healthcare organizations ready for digital transformation', 'Healthcare',
 ARRAY['Healthcare'], ARRAY['Hospitals', 'Health Systems', 'Medical Devices'],
 ARRAY[500, 1000, 5000], ARRAY['$25M-$100M', '$100M-$500M'],
 ARRAY['United States', 'Canada', 'Germany', 'United Kingdom'],
 ARRAY['CIO', 'CMIO', 'VP Operations', 'Chief Medical Officer'],
 ARRAY['Executive', 'Senior'], ARRAY['IT', 'Operations', 'Clinical'],
 ARRAY['Established', 'Enterprise'], ARRAY['Epic', 'Cerner', 'Microsoft'],
 ARRAY['EHR Integration', 'Patient Experience', 'Operational Efficiency']),

('Growing Fintech', 'Financial services companies in growth phase', 'Financial Services',
 ARRAY['Financial Services'], ARRAY['Fintech', 'Digital Banking', 'Payment Processing'],
 ARRAY[100, 500, 1000], ARRAY['$5M-$25M', '$25M-$100M'],
 ARRAY['United States', 'United Kingdom', 'Singapore', 'Germany'],
 ARRAY['CTO', 'Head of Product', 'VP Technology', 'Chief Risk Officer'],
 ARRAY['Senior', 'Executive'], ARRAY['Technology', 'Product', 'Risk'],
 ARRAY['Scale-up', 'Growth'], ARRAY['AWS', 'Stripe', 'Plaid'],
 ARRAY['Regulatory Compliance', 'Security Enhancement', 'Customer Experience']);

-- Create ICP validation results table
CREATE TABLE IF NOT EXISTS public.icp_validation_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  icp_id uuid NOT NULL REFERENCES public.icp_profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  validation_date timestamp with time zone DEFAULT now(),
  total_matches integer DEFAULT 0,
  data_quality_score integer DEFAULT 0,
  tam_estimate bigint DEFAULT 0,
  top_matches jsonb,
  validation_details jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on validation results
ALTER TABLE public.icp_validation_results ENABLE ROW LEVEL SECURITY;

-- Create policies for validation results
CREATE POLICY "Users can view validation results in their org" 
ON public.icp_validation_results 
FOR SELECT 
USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can insert validation results" 
ON public.icp_validation_results 
FOR INSERT 
WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Users can update validation results" 
ON public.icp_validation_results 
FOR UPDATE 
USING (org_id = get_current_user_org_id());