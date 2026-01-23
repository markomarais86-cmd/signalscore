-- Fix Marko Marais record with verified data
UPDATE "Leads"
SET 
  first_name = 'Marko',
  last_name = 'Marais',
  title = 'Chief Product Officer',
  company = 'The Pipeline Group',
  country = 'United Kingdom',
  phone = NULL,  -- Remove invalid US phone
  mobile = NULL, -- Remove invalid US phone
  direct_phone = NULL,
  linkedin_url = 'https://www.linkedin.com/in/markomarais/',
  enriched_at = NOW(),
  enrichment_source = 'manual_verified'
WHERE id = 308491
  AND org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f';