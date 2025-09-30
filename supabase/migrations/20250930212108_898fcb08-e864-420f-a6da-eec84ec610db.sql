-- Add sample external data source for demonstration
DO $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get the org_id from the first account
  SELECT DISTINCT org_id INTO v_org_id
  FROM public.accounts
  LIMIT 1;
  
  IF v_org_id IS NOT NULL THEN
    INSERT INTO public.external_data_sources (org_id, provider, api_key_configured, is_active, total_accounts, total_contacts, last_synced_at)
    VALUES (v_org_id, 'zoominfo', true, true, 95000, 350000, now())
    ON CONFLICT (org_id, provider) DO UPDATE
    SET 
      is_active = true,
      total_accounts = 95000,
      total_contacts = 350000,
      last_synced_at = now();
  END IF;
END $$;