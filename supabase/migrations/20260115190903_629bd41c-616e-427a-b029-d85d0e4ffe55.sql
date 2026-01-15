
-- Recreate the audit trigger for Leads table
CREATE OR REPLACE FUNCTION public.log_leads_access()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  v_org_id := public.get_current_user_org_id();
  
  IF v_user_id IS NOT NULL AND v_org_id IS NOT NULL THEN
    INSERT INTO audit_logs (org_id, actor, action, meta)
    VALUES (
      v_org_id,
      v_user_id::text,
      'leads_pii_access',
      jsonb_build_object(
        'operation', TG_OP,
        'table', TG_TABLE_NAME,
        'timestamp', now()
      )
    );
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS audit_leads_access ON "Leads";
CREATE TRIGGER audit_leads_access
  AFTER INSERT OR UPDATE OR DELETE ON "Leads"
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.log_leads_access();
