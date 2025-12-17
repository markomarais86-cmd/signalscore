-- Create firmographic_conflicts table for tracking data discrepancies
CREATE TABLE IF NOT EXISTS public.firmographic_conflicts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  account_external_id TEXT NOT NULL,
  lead_id BIGINT REFERENCES public."Leads"(id),
  field_name TEXT NOT NULL,
  account_value TEXT,
  lead_value TEXT,
  resolved_value TEXT,
  resolution_source TEXT, -- 'account', 'lead', 'ai', 'manual'
  ai_confidence NUMERIC,
  ai_reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'resolved', 'dismissed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID
);

-- Enable RLS
ALTER TABLE public.firmographic_conflicts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view conflicts in their org" ON public.firmographic_conflicts
  FOR SELECT USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can insert conflicts in their org" ON public.firmographic_conflicts
  FOR INSERT WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Users can update conflicts in their org" ON public.firmographic_conflicts
  FOR UPDATE USING (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete conflicts" ON public.firmographic_conflicts
  FOR DELETE USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Index for efficient queries
CREATE INDEX idx_firmographic_conflicts_org_status ON public.firmographic_conflicts(org_id, status);
CREATE INDEX idx_firmographic_conflicts_account ON public.firmographic_conflicts(account_external_id);

-- Function 1: Sync firmographics from Accounts to Leads
CREATE OR REPLACE FUNCTION public.sync_firmographics_to_leads(p_org_id UUID, p_account_external_id TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  -- Update leads with account firmographic data (only where lead field is NULL)
  WITH updates AS (
    UPDATE "Leads" l
    SET 
      revenue_range = COALESCE(l.revenue_range, a.revenue_range),
      employee_count = COALESCE(l.employee_count, a.employee_count),
      industry = COALESCE(l.industry, a.industry_norm),
      sub_industry = COALESCE(l.sub_industry, a.sub_industry),
      country = COALESCE(l.country, a.country),
      state_province = COALESCE(l.state_province, a.state_province),
      company_hq_address = COALESCE(l.company_hq_address, a.hq_address),
      company_hq_city = COALESCE(l.company_hq_city, a.hq_city),
      company_hq_state = COALESCE(l.company_hq_state, a.hq_state),
      company_hq_postal_code = COALESCE(l.company_hq_postal_code, a.hq_postal_code),
      company_hq_country = COALESCE(l.company_hq_country, a.country),
      company_main_phone = COALESCE(l.company_main_phone, a.company_main_phone),
      updated_at = NOW()
    FROM accounts a
    WHERE l.account_external_id = a.external_id
      AND l.org_id = p_org_id
      AND a.org_id = p_org_id
      AND (p_account_external_id IS NULL OR a.external_id = p_account_external_id)
      AND (
        (l.revenue_range IS NULL AND a.revenue_range IS NOT NULL) OR
        (l.employee_count IS NULL AND a.employee_count IS NOT NULL) OR
        (l.industry IS NULL AND a.industry_norm IS NOT NULL) OR
        (l.sub_industry IS NULL AND a.sub_industry IS NOT NULL) OR
        (l.country IS NULL AND a.country IS NOT NULL) OR
        (l.state_province IS NULL AND a.state_province IS NOT NULL) OR
        (l.company_hq_address IS NULL AND a.hq_address IS NOT NULL) OR
        (l.company_hq_city IS NULL AND a.hq_city IS NOT NULL) OR
        (l.company_hq_state IS NULL AND a.hq_state IS NOT NULL) OR
        (l.company_hq_postal_code IS NULL AND a.hq_postal_code IS NOT NULL) OR
        (l.company_main_phone IS NULL AND a.company_main_phone IS NOT NULL)
      )
    RETURNING l.id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updates;

  RETURN jsonb_build_object(
    'success', true,
    'leads_updated', v_updated_count,
    'direction', 'accounts_to_leads'
  );
END;
$$;

-- Function 2: Sync firmographics from Leads to Accounts (enhanced)
CREATE OR REPLACE FUNCTION public.sync_firmographics_to_accounts(p_org_id UUID, p_account_external_id TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  WITH lead_aggregates AS (
    SELECT 
      account_external_id,
      MODE() WITHIN GROUP (ORDER BY revenue_range) FILTER (WHERE revenue_range IS NOT NULL) as best_revenue,
      MODE() WITHIN GROUP (ORDER BY employee_count) FILTER (WHERE employee_count IS NOT NULL) as best_employee_count,
      MODE() WITHIN GROUP (ORDER BY country) FILTER (WHERE country IS NOT NULL) as best_country,
      MODE() WITHIN GROUP (ORDER BY industry) FILTER (WHERE industry IS NOT NULL) as best_industry,
      MODE() WITHIN GROUP (ORDER BY sub_industry) FILTER (WHERE sub_industry IS NOT NULL) as best_sub_industry,
      MODE() WITHIN GROUP (ORDER BY state_province) FILTER (WHERE state_province IS NOT NULL) as best_state,
      MODE() WITHIN GROUP (ORDER BY company_hq_address) FILTER (WHERE company_hq_address IS NOT NULL) as best_hq_address,
      MODE() WITHIN GROUP (ORDER BY company_hq_city) FILTER (WHERE company_hq_city IS NOT NULL) as best_hq_city,
      MODE() WITHIN GROUP (ORDER BY company_hq_state) FILTER (WHERE company_hq_state IS NOT NULL) as best_hq_state,
      MODE() WITHIN GROUP (ORDER BY company_hq_postal_code) FILTER (WHERE company_hq_postal_code IS NOT NULL) as best_hq_postal,
      MODE() WITHIN GROUP (ORDER BY company_main_phone) FILTER (WHERE company_main_phone IS NOT NULL) as best_phone
    FROM "Leads"
    WHERE org_id = p_org_id
      AND account_external_id IS NOT NULL
      AND account_external_id != ''
      AND (p_account_external_id IS NULL OR account_external_id = p_account_external_id)
    GROUP BY account_external_id
  ),
  updated AS (
    UPDATE accounts a
    SET 
      revenue_range = COALESCE(a.revenue_range, la.best_revenue),
      employee_count = COALESCE(a.employee_count, la.best_employee_count),
      country = COALESCE(a.country, la.best_country),
      industry_raw = COALESCE(a.industry_raw, la.best_industry),
      sub_industry = COALESCE(a.sub_industry, la.best_sub_industry),
      state_province = COALESCE(a.state_province, la.best_state),
      hq_address = COALESCE(a.hq_address, la.best_hq_address),
      hq_city = COALESCE(a.hq_city, la.best_hq_city),
      hq_state = COALESCE(a.hq_state, la.best_hq_state),
      hq_postal_code = COALESCE(a.hq_postal_code, la.best_hq_postal),
      company_main_phone = COALESCE(a.company_main_phone, la.best_phone),
      updated_at = NOW()
    FROM lead_aggregates la
    WHERE a.external_id = la.account_external_id
      AND a.org_id = p_org_id
      AND (
        (a.revenue_range IS NULL AND la.best_revenue IS NOT NULL) OR
        (a.employee_count IS NULL AND la.best_employee_count IS NOT NULL) OR
        (a.country IS NULL AND la.best_country IS NOT NULL) OR
        (a.industry_raw IS NULL AND la.best_industry IS NOT NULL) OR
        (a.sub_industry IS NULL AND la.best_sub_industry IS NOT NULL) OR
        (a.state_province IS NULL AND la.best_state IS NOT NULL) OR
        (a.hq_address IS NULL AND la.best_hq_address IS NOT NULL) OR
        (a.hq_city IS NULL AND la.best_hq_city IS NOT NULL) OR
        (a.hq_state IS NULL AND la.best_hq_state IS NOT NULL) OR
        (a.hq_postal_code IS NULL AND la.best_hq_postal IS NOT NULL) OR
        (a.company_main_phone IS NULL AND la.best_phone IS NOT NULL)
      )
    RETURNING a.external_id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  RETURN jsonb_build_object(
    'success', true,
    'accounts_updated', v_updated_count,
    'direction', 'leads_to_accounts'
  );
END;
$$;

-- Function 3: Bidirectional sync master function
CREATE OR REPLACE FUNCTION public.bidirectional_firmographic_sync(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_leads_result JSONB;
  v_accounts_result JSONB;
BEGIN
  -- Validate org_id matches current user
  IF p_org_id != get_current_user_org_id() THEN
    RAISE EXCEPTION 'Access denied: Invalid organization';
  END IF;

  -- Step 1: Sync from leads to accounts first (aggregate data up)
  v_accounts_result := sync_firmographics_to_accounts(p_org_id);
  
  -- Step 2: Then sync from accounts to leads (push enriched data down)
  v_leads_result := sync_firmographics_to_leads(p_org_id);

  RETURN jsonb_build_object(
    'success', true,
    'accounts_updated', v_accounts_result->'accounts_updated',
    'leads_updated', v_leads_result->'leads_updated',
    'synced_at', NOW()
  );
END;
$$;

-- Function 4: Detect firmographic conflicts between account and leads
CREATE OR REPLACE FUNCTION public.detect_firmographic_conflicts(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conflicts_found INTEGER := 0;
BEGIN
  -- Find conflicts where both account and lead have DIFFERENT non-null values
  INSERT INTO firmographic_conflicts (org_id, account_external_id, lead_id, field_name, account_value, lead_value)
  SELECT DISTINCT ON (a.external_id, l.id, field_name)
    p_org_id,
    a.external_id,
    l.id,
    conflicts.field_name,
    conflicts.account_value,
    conflicts.lead_value
  FROM accounts a
  JOIN "Leads" l ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  CROSS JOIN LATERAL (
    VALUES 
      ('revenue_range', a.revenue_range, l.revenue_range),
      ('employee_count', a.employee_count::text, l.employee_count::text),
      ('industry', a.industry_norm, l.industry),
      ('country', a.country, l.country),
      ('state_province', a.state_province, l.state_province)
  ) AS conflicts(field_name, account_value, lead_value)
  WHERE a.org_id = p_org_id
    AND conflicts.account_value IS NOT NULL
    AND conflicts.lead_value IS NOT NULL
    AND LOWER(TRIM(conflicts.account_value)) != LOWER(TRIM(conflicts.lead_value))
    AND NOT EXISTS (
      SELECT 1 FROM firmographic_conflicts fc
      WHERE fc.org_id = p_org_id
        AND fc.account_external_id = a.external_id
        AND fc.lead_id = l.id
        AND fc.field_name = conflicts.field_name
        AND fc.status = 'pending'
    )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_conflicts_found = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'conflicts_found', v_conflicts_found
  );
END;
$$;

-- Function 5: Auto-sync trigger function for account updates
CREATE OR REPLACE FUNCTION public.trigger_sync_account_to_leads()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only sync if key firmographic fields changed
  IF (NEW.revenue_range IS DISTINCT FROM OLD.revenue_range AND NEW.revenue_range IS NOT NULL) OR
     (NEW.employee_count IS DISTINCT FROM OLD.employee_count AND NEW.employee_count IS NOT NULL) OR
     (NEW.industry_norm IS DISTINCT FROM OLD.industry_norm AND NEW.industry_norm IS NOT NULL) OR
     (NEW.country IS DISTINCT FROM OLD.country AND NEW.country IS NOT NULL) OR
     (NEW.hq_address IS DISTINCT FROM OLD.hq_address AND NEW.hq_address IS NOT NULL) THEN
    
    -- Async sync via pg_notify (to avoid blocking)
    PERFORM pg_notify('firmographic_sync', jsonb_build_object(
      'org_id', NEW.org_id,
      'account_external_id', NEW.external_id,
      'direction', 'account_to_leads'
    )::text);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function 6: Auto-sync trigger function for lead inserts/updates
CREATE OR REPLACE FUNCTION public.trigger_sync_lead_to_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only process if lead is linked to an account
  IF NEW.account_external_id IS NOT NULL AND NEW.account_external_id != '' THEN
    -- Check if lead has firmographic data that account might need
    IF NEW.revenue_range IS NOT NULL OR 
       NEW.employee_count IS NOT NULL OR 
       NEW.industry IS NOT NULL OR
       NEW.country IS NOT NULL THEN
      
      -- Async sync via pg_notify
      PERFORM pg_notify('firmographic_sync', jsonb_build_object(
        'org_id', NEW.org_id,
        'account_external_id', NEW.account_external_id,
        'lead_id', NEW.id,
        'direction', 'lead_to_account'
      )::text);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers (disabled by default - enable via automation settings)
DROP TRIGGER IF EXISTS trg_sync_account_firmographics ON accounts;
CREATE TRIGGER trg_sync_account_firmographics
  AFTER UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_account_to_leads();

DROP TRIGGER IF EXISTS trg_sync_lead_firmographics ON "Leads";
CREATE TRIGGER trg_sync_lead_firmographics
  AFTER INSERT OR UPDATE ON "Leads"
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_lead_to_account();

-- Initially disable triggers (can be enabled per-org via settings)
ALTER TABLE accounts DISABLE TRIGGER trg_sync_account_firmographics;
ALTER TABLE "Leads" DISABLE TRIGGER trg_sync_lead_firmographics;

-- Function to enable/disable auto-sync for an org
CREATE OR REPLACE FUNCTION public.set_firmographic_auto_sync(p_org_id UUID, p_enabled BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate org
  IF p_org_id != get_current_user_org_id() THEN
    RAISE EXCEPTION 'Access denied: Invalid organization';
  END IF;

  -- Upsert automation setting
  INSERT INTO automation_settings (org_id, setting_key, enabled)
  VALUES (p_org_id, 'firmographic_auto_sync', p_enabled)
  ON CONFLICT (org_id, setting_key) 
  DO UPDATE SET enabled = p_enabled, updated_at = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'auto_sync_enabled', p_enabled
  );
END;
$$;

-- Function to get sync opportunities count
CREATE OR REPLACE FUNCTION public.get_firmographic_sync_opportunities(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_leads_can_enrich INTEGER;
  v_accounts_can_enrich INTEGER;
  v_pending_conflicts INTEGER;
BEGIN
  -- Count leads that can be enriched from accounts
  SELECT COUNT(*) INTO v_leads_can_enrich
  FROM "Leads" l
  JOIN accounts a ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  WHERE l.org_id = p_org_id
    AND (
      (l.revenue_range IS NULL AND a.revenue_range IS NOT NULL) OR
      (l.employee_count IS NULL AND a.employee_count IS NOT NULL) OR
      (l.industry IS NULL AND a.industry_norm IS NOT NULL) OR
      (l.country IS NULL AND a.country IS NOT NULL)
    );

  -- Count accounts that can be enriched from leads
  SELECT COUNT(DISTINCT a.external_id) INTO v_accounts_can_enrich
  FROM accounts a
  JOIN "Leads" l ON l.account_external_id = a.external_id AND l.org_id = a.org_id
  WHERE a.org_id = p_org_id
    AND (
      (a.revenue_range IS NULL AND l.revenue_range IS NOT NULL) OR
      (a.employee_count IS NULL AND l.employee_count IS NOT NULL) OR
      (a.industry_raw IS NULL AND l.industry IS NOT NULL) OR
      (a.country IS NULL AND l.country IS NOT NULL)
    );

  -- Count pending conflicts
  SELECT COUNT(*) INTO v_pending_conflicts
  FROM firmographic_conflicts
  WHERE org_id = p_org_id AND status = 'pending';

  RETURN jsonb_build_object(
    'leads_can_enrich', v_leads_can_enrich,
    'accounts_can_enrich', v_accounts_can_enrich,
    'pending_conflicts', v_pending_conflicts
  );
END;
$$;