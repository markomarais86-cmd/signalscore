-- Create sample data for demonstration
-- Sample organizations data (will be created by triggers, but we need sample accounts)

-- Insert sample accounts for the current user's organization
INSERT INTO public.accounts (org_id, external_id, name, domain, industry_raw, industry_norm, employee_count, revenue_range, country) VALUES
-- Get current user's org_id and insert sample data
((SELECT get_current_user_org_id()), 'ACC001', 'TechCorp Solutions', 'techcorp.com', 'Software Development', 'Technology', 250, '$10M-$50M', 'United States'),
((SELECT get_current_user_org_id()), 'ACC002', 'DataFlow Industries', 'dataflow.io', 'Data Analytics', 'Technology', 180, '$5M-$10M', 'Canada'),
((SELECT get_current_user_org_id()), 'ACC003', 'CloudScale Systems', 'cloudscale.net', 'Cloud Services', 'Technology', 450, '$50M-$100M', 'United Kingdom'),
((SELECT get_current_user_org_id()), 'ACC004', 'FinTech Innovations', 'fintech-inn.com', 'Financial Technology', 'Financial Services', 320, '$25M-$50M', 'Germany'),
((SELECT get_current_user_org_id()), 'ACC005', 'RetailMax Group', 'retailmax.com', 'E-commerce', 'Retail', 1200, '$100M-$500M', 'United States'),
((SELECT get_current_user_org_id()), 'ACC006', 'HealthTech Partners', 'healthtech.com', 'Healthcare Technology', 'Healthcare', 85, '$1M-$5M', 'Australia'),
((SELECT get_current_user_org_id()), 'ACC007', 'ManufacturingPro', 'mfgpro.com', 'Industrial Manufacturing', 'Manufacturing', 800, '$50M-$100M', 'Japan'),
((SELECT get_current_user_org_id()), 'ACC008', 'EdTech Solutions', 'edtech-sol.com', 'Educational Technology', 'Education', 150, '$5M-$10M', 'France'),
((SELECT get_current_user_org_id()), 'ACC009', 'GreenEnergy Corp', 'greenenergy.com', 'Renewable Energy', 'Energy', 400, '$25M-$50M', 'Netherlands'),
((SELECT get_current_user_org_id()), 'ACC010', 'LogisticsTech', 'logisticstech.com', 'Supply Chain Technology', 'Logistics', 275, '$10M-$25M', 'Singapore')
ON CONFLICT (org_id, external_id) DO NOTHING;

-- Insert sample contacts
INSERT INTO public.contacts (org_id, external_id, account_external_id, first_name, last_name, email, title_raw, persona, level, country) VALUES
((SELECT get_current_user_org_id()), 'CONT001', 'ACC001', 'Sarah', 'Chen', 'sarah.chen@techcorp.com', 'Chief Technology Officer', 'Technical Decision Maker', 'C-Level', 'United States'),
((SELECT get_current_user_org_id()), 'CONT002', 'ACC001', 'Michael', 'Rodriguez', 'mike.rodriguez@techcorp.com', 'VP of Engineering', 'Technical Decision Maker', 'VP', 'United States'),
((SELECT get_current_user_org_id()), 'CONT003', 'ACC002', 'Emma', 'Thompson', 'emma.thompson@dataflow.io', 'Head of Data Science', 'Technical Decision Maker', 'Director', 'Canada'),
((SELECT get_current_user_org_id()), 'CONT004', 'ACC003', 'James', 'Wilson', 'james.wilson@cloudscale.net', 'Chief Information Officer', 'IT Decision Maker', 'C-Level', 'United Kingdom'),
((SELECT get_current_user_org_id()), 'CONT005', 'ACC004', 'Anna', 'Mueller', 'anna.mueller@fintech-inn.com', 'Head of Technology', 'Technical Decision Maker', 'Director', 'Germany'),
((SELECT get_current_user_org_id()), 'CONT006', 'ACC005', 'David', 'Kim', 'david.kim@retailmax.com', 'VP of Digital Innovation', 'Business Decision Maker', 'VP', 'United States'),
((SELECT get_current_user_org_id()), 'CONT007', 'ACC006', 'Lisa', 'Anderson', 'lisa.anderson@healthtech.com', 'Product Manager', 'Technical Influencer', 'Manager', 'Australia'),
((SELECT get_current_user_org_id()), 'CONT008', 'ACC007', 'Hiroshi', 'Tanaka', 'hiroshi.tanaka@mfgpro.com', 'Director of IT', 'IT Decision Maker', 'Director', 'Japan'),
((SELECT get_current_user_org_id()), 'CONT009', 'ACC008', 'Marie', 'Dubois', 'marie.dubois@edtech-sol.com', 'Chief Product Officer', 'Business Decision Maker', 'C-Level', 'France'),
((SELECT get_current_user_org_id()), 'CONT010', 'ACC009', 'Hans', 'van der Berg', 'hans.vdberg@greenenergy.com', 'Head of Digital Transformation', 'Technical Decision Maker', 'Director', 'Netherlands')
ON CONFLICT (org_id, external_id) DO NOTHING;

-- Insert sample ICP profile
INSERT INTO public.icp_profiles (
  org_id, 
  name, 
  description, 
  industries, 
  sub_industries,
  company_sizes, 
  revenue_ranges, 
  geographies,
  persona_job_titles,
  persona_seniority_levels,
  persona_departments,
  status,
  confidence_score,
  tam_estimate,
  match_count
) VALUES (
  (SELECT get_current_user_org_id()),
  'Enterprise Technology Companies',
  'Mid-to-large technology companies with strong digital transformation initiatives',
  ARRAY['Technology', 'Software Development', 'Data Analytics', 'Cloud Services', 'Financial Technology'],
  ARRAY['SaaS', 'Enterprise Software', 'Cloud Infrastructure', 'AI/ML Platforms'],
  ARRAY[200, 500, 1000],
  ARRAY['$10M-$50M', '$50M-$100M', '$100M-$500M'],
  ARRAY['United States', 'Canada', 'United Kingdom', 'Germany'],
  ARRAY['Chief Technology Officer', 'VP of Engineering', 'Head of Data Science', 'Chief Information Officer'],
  ARRAY['C-Level', 'VP', 'Director'],
  ARRAY['Engineering', 'IT', 'Data Science', 'Product'],
  'active',
  85,
  45000000,
  6
) ON CONFLICT DO NOTHING;

-- Insert sample scores for the accounts
INSERT INTO public.scores (org_id, account_external_id, overall, fit, intent, reachability, reasons, scoring_version) VALUES
((SELECT get_current_user_org_id()), 'ACC001', 92, 88, 95, 90, '{"industry_match": true, "size_match": true, "revenue_match": true, "geography_match": true}', 'icp_v2.0'),
((SELECT get_current_user_org_id()), 'ACC002', 85, 82, 88, 85, '{"industry_match": true, "size_match": false, "revenue_match": true, "geography_match": true}', 'icp_v2.0'),
((SELECT get_current_user_org_id()), 'ACC003', 89, 90, 85, 92, '{"industry_match": true, "size_match": true, "revenue_match": true, "geography_match": true}', 'icp_v2.0'),
((SELECT get_current_user_org_id()), 'ACC004', 78, 80, 75, 80, '{"industry_match": true, "size_match": true, "revenue_match": true, "geography_match": true}', 'icp_v2.0'),
((SELECT get_current_user_org_id()), 'ACC005', 45, 40, 50, 45, '{"industry_match": false, "size_match": true, "revenue_match": true, "geography_match": true}', 'icp_v2.0'),
((SELECT get_current_user_org_id()), 'ACC006', 35, 30, 40, 35, '{"industry_match": false, "size_match": false, "revenue_match": false, "geography_match": true}', 'icp_v2.0'),
((SELECT get_current_user_org_id()), 'ACC007', 55, 60, 50, 55, '{"industry_match": false, "size_match": true, "revenue_match": true, "geography_match": false}', 'icp_v2.0'),
((SELECT get_current_user_org_id()), 'ACC008', 72, 70, 75, 70, '{"industry_match": true, "size_match": false, "revenue_match": true, "geography_match": false}', 'icp_v2.0'),
((SELECT get_current_user_org_id()), 'ACC009', 68, 65, 70, 70, '{"industry_match": false, "size_match": true, "revenue_match": true, "geography_match": false}', 'icp_v2.0'),
((SELECT get_current_user_org_id()), 'ACC010', 62, 60, 65, 60, '{"industry_match": false, "size_match": true, "revenue_match": true, "geography_match": false}', 'icp_v2.0')
ON CONFLICT (org_id, account_external_id) DO NOTHING;

-- Insert sample leads data
INSERT INTO public.leads (org_id, external_id, name, status) VALUES
((SELECT get_current_user_org_id()), 'LEAD001', 'TechCorp Solutions - Enterprise Deal', 'qualified'),
((SELECT get_current_user_org_id()), 'LEAD002', 'DataFlow Industries - Analytics Platform', 'open'),
((SELECT get_current_user_org_id()), 'LEAD003', 'CloudScale Systems - Infrastructure Upgrade', 'qualified'),
((SELECT get_current_user_org_id()), 'LEAD004', 'FinTech Innovations - API Integration', 'qualified'),
((SELECT get_current_user_org_id()), 'LEAD005', 'RetailMax Group - Digital Transformation', 'nurturing'),
((SELECT get_current_user_org_id()), 'LEAD006', 'HealthTech Partners - Compliance Solution', 'open'),
((SELECT get_current_user_org_id()), 'LEAD007', 'ManufacturingPro - IoT Platform', 'open'),
((SELECT get_current_user_org_id()), 'LEAD008', 'EdTech Solutions - Learning Platform', 'qualified'),
((SELECT get_current_user_org_id()), 'LEAD009', 'GreenEnergy Corp - Monitoring System', 'nurturing'),
((SELECT get_current_user_org_id()), 'LEAD010', 'LogisticsTech - Supply Chain Optimization', 'open')
ON CONFLICT (org_id, external_id) DO NOTHING;

-- Create materialized views for reporting
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_score_distribution AS
SELECT 
  org_id,
  CASE 
    WHEN overall >= 90 THEN '90-100'
    WHEN overall >= 80 THEN '80-89'
    WHEN overall >= 70 THEN '70-79'
    WHEN overall >= 60 THEN '60-69'
    WHEN overall >= 50 THEN '50-59'
    ELSE '0-49'
  END as score_bucket,
  COUNT(*) as account_count
FROM public.scores
GROUP BY org_id, score_bucket;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_leads_by_week AS
WITH weeks AS (
  SELECT 
    org_id,
    DATE_TRUNC('week', created_at) as week_start,
    COUNT(*) as total_leads,
    COUNT(CASE WHEN status IN ('qualified', 'won') THEN 1 END) as qualified_leads
  FROM public.leads
  WHERE created_at >= CURRENT_DATE - INTERVAL '12 weeks'
  GROUP BY org_id, DATE_TRUNC('week', created_at)
)
SELECT 
  org_id,
  week_start,
  total_leads,
  qualified_leads
FROM weeks
ORDER BY week_start;

-- Grant permissions on materialized views
GRANT SELECT ON public.mv_score_distribution TO authenticated;
GRANT SELECT ON public.mv_leads_by_week TO authenticated;