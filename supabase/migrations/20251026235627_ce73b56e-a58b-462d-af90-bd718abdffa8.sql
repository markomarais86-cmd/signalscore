-- Step 5: Update generate_sample_data to include Phase 3 data

CREATE OR REPLACE FUNCTION public.generate_sample_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  user_org_id uuid;
  result jsonb;
  accounts_inserted integer := 0;
  contacts_inserted integer := 0;
  scores_inserted integer := 0;
  icp_inserted integer := 0;
  leads_inserted integer := 0;
  pipeline_inserted integer := 0;
  capital_inserted integer := 0;
BEGIN
  user_org_id := get_current_user_org_id();
  
  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User not found or not associated with an organization';
  END IF;

  -- Insert sample accounts (existing)
  INSERT INTO public.accounts (org_id, external_id, name, domain, industry_raw, industry_norm, employee_count, revenue_range, country) VALUES
  (user_org_id, 'ACC001', 'TechCorp Solutions', 'techcorp.com', 'Software Development', 'Technology', 250, '$10M-$50M', 'United States'),
  (user_org_id, 'ACC002', 'DataFlow Industries', 'dataflow.io', 'Data Analytics', 'Technology', 180, '$5M-$10M', 'Canada'),
  (user_org_id, 'ACC003', 'CloudScale Systems', 'cloudscale.net', 'Cloud Services', 'Technology', 450, '$50M-$100M', 'United Kingdom'),
  (user_org_id, 'ACC004', 'FinTech Innovations', 'fintech-inn.com', 'Financial Technology', 'Financial Services', 320, '$25M-$50M', 'Germany'),
  (user_org_id, 'ACC005', 'RetailMax Group', 'retailmax.com', 'E-commerce', 'Retail', 1200, '$100M-$500M', 'United States'),
  (user_org_id, 'ACC006', 'HealthTech Partners', 'healthtech.com', 'Healthcare Technology', 'Healthcare', 85, '$1M-$5M', 'Australia'),
  (user_org_id, 'ACC007', 'ManufacturingPro', 'mfgpro.com', 'Industrial Manufacturing', 'Manufacturing', 800, '$50M-$100M', 'Japan'),
  (user_org_id, 'ACC008', 'EdTech Solutions', 'edtech-sol.com', 'Educational Technology', 'Education', 150, '$5M-$10M', 'France'),
  (user_org_id, 'ACC009', 'GreenEnergy Corp', 'greenenergy.com', 'Renewable Energy', 'Energy', 400, '$25M-$50M', 'Netherlands'),
  (user_org_id, 'ACC010', 'LogisticsTech', 'logisticstech.com', 'Supply Chain Technology', 'Logistics', 275, '$10M-$25M', 'Singapore')
  ON CONFLICT (org_id, external_id) DO NOTHING;
  
  GET DIAGNOSTICS accounts_inserted = ROW_COUNT;

  -- Insert sample contacts (existing)
  INSERT INTO public.contacts (org_id, external_id, account_external_id, first_name, last_name, email, title_raw, persona, level, country) VALUES
  (user_org_id, 'CONT001', 'ACC001', 'Sarah', 'Chen', 'sarah.chen@techcorp.com', 'Chief Technology Officer', 'Technical Decision Maker', 'C-Level', 'United States'),
  (user_org_id, 'CONT002', 'ACC001', 'Michael', 'Rodriguez', 'mike.rodriguez@techcorp.com', 'VP of Engineering', 'Technical Decision Maker', 'VP', 'United States'),
  (user_org_id, 'CONT003', 'ACC002', 'Emma', 'Thompson', 'emma.thompson@dataflow.io', 'Head of Data Science', 'Technical Decision Maker', 'Director', 'Canada'),
  (user_org_id, 'CONT004', 'ACC003', 'James', 'Wilson', 'james.wilson@cloudscale.net', 'Chief Information Officer', 'IT Decision Maker', 'C-Level', 'United Kingdom'),
  (user_org_id, 'CONT005', 'ACC004', 'Anna', 'Mueller', 'anna.mueller@fintech-inn.com', 'Head of Technology', 'Technical Decision Maker', 'Director', 'Germany')
  ON CONFLICT (org_id, external_id) DO NOTHING;
  
  GET DIAGNOSTICS contacts_inserted = ROW_COUNT;

  -- Insert sample ICP profile (existing)
  INSERT INTO public.icp_profiles (
    org_id, name, description, industries, sub_industries, company_sizes, revenue_ranges, geographies,
    persona_job_titles, persona_seniority_levels, persona_departments, status, confidence_score, tam_estimate, match_count
  ) VALUES (
    user_org_id, 'Enterprise Technology Companies',
    'Mid-to-large technology companies with strong digital transformation initiatives',
    ARRAY['Technology', 'Software Development', 'Data Analytics', 'Cloud Services', 'Financial Technology'],
    ARRAY['SaaS', 'Enterprise Software', 'Cloud Infrastructure', 'AI/ML Platforms'],
    ARRAY[200, 500, 1000], ARRAY['$10M-$50M', '$50M-$100M', '$100M-$500M'],
    ARRAY['United States', 'Canada', 'United Kingdom', 'Germany'],
    ARRAY['Chief Technology Officer', 'VP of Engineering', 'Head of Data Science', 'Chief Information Officer'],
    ARRAY['C-Level', 'VP', 'Director'], ARRAY['Engineering', 'IT', 'Data Science', 'Product'],
    'active', 85, 45000000, 6
  ) ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS icp_inserted = ROW_COUNT;

  -- Insert sample scores (existing)
  INSERT INTO public.scores (org_id, account_external_id, overall, fit, intent, reachability, reasons, scoring_version) VALUES
  (user_org_id, 'ACC001', 92, 88, 95, 90, '{"industry_match": true, "size_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC002', 85, 82, 88, 85, '{"industry_match": true, "size_match": false}', 'icp_v2.0'),
  (user_org_id, 'ACC003', 89, 90, 85, 92, '{"industry_match": true, "size_match": true}', 'icp_v2.0')
  ON CONFLICT (org_id, account_external_id) DO NOTHING;
  
  GET DIAGNOSTICS scores_inserted = ROW_COUNT;

  -- Insert sample leads (existing)
  INSERT INTO public."Leads" (org_id, external_id, name, status, account_external_id) VALUES
  (user_org_id, 'LEAD001', 'TechCorp Solutions - Enterprise Deal', 'qualified', 'ACC001'),
  (user_org_id, 'LEAD002', 'DataFlow Industries - Analytics Platform', 'open', 'ACC002')
  ON CONFLICT (org_id, external_id) DO NOTHING;
  
  GET DIAGNOSTICS leads_inserted = ROW_COUNT;

  -- NEW: Insert Phase 3 sample pipeline stages
  INSERT INTO public.pipeline_stages (org_id, account_external_id, stage, entered_at, exited_at, duration_hours, conversion_value) VALUES
  (user_org_id, 'ACC001', 'lead', now() - interval '90 days', now() - interval '75 days', 360, NULL),
  (user_org_id, 'ACC001', 'qualified', now() - interval '75 days', now() - interval '60 days', 360, NULL),
  (user_org_id, 'ACC001', 'meeting', now() - interval '60 days', now() - interval '50 days', 240, NULL),
  (user_org_id, 'ACC001', 'proposal', now() - interval '50 days', now() - interval '30 days', 480, NULL),
  (user_org_id, 'ACC001', 'negotiation', now() - interval '30 days', now() - interval '10 days', 480, NULL),
  (user_org_id, 'ACC001', 'closed_won', now() - interval '10 days', NULL, NULL, 150000),
  (user_org_id, 'ACC002', 'lead', now() - interval '60 days', now() - interval '50 days', 240, NULL),
  (user_org_id, 'ACC002', 'qualified', now() - interval '50 days', now() - interval '40 days', 240, NULL),
  (user_org_id, 'ACC002', 'meeting', now() - interval '40 days', now() - interval '30 days', 240, NULL),
  (user_org_id, 'ACC002', 'proposal', now() - interval '30 days', NULL, NULL, NULL),
  (user_org_id, 'ACC003', 'lead', now() - interval '45 days', now() - interval '35 days', 240, NULL),
  (user_org_id, 'ACC003', 'qualified', now() - interval '35 days', now() - interval '25 days', 240, NULL),
  (user_org_id, 'ACC003', 'meeting', now() - interval '25 days', NULL, NULL, NULL)
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS pipeline_inserted = ROW_COUNT;

  -- NEW: Insert Phase 3 sample capital tracking (12 months)
  INSERT INTO public.capital_tracking (org_id, period_start, period_end, sales_investment, marketing_investment, pipeline_value, revenue_generated) VALUES
  (user_org_id, (date_trunc('month', now()) - interval '12 months')::date, (date_trunc('month', now()) - interval '11 months' - interval '1 day')::date, 50000, 30000, 250000, 45000),
  (user_org_id, (date_trunc('month', now()) - interval '11 months')::date, (date_trunc('month', now()) - interval '10 months' - interval '1 day')::date, 52000, 32000, 280000, 52000),
  (user_org_id, (date_trunc('month', now()) - interval '10 months')::date, (date_trunc('month', now()) - interval '9 months' - interval '1 day')::date, 55000, 35000, 320000, 65000),
  (user_org_id, (date_trunc('month', now()) - interval '9 months')::date, (date_trunc('month', now()) - interval '8 months' - interval '1 day')::date, 58000, 38000, 350000, 72000),
  (user_org_id, (date_trunc('month', now()) - interval '8 months')::date, (date_trunc('month', now()) - interval '7 months' - interval '1 day')::date, 60000, 40000, 380000, 85000),
  (user_org_id, (date_trunc('month', now()) - interval '7 months')::date, (date_trunc('month', now()) - interval '6 months' - interval '1 day')::date, 62000, 42000, 420000, 95000),
  (user_org_id, (date_trunc('month', now()) - interval '6 months')::date, (date_trunc('month', now()) - interval '5 months' - interval '1 day')::date, 65000, 45000, 450000, 110000),
  (user_org_id, (date_trunc('month', now()) - interval '5 months')::date, (date_trunc('month', now()) - interval '4 months' - interval '1 day')::date, 68000, 48000, 480000, 125000),
  (user_org_id, (date_trunc('month', now()) - interval '4 months')::date, (date_trunc('month', now()) - interval '3 months' - interval '1 day')::date, 70000, 50000, 520000, 140000),
  (user_org_id, (date_trunc('month', now()) - interval '3 months')::date, (date_trunc('month', now()) - interval '2 months' - interval '1 day')::date, 72000, 52000, 550000, 155000),
  (user_org_id, (date_trunc('month', now()) - interval '2 months')::date, (date_trunc('month', now()) - interval '1 month' - interval '1 day')::date, 75000, 55000, 600000, 170000),
  (user_org_id, (date_trunc('month', now()) - interval '1 month')::date, (date_trunc('month', now()) - interval '1 day')::date, 78000, 58000, 650000, 190000)
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS capital_inserted = ROW_COUNT;

  -- Refresh materialized views
  REFRESH MATERIALIZED VIEW public.mv_score_distribution;
  REFRESH MATERIALIZED VIEW public.mv_leads_by_week;

  result := jsonb_build_object(
    'success', true,
    'accounts_inserted', accounts_inserted,
    'contacts_inserted', contacts_inserted,
    'icp_inserted', icp_inserted,
    'scores_inserted', scores_inserted,
    'leads_inserted', leads_inserted,
    'pipeline_stages_inserted', pipeline_inserted,
    'capital_tracking_inserted', capital_inserted,
    'organization_id', user_org_id
  );

  RETURN result;
END;
$function$;