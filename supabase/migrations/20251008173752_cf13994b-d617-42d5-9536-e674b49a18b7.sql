-- Phase 1: Security Fixes & Super Admin System

-- 1. Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'org_admin', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- 3. Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- 5. RLS Policies for user_roles table
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can view all roles"
  ON public.user_roles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can insert roles"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update roles"
  ON public.user_roles
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete roles"
  ON public.user_roles
  FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 6. Create helper function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin');
$$;

-- 7. Add index for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- 8. Add search_path to existing functions that are missing it
-- Update normalize_account_country function
CREATE OR REPLACE FUNCTION public.normalize_account_country()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.country IS NOT NULL THEN
    NEW.country := public.normalize_country(NEW.country);
  END IF;
  RETURN NEW;
END;
$function$;

-- Update normalize_contact_country function
CREATE OR REPLACE FUNCTION public.normalize_contact_country()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.country IS NOT NULL THEN
    NEW.country := public.normalize_country(NEW.country);
  END IF;
  RETURN NEW;
END;
$function$;

-- Update normalize_lead_country function
CREATE OR REPLACE FUNCTION public.normalize_lead_country()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.country IS NOT NULL THEN
    NEW.country := public.normalize_country(NEW.country);
  END IF;
  RETURN NEW;
END;
$function$;

-- Update map_lead_persona function
CREATE OR REPLACE FUNCTION public.map_lead_persona()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.title IS NOT NULL THEN
    NEW.persona := public.map_title_to_persona(NEW.title);
  END IF;
  RETURN NEW;
END;
$function$;

-- Update log_score_change function
CREATE OR REPLACE FUNCTION public.log_score_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF (OLD.overall IS DISTINCT FROM NEW.overall OR 
      OLD.fit IS DISTINCT FROM NEW.fit OR 
      OLD.intent IS DISTINCT FROM NEW.intent OR 
      OLD.reachability IS DISTINCT FROM NEW.reachability) THEN
    
    INSERT INTO public.score_history (
      org_id,
      account_external_id,
      old_score,
      new_score,
      computed_at
    ) VALUES (
      NEW.org_id,
      NEW.account_external_id,
      jsonb_build_object(
        'overall', OLD.overall,
        'fit', OLD.fit,
        'intent', OLD.intent,
        'reachability', OLD.reachability,
        'reasons', OLD.reasons
      ),
      jsonb_build_object(
        'overall', NEW.overall,
        'fit', NEW.fit,
        'intent', NEW.intent,
        'reachability', NEW.reachability,
        'reasons', NEW.reasons
      ),
      NEW.computed_at
    );
  END IF;
  
  RETURN NEW;
END;
$function$;