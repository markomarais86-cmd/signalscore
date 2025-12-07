-- Update empty field_mappings in clay_webhook_config with proper defaults
UPDATE clay_webhook_config 
SET field_mappings = CASE webhook_type
  WHEN 'clay_company_data' THEN '{"domain":"domain","company_name":"name","industry":"industry_raw","employee_count":"employee_count","revenue":"revenue_range","location":"country","technologies":"tech_stack"}'::jsonb
  WHEN 'clay_contact_data' THEN '{"email":"email","first_name":"first_name","last_name":"last_name","title":"title","company_domain":"company","linkedin_url":"linkedin_url","phone":"phone","location":"country"}'::jsonb
  WHEN 'clay_enrichment_data' THEN '{"employee_count":"employee_count","revenue":"revenue_range","industry":"industry_raw","technologies":"tech_stack","funding_round":"last_funding_round","total_funding":"total_raised_usd"}'::jsonb
  ELSE field_mappings
END
WHERE field_mappings = '{}'::jsonb OR field_mappings IS NULL;