-- Fix security warnings for integration management functions

-- Fix update_integration_updated_at function
CREATE OR REPLACE FUNCTION public.update_integration_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix cleanup_expired_oauth_states function  
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_states()
RETURNS INTEGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.oauth_state WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Fix log_integration_change function
CREATE OR REPLACE FUNCTION public.log_integration_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.audit_logs (org_id, actor, action, meta)
      VALUES (
        NEW.org_id,
        COALESCE(NEW.created_by::text, 'system'),
        'integration_connected',
        jsonb_build_object('provider', NEW.provider_name, 'type', NEW.integration_type, 'resource_id', NEW.id)
      );
    ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
      INSERT INTO public.audit_logs (org_id, actor, action, meta)
      VALUES (
        NEW.org_id,
        COALESCE(auth.uid()::text, 'system'),
        'integration_status_changed',
        jsonb_build_object('provider', NEW.provider_name, 'old_status', OLD.status, 'new_status', NEW.status, 'resource_id', NEW.id)
      );
    ELSIF TG_OP = 'DELETE' THEN
      INSERT INTO public.audit_logs (org_id, actor, action, meta)
      VALUES (
        OLD.org_id,
        COALESCE(auth.uid()::text, 'system'),
        'integration_disconnected',
        jsonb_build_object('provider', OLD.provider_name, 'resource_id', OLD.id)
      );
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;