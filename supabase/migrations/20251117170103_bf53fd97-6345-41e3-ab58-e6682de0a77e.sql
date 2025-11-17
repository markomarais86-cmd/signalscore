-- Fix 4: Add Foreign Key Constraints with Pre-validation
-- Phase 1: Find and fix orphaned leads before adding constraints

-- Step 1: Create temporary audit table for tracking fixes
CREATE TEMP TABLE IF NOT EXISTS orphan_fixes (
  org_id uuid,
  lead_id bigint,
  account_external_id text,
  action text,
  created_account_id uuid,
  fixed_at timestamptz DEFAULT now()
);

-- Step 2: Find orphaned leads (leads without matching accounts)
-- and create placeholder accounts for them
DO $$
DECLARE
  orphan_record RECORD;
  new_account_id uuid;
  accounts_created integer := 0;
BEGIN
  -- Loop through orphaned leads grouped by org_id and account_external_id
  FOR orphan_record IN
    SELECT 
      l.org_id,
      l.account_external_id,
      MIN(l.id) as first_lead_id,
      COUNT(*) as lead_count,
      MAX(l.company) as company_name,
      MAX(l.website) as website,
      MAX(l.industry) as industry,
      MAX(l.country) as country,
      MAX(l.revenue_range) as revenue_range,
      MAX(l.employee_count) as employee_count
    FROM public."Leads" l
    LEFT JOIN public.accounts a 
      ON l.account_external_id = a.external_id 
      AND l.org_id = a.org_id
    WHERE 
      l.account_external_id IS NOT NULL
      AND l.account_external_id != ''
      AND a.id IS NULL  -- No matching account exists
    GROUP BY l.org_id, l.account_external_id
  LOOP
    -- Create placeholder account using lead data
    INSERT INTO public.accounts (
      org_id,
      external_id,
      name,
      domain,
      industry_raw,
      country,
      revenue_range,
      employee_count,
      data_source,
      updated_at
    ) VALUES (
      orphan_record.org_id,
      orphan_record.account_external_id,
      COALESCE(orphan_record.company_name, 'Unknown Company'),
      orphan_record.website,
      orphan_record.industry,
      orphan_record.country,
      orphan_record.revenue_range,
      orphan_record.employee_count,
      'lead_derived',  -- Mark as derived from lead data
      now()
    )
    RETURNING id INTO new_account_id;
    
    accounts_created := accounts_created + 1;
    
    -- Log the fix
    INSERT INTO orphan_fixes (
      org_id,
      lead_id,
      account_external_id,
      action,
      created_account_id
    ) VALUES (
      orphan_record.org_id,
      orphan_record.first_lead_id,
      orphan_record.account_external_id,
      'created_placeholder_account',
      new_account_id
    );
  END LOOP;
  
  -- Log summary to audit_logs
  IF accounts_created > 0 THEN
    INSERT INTO public.audit_logs (org_id, action, actor, meta)
    SELECT DISTINCT 
      org_id,
      'orphan_leads_fixed',
      'system_migration_fix4',
      jsonb_build_object(
        'accounts_created', accounts_created,
        'migration', 'add_foreign_key_constraints',
        'timestamp', now()
      )
    FROM orphan_fixes
    WHERE org_id IS NOT NULL;
    
    RAISE NOTICE 'Created % placeholder accounts for orphaned leads', accounts_created;
  ELSE
    RAISE NOTICE 'No orphaned leads found - database is clean';
  END IF;
END $$;

-- Step 3: Add foreign key constraint from Leads to accounts
-- This ensures referential integrity going forward
ALTER TABLE public."Leads"
ADD CONSTRAINT fk_leads_account 
FOREIGN KEY (org_id, account_external_id) 
REFERENCES public.accounts(org_id, external_id)
ON DELETE CASCADE
ON UPDATE CASCADE
DEFERRABLE INITIALLY DEFERRED;

-- Step 4: Create index to optimize FK lookups
CREATE INDEX IF NOT EXISTS idx_leads_account_fk 
ON public."Leads"(org_id, account_external_id)
WHERE account_external_id IS NOT NULL;

-- Step 5: Add foreign key constraint from enrichment_history to accounts
-- First check for orphaned enrichment records
DO $$
DECLARE
  orphan_enrichment_count integer;
BEGIN
  -- Count orphaned enrichment records
  SELECT COUNT(*) INTO orphan_enrichment_count
  FROM public.enrichment_history eh
  LEFT JOIN public.accounts a 
    ON eh.account_external_id = a.external_id 
    AND eh.org_id = a.org_id
  WHERE a.id IS NULL;
  
  IF orphan_enrichment_count > 0 THEN
    -- Delete orphaned enrichment history (old enrichments for deleted accounts)
    DELETE FROM public.enrichment_history eh
    WHERE NOT EXISTS (
      SELECT 1 FROM public.accounts a 
      WHERE a.external_id = eh.account_external_id 
      AND a.org_id = eh.org_id
    );
    
    RAISE NOTICE 'Cleaned up % orphaned enrichment history records', orphan_enrichment_count;
  END IF;
END $$;

ALTER TABLE public.enrichment_history
ADD CONSTRAINT fk_enrichment_history_account
FOREIGN KEY (org_id, account_external_id)
REFERENCES public.accounts(org_id, external_id)
ON DELETE CASCADE
ON UPDATE CASCADE
DEFERRABLE INITIALLY DEFERRED;

-- Step 6: Create index for enrichment_history FK
CREATE INDEX IF NOT EXISTS idx_enrichment_history_account_fk
ON public.enrichment_history(org_id, account_external_id);

-- Step 7: Add comment documenting the constraints
COMMENT ON CONSTRAINT fk_leads_account ON public."Leads" IS 
'Ensures leads are always linked to valid accounts. Orphaned leads have placeholder accounts created.';

COMMENT ON CONSTRAINT fk_enrichment_history_account ON public.enrichment_history IS 
'Ensures enrichment history references valid accounts. Cascades on account deletion.';