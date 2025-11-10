-- Fix Apollo connection status
UPDATE external_data_sources 
SET api_key_configured = true 
WHERE provider = 'apollo' 
  AND org_id = '726a0dc0-99c7-43c2-b20f-b849f2760c3f'
  AND is_active = true;