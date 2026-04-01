
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
  deals_inserted integer := 0;
  signals_inserted integer := 0;
BEGIN
  user_org_id := get_current_user_org_id();
  
  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'User not found or not associated with an organization';
  END IF;

  -- 30 diverse accounts across industries and geographies
  INSERT INTO public.accounts (org_id, external_id, name, domain, industry_raw, industry_norm, employee_count, revenue_range, country, city, tech_stack, founded_year, data_source) VALUES
  (user_org_id, 'ACC001', 'TechCorp Solutions', 'techcorp.com', 'Software Development', 'Technology', 250, '$10M-$50M', 'United States', 'San Francisco', ARRAY['AWS','React','Node.js','Snowflake'], 2015, 'crm'),
  (user_org_id, 'ACC002', 'DataFlow Industries', 'dataflow.io', 'Data Analytics', 'Technology', 180, '$5M-$10M', 'Canada', 'Toronto', ARRAY['GCP','Python','Databricks'], 2017, 'crm'),
  (user_org_id, 'ACC003', 'CloudScale Systems', 'cloudscale.net', 'Cloud Services', 'Technology', 450, '$50M-$100M', 'United Kingdom', 'London', ARRAY['Azure','Kubernetes','Terraform'], 2012, 'crm'),
  (user_org_id, 'ACC004', 'FinTech Innovations', 'fintech-inn.com', 'Financial Technology', 'Financial Services', 320, '$25M-$50M', 'Germany', 'Berlin', ARRAY['AWS','Java','PostgreSQL'], 2016, 'crm'),
  (user_org_id, 'ACC005', 'RetailMax Group', 'retailmax.com', 'E-commerce', 'Retail', 1200, '$100M-$500M', 'United States', 'New York', ARRAY['Salesforce','Shopify','DataDog'], 2008, 'crm'),
  (user_org_id, 'ACC006', 'HealthTech Partners', 'healthtech.com', 'Healthcare Technology', 'Healthcare', 85, '$1M-$5M', 'Australia', 'Sydney', ARRAY['AWS','React','Python'], 2019, 'database'),
  (user_org_id, 'ACC007', 'ManufacturingPro', 'mfgpro.com', 'Industrial Manufacturing', 'Manufacturing', 800, '$50M-$100M', 'Japan', 'Tokyo', ARRAY['Azure','SAP','IoT'], 2005, 'crm'),
  (user_org_id, 'ACC008', 'EdTech Solutions', 'edtech-sol.com', 'Educational Technology', 'Education', 150, '$5M-$10M', 'France', 'Paris', ARRAY['GCP','React','MongoDB'], 2018, 'database'),
  (user_org_id, 'ACC009', 'GreenEnergy Corp', 'greenenergy.com', 'Renewable Energy', 'Energy', 400, '$25M-$50M', 'Netherlands', 'Amsterdam', ARRAY['AWS','Python','Tableau'], 2014, 'crm'),
  (user_org_id, 'ACC010', 'LogisticsTech', 'logisticstech.com', 'Supply Chain Technology', 'Logistics', 275, '$10M-$25M', 'Singapore', 'Singapore', ARRAY['AWS','Java','Redis'], 2016, 'database'),
  (user_org_id, 'ACC011', 'CyberGuard Inc', 'cyberguard.io', 'Cybersecurity', 'Technology', 190, '$10M-$50M', 'United States', 'Austin', ARRAY['AWS','Go','Kubernetes','Splunk'], 2017, 'crm'),
  (user_org_id, 'ACC012', 'Apex Analytics', 'apexanalytics.com', 'Business Intelligence', 'Technology', 340, '$25M-$50M', 'United Kingdom', 'Manchester', ARRAY['Snowflake','dbt','Looker'], 2015, 'crm'),
  (user_org_id, 'ACC013', 'Nimbus Cloud', 'nimbuscloud.dev', 'Cloud Infrastructure', 'Technology', 520, '$50M-$100M', 'United States', 'Seattle', ARRAY['AWS','Terraform','Docker','DataDog'], 2013, 'crm'),
  (user_org_id, 'ACC014', 'Vertex Payments', 'vertexpay.com', 'Payment Processing', 'Financial Services', 410, '$25M-$50M', 'Canada', 'Vancouver', ARRAY['AWS','Node.js','PostgreSQL'], 2016, 'database'),
  (user_org_id, 'ACC015', 'Prism Health', 'prismhealth.io', 'Digital Health', 'Healthcare', 230, '$10M-$50M', 'United States', 'Boston', ARRAY['GCP','Python','React','FHIR'], 2018, 'crm'),
  (user_org_id, 'ACC016', 'Helix Robotics', 'helixrobotics.com', 'Robotics', 'Manufacturing', 160, '$5M-$10M', 'Germany', 'Munich', ARRAY['Azure','C++','ROS','IoT'], 2019, 'database'),
  (user_org_id, 'ACC017', 'Orbit Media', 'orbitmedia.co', 'AdTech', 'Media', 290, '$10M-$50M', 'United States', 'Chicago', ARRAY['AWS','Python','Spark','Kafka'], 2014, 'crm'),
  (user_org_id, 'ACC018', 'Summit Insurance', 'summitins.com', 'InsurTech', 'Financial Services', 380, '$25M-$50M', 'United Kingdom', 'Edinburgh', ARRAY['Azure','Java','Salesforce'], 2011, 'crm'),
  (user_org_id, 'ACC019', 'Catalyst AI', 'catalystai.dev', 'AI/ML Platforms', 'Technology', 120, '$5M-$10M', 'United States', 'Denver', ARRAY['AWS','Python','PyTorch','MLflow'], 2020, 'database'),
  (user_org_id, 'ACC020', 'Pinnacle SaaS', 'pinnaclesaas.com', 'SaaS Platform', 'Technology', 680, '$50M-$100M', 'United States', 'Miami', ARRAY['AWS','React','Node.js','Redis','Stripe'], 2012, 'crm'),
  (user_org_id, 'ACC021', 'Quantum Data', 'quantumdata.ai', 'Data Engineering', 'Technology', 200, '$10M-$50M', 'France', 'Lyon', ARRAY['GCP','Python','Airflow','BigQuery'], 2018, 'database'),
  (user_org_id, 'ACC022', 'Stratos DevOps', 'stratosdevops.com', 'DevOps Tools', 'Technology', 95, '$1M-$5M', 'Australia', 'Melbourne', ARRAY['AWS','Go','Kubernetes','Prometheus'], 2020, 'database'),
  (user_org_id, 'ACC023', 'Cipher Security', 'ciphersec.io', 'Cybersecurity', 'Technology', 310, '$25M-$50M', 'United States', 'Seattle', ARRAY['AWS','Rust','Kafka','Elasticsearch'], 2016, 'crm'),
  (user_org_id, 'ACC024', 'Flux Commerce', 'fluxcommerce.com', 'Digital Commerce', 'Retail', 470, '$50M-$100M', 'Germany', 'Hamburg', ARRAY['Azure','React','Elasticsearch','Stripe'], 2013, 'crm'),
  (user_org_id, 'ACC025', 'Nova Biotech', 'novabiotech.com', 'Clinical Software', 'Healthcare', 140, '$5M-$10M', 'Canada', 'Montreal', ARRAY['AWS','Python','React','PostgreSQL'], 2019, 'database'),
  (user_org_id, 'ACC026', 'Zeta Streaming', 'zetastream.io', 'Streaming Services', 'Media', 560, '$50M-$100M', 'United States', 'San Francisco', ARRAY['AWS','Go','Kafka','Redis','CDN'], 2015, 'crm'),
  (user_org_id, 'ACC027', 'Vantage Supply', 'vantagesupply.com', 'Supply Chain Tech', 'Manufacturing', 430, '$25M-$50M', 'Japan', 'Osaka', ARRAY['Azure','Java','SAP','IoT'], 2010, 'crm'),
  (user_org_id, 'ACC028', 'Horizon Wealth', 'horizonwealth.com', 'Wealth Management', 'Financial Services', 210, '$10M-$50M', 'Singapore', 'Singapore', ARRAY['AWS','Python','React','PostgreSQL'], 2017, 'database'),
  (user_org_id, 'ACC029', 'Core Platform', 'coreplatform.dev', 'Platform Engineering', 'Technology', 170, '$5M-$10M', 'Netherlands', 'Rotterdam', ARRAY['GCP','Go','Kubernetes','Terraform'], 2019, 'database'),
  (user_org_id, 'ACC030', 'Synth Learning', 'synthlearning.com', 'EdTech', 'Education', 90, '$1M-$5M', 'Brazil', 'São Paulo', ARRAY['AWS','React','Node.js','MongoDB'], 2021, 'database')
  ON CONFLICT (org_id, external_id) DO NOTHING;
  
  GET DIAGNOSTICS accounts_inserted = ROW_COUNT;

  -- 25 contacts across key accounts
  INSERT INTO public.contacts (org_id, external_id, account_external_id, first_name, last_name, email, title_raw, persona, level, country) VALUES
  (user_org_id, 'CONT001', 'ACC001', 'Sarah', 'Chen', 'sarah.chen@techcorp.com', 'Chief Technology Officer', 'Technical Decision Maker', 'C-Level', 'United States'),
  (user_org_id, 'CONT002', 'ACC001', 'Michael', 'Rodriguez', 'mike.rodriguez@techcorp.com', 'VP of Engineering', 'Technical Decision Maker', 'VP', 'United States'),
  (user_org_id, 'CONT003', 'ACC002', 'Emma', 'Thompson', 'emma.thompson@dataflow.io', 'Head of Data Science', 'Technical Decision Maker', 'Director', 'Canada'),
  (user_org_id, 'CONT004', 'ACC003', 'James', 'Wilson', 'james.wilson@cloudscale.net', 'Chief Information Officer', 'IT Decision Maker', 'C-Level', 'United Kingdom'),
  (user_org_id, 'CONT005', 'ACC004', 'Anna', 'Mueller', 'anna.mueller@fintech-inn.com', 'Head of Technology', 'Technical Decision Maker', 'Director', 'Germany'),
  (user_org_id, 'CONT006', 'ACC005', 'Robert', 'Harris', 'robert.harris@retailmax.com', 'CTO', 'Technical Decision Maker', 'C-Level', 'United States'),
  (user_org_id, 'CONT007', 'ACC005', 'Jennifer', 'Lee', 'jennifer.lee@retailmax.com', 'VP of Digital', 'Business Decision Maker', 'VP', 'United States'),
  (user_org_id, 'CONT008', 'ACC011', 'David', 'Park', 'david.park@cyberguard.io', 'Chief Security Officer', 'Technical Decision Maker', 'C-Level', 'United States'),
  (user_org_id, 'CONT009', 'ACC012', 'Lisa', 'Brown', 'lisa.brown@apexanalytics.com', 'VP of Analytics', 'Technical Decision Maker', 'VP', 'United Kingdom'),
  (user_org_id, 'CONT010', 'ACC013', 'William', 'Taylor', 'william.taylor@nimbuscloud.dev', 'Director of Platform', 'Technical Decision Maker', 'Director', 'United States'),
  (user_org_id, 'CONT011', 'ACC015', 'Sophia', 'Adams', 'sophia.adams@prismhealth.io', 'CTO', 'Technical Decision Maker', 'C-Level', 'United States'),
  (user_org_id, 'CONT012', 'ACC017', 'Nathan', 'Clark', 'nathan.clark@orbitmedia.co', 'Head of Engineering', 'Technical Decision Maker', 'Director', 'United States'),
  (user_org_id, 'CONT013', 'ACC018', 'Rachel', 'Scott', 'rachel.scott@summitins.com', 'VP of Technology', 'Technical Decision Maker', 'VP', 'United Kingdom'),
  (user_org_id, 'CONT014', 'ACC020', 'Alexander', 'King', 'alex.king@pinnaclesaas.com', 'Chief Revenue Officer', 'Business Decision Maker', 'C-Level', 'United States'),
  (user_org_id, 'CONT015', 'ACC020', 'Emily', 'Wright', 'emily.wright@pinnaclesaas.com', 'VP of Product', 'Product Decision Maker', 'VP', 'United States'),
  (user_org_id, 'CONT016', 'ACC023', 'Patrick', 'Nguyen', 'patrick.nguyen@ciphersec.io', 'Director of Engineering', 'Technical Decision Maker', 'Director', 'United States'),
  (user_org_id, 'CONT017', 'ACC024', 'Victoria', 'Schmidt', 'victoria.schmidt@fluxcommerce.com', 'CTO', 'Technical Decision Maker', 'C-Level', 'Germany'),
  (user_org_id, 'CONT018', 'ACC026', 'Matthew', 'Garcia', 'matthew.garcia@zetastream.io', 'VP of Infrastructure', 'Technical Decision Maker', 'VP', 'United States'),
  (user_org_id, 'CONT019', 'ACC007', 'Yuki', 'Tanaka', 'yuki.tanaka@mfgpro.com', 'Head of Digital Transformation', 'Business Decision Maker', 'Director', 'Japan'),
  (user_org_id, 'CONT020', 'ACC009', 'Laura', 'Dubois', 'laura.dubois@greenenergy.com', 'VP of Engineering', 'Technical Decision Maker', 'VP', 'Netherlands'),
  (user_org_id, 'CONT021', 'ACC014', 'Daniel', 'Patel', 'daniel.patel@vertexpay.com', 'CTO', 'Technical Decision Maker', 'C-Level', 'Canada'),
  (user_org_id, 'CONT022', 'ACC019', 'Amanda', 'Kim', 'amanda.kim@catalystai.dev', 'Head of ML Engineering', 'Technical Decision Maker', 'Director', 'United States'),
  (user_org_id, 'CONT023', 'ACC006', 'Thomas', 'Walker', 'thomas.walker@healthtech.com', 'CEO', 'Business Decision Maker', 'C-Level', 'Australia'),
  (user_org_id, 'CONT024', 'ACC027', 'Kenji', 'Sato', 'kenji.sato@vantagesupply.com', 'VP of Operations', 'Business Decision Maker', 'VP', 'Japan'),
  (user_org_id, 'CONT025', 'ACC028', 'Jessica', 'Singh', 'jessica.singh@horizonwealth.com', 'Head of Technology', 'Technical Decision Maker', 'Director', 'Singapore')
  ON CONFLICT (org_id, external_id) DO NOTHING;
  
  GET DIAGNOSTICS contacts_inserted = ROW_COUNT;

  -- ICP profile
  INSERT INTO public.icp_profiles (
    org_id, name, description, industries, sub_industries, company_sizes, revenue_ranges, geographies,
    persona_job_titles, persona_seniority_levels, persona_departments, status, confidence_score, tam_estimate, match_count, is_primary
  ) VALUES (
    user_org_id, 'Enterprise Technology Companies',
    'Mid-to-large technology companies with strong digital transformation initiatives',
    ARRAY['Technology', 'Software Development', 'Data Analytics', 'Cloud Services', 'Financial Technology', 'Cybersecurity'],
    ARRAY['SaaS', 'Enterprise Software', 'Cloud Infrastructure', 'AI/ML Platforms', 'DevOps'],
    ARRAY[200, 500, 1000], ARRAY['$10M-$50M', '$50M-$100M', '$100M-$500M'],
    ARRAY['United States', 'Canada', 'United Kingdom', 'Germany', 'Australia'],
    ARRAY['Chief Technology Officer', 'VP of Engineering', 'Head of Data Science', 'Chief Information Officer', 'Director of Engineering'],
    ARRAY['C-Level', 'VP', 'Director'], ARRAY['Engineering', 'IT', 'Data Science', 'Product'],
    'active', 85, 45000000, 18, true
  ) ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS icp_inserted = ROW_COUNT;

  -- Scores for all 30 accounts with realistic distribution
  INSERT INTO public.scores (org_id, account_external_id, overall, fit, intent, reachability, reasons, scoring_version) VALUES
  (user_org_id, 'ACC001', 92, 88, 95, 90, '{"industry_match": true, "size_match": true, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC002', 85, 82, 88, 85, '{"industry_match": true, "size_match": false, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC003', 89, 90, 85, 92, '{"industry_match": true, "size_match": true, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC004', 78, 75, 80, 78, '{"industry_match": true, "size_match": true, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC005', 65, 60, 70, 65, '{"industry_match": false, "size_match": true, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC006', 55, 50, 60, 55, '{"industry_match": false, "size_match": false, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC007', 45, 40, 50, 45, '{"industry_match": false, "size_match": true, "geo_match": false}', 'icp_v2.0'),
  (user_org_id, 'ACC008', 52, 48, 55, 52, '{"industry_match": false, "size_match": false, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC009', 58, 55, 60, 58, '{"industry_match": false, "size_match": true, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC010', 62, 58, 65, 62, '{"industry_match": false, "size_match": true, "geo_match": false}', 'icp_v2.0'),
  (user_org_id, 'ACC011', 88, 85, 90, 88, '{"industry_match": true, "size_match": true, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC012', 82, 80, 84, 82, '{"industry_match": true, "size_match": true, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC013', 91, 92, 88, 93, '{"industry_match": true, "size_match": true, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC014', 72, 68, 75, 72, '{"industry_match": true, "size_match": true, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC015', 84, 82, 86, 84, '{"industry_match": false, "size_match": true, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC016', 48, 45, 50, 48, '{"industry_match": false, "size_match": false, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC017', 76, 72, 80, 76, '{"industry_match": false, "size_match": true, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC018', 70, 65, 74, 70, '{"industry_match": true, "size_match": true, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC019', 86, 88, 82, 88, '{"industry_match": true, "size_match": false, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC020', 93, 95, 90, 94, '{"industry_match": true, "size_match": true, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC021', 80, 78, 82, 80, '{"industry_match": true, "size_match": true, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC022', 56, 52, 60, 56, '{"industry_match": true, "size_match": false, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC023', 87, 85, 89, 87, '{"industry_match": true, "size_match": true, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC024', 68, 64, 72, 68, '{"industry_match": false, "size_match": true, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC025', 60, 58, 62, 60, '{"industry_match": false, "size_match": false, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC026', 75, 70, 80, 75, '{"industry_match": false, "size_match": true, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC027', 42, 38, 46, 42, '{"industry_match": false, "size_match": true, "geo_match": false}', 'icp_v2.0'),
  (user_org_id, 'ACC028', 64, 60, 68, 64, '{"industry_match": true, "size_match": true, "geo_match": false}', 'icp_v2.0'),
  (user_org_id, 'ACC029', 74, 72, 76, 74, '{"industry_match": true, "size_match": false, "geo_match": true}', 'icp_v2.0'),
  (user_org_id, 'ACC030', 38, 35, 40, 38, '{"industry_match": false, "size_match": false, "geo_match": false}', 'icp_v2.0')
  ON CONFLICT (org_id, account_external_id) DO NOTHING;
  
  GET DIAGNOSTICS scores_inserted = ROW_COUNT;

  -- 10 leads
  INSERT INTO public."Leads" (org_id, external_id, name, status, account_external_id) VALUES
  (user_org_id, 'LEAD001', 'TechCorp Solutions - Enterprise Deal', 'qualified', 'ACC001'),
  (user_org_id, 'LEAD002', 'DataFlow Industries - Analytics Platform', 'open', 'ACC002'),
  (user_org_id, 'LEAD003', 'CloudScale Systems - Infrastructure', 'qualified', 'ACC003'),
  (user_org_id, 'LEAD004', 'CyberGuard - Security Audit', 'open', 'ACC011'),
  (user_org_id, 'LEAD005', 'Nimbus Cloud - Migration Project', 'qualified', 'ACC013'),
  (user_org_id, 'LEAD006', 'Pinnacle SaaS - Platform License', 'qualified', 'ACC020'),
  (user_org_id, 'LEAD007', 'Apex Analytics - BI Suite', 'open', 'ACC012'),
  (user_org_id, 'LEAD008', 'Prism Health - Digital Health Platform', 'open', 'ACC015'),
  (user_org_id, 'LEAD009', 'Cipher Security - Pentest Package', 'qualified', 'ACC023'),
  (user_org_id, 'LEAD010', 'Catalyst AI - ML Infrastructure', 'open', 'ACC019')
  ON CONFLICT (org_id, external_id) DO NOTHING;
  
  GET DIAGNOSTICS leads_inserted = ROW_COUNT;

  -- 8 deals across stages
  INSERT INTO public.deals (org_id, external_id, name, stage, amount, close_date, account_external_id, owner_name, created_at) VALUES
  (user_org_id, 'DEAL001', 'TechCorp Enterprise License', 'closed_won', 150000, (now() - interval '10 days')::date, 'ACC001', 'Sarah Johnson', now() - interval '90 days'),
  (user_org_id, 'DEAL002', 'CloudScale Platform Migration', 'negotiation', 220000, (now() + interval '30 days')::date, 'ACC003', 'Mark Davis', now() - interval '60 days'),
  (user_org_id, 'DEAL003', 'Nimbus Infrastructure Deal', 'proposal', 180000, (now() + interval '45 days')::date, 'ACC013', 'Sarah Johnson', now() - interval '45 days'),
  (user_org_id, 'DEAL004', 'Pinnacle Annual Contract', 'closed_won', 350000, (now() - interval '5 days')::date, 'ACC020', 'Mark Davis', now() - interval '120 days'),
  (user_org_id, 'DEAL005', 'CyberGuard Security Suite', 'qualification', 95000, (now() + interval '60 days')::date, 'ACC011', 'Lisa Wang', now() - interval '30 days'),
  (user_org_id, 'DEAL006', 'Cipher Pentest Package', 'meeting', 75000, (now() + interval '50 days')::date, 'ACC023', 'Lisa Wang', now() - interval '20 days'),
  (user_org_id, 'DEAL007', 'Flux Commerce Integration', 'closed_lost', 130000, (now() - interval '15 days')::date, 'ACC024', 'Sarah Johnson', now() - interval '75 days'),
  (user_org_id, 'DEAL008', 'DataFlow Analytics Expansion', 'proposal', 85000, (now() + interval '35 days')::date, 'ACC002', 'Mark Davis', now() - interval '40 days')
  ON CONFLICT (org_id, external_id) DO NOTHING;
  
  GET DIAGNOSTICS deals_inserted = ROW_COUNT;

  -- 5 account signals
  INSERT INTO public.account_signals (org_id, account_external_id, account_name, signal_type, signal_priority, title, description) VALUES
  (user_org_id, 'ACC001', 'TechCorp Solutions', 'intent', 'high', 'High intent detected', 'Multiple product page visits and pricing page engagement in last 7 days'),
  (user_org_id, 'ACC013', 'Nimbus Cloud', 'tech_change', 'high', 'Tech stack change detected', 'Adopted Kubernetes and migrating from on-prem to cloud infrastructure'),
  (user_org_id, 'ACC019', 'Catalyst AI', 'funding', 'medium', 'Series B funding', 'Raised $25M Series B — expanding ML engineering team'),
  (user_org_id, 'ACC020', 'Pinnacle SaaS', 'expansion', 'high', 'Rapid headcount growth', 'Added 80+ employees in last quarter, opening new offices'),
  (user_org_id, 'ACC011', 'CyberGuard Inc', 'new_hire', 'medium', 'New CTO hired', 'New CTO appointed with enterprise transformation background')
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS signals_inserted = ROW_COUNT;

  -- Pipeline stages
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
  (user_org_id, 'ACC003', 'meeting', now() - interval '25 days', NULL, NULL, NULL),
  (user_org_id, 'ACC013', 'lead', now() - interval '50 days', now() - interval '40 days', 240, NULL),
  (user_org_id, 'ACC013', 'qualified', now() - interval '40 days', now() - interval '30 days', 240, NULL),
  (user_org_id, 'ACC013', 'meeting', now() - interval '30 days', now() - interval '20 days', 240, NULL),
  (user_org_id, 'ACC013', 'proposal', now() - interval '20 days', NULL, NULL, NULL),
  (user_org_id, 'ACC020', 'lead', now() - interval '125 days', now() - interval '110 days', 360, NULL),
  (user_org_id, 'ACC020', 'qualified', now() - interval '110 days', now() - interval '90 days', 480, NULL),
  (user_org_id, 'ACC020', 'meeting', now() - interval '90 days', now() - interval '70 days', 480, NULL),
  (user_org_id, 'ACC020', 'proposal', now() - interval '70 days', now() - interval '40 days', 720, NULL),
  (user_org_id, 'ACC020', 'negotiation', now() - interval '40 days', now() - interval '5 days', 840, NULL),
  (user_org_id, 'ACC020', 'closed_won', now() - interval '5 days', NULL, NULL, 350000)
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS pipeline_inserted = ROW_COUNT;

  -- Capital tracking (12 months)
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
    'deals_inserted', deals_inserted,
    'signals_inserted', signals_inserted,
    'pipeline_stages_inserted', pipeline_inserted,
    'capital_tracking_inserted', capital_inserted,
    'organization_id', user_org_id
  );

  RETURN result;
END;
$function$;
