-- Phase 3: Customer Onboarding - Invitations System

-- 1. Create invitations table
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'pending',
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
);

-- 2. Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- 3. Create index for performance
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_org_id ON public.invitations(org_id);
CREATE INDEX idx_invitations_status ON public.invitations(status);

-- 4. RLS Policies for invitations
CREATE POLICY "Users can view invitations in their org"
  ON public.invitations
  FOR SELECT
  USING (
    org_id = get_current_user_org_id()
    OR email = auth.jwt()->>'email'
  );

CREATE POLICY "Org admins can insert invitations"
  ON public.invitations
  FOR INSERT
  WITH CHECK (
    org_id = get_current_user_org_id()
    AND (is_current_user_admin() OR public.has_role(auth.uid(), 'org_admin'))
  );

CREATE POLICY "Org admins can update invitations"
  ON public.invitations
  FOR UPDATE
  USING (
    org_id = get_current_user_org_id()
    AND (is_current_user_admin() OR public.has_role(auth.uid(), 'org_admin'))
  );

CREATE POLICY "Org admins can delete invitations"
  ON public.invitations
  FOR DELETE
  USING (
    org_id = get_current_user_org_id()
    AND (is_current_user_admin() OR public.has_role(auth.uid(), 'org_admin'))
  );

CREATE POLICY "Super admins can manage all invitations"
  ON public.invitations
  FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 5. Function to generate invitation token
CREATE OR REPLACE FUNCTION public.generate_invitation_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token TEXT;
BEGIN
  -- Generate a random token
  token := encode(gen_random_bytes(32), 'base64');
  -- Make URL-safe
  token := replace(replace(replace(token, '+', '-'), '/', '_'), '=', '');
  RETURN token;
END;
$$;

-- 6. Function to check and accept invitation
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_result JSONB;
BEGIN
  -- Get invitation
  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > now();

  -- Check if invitation exists and is valid
  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired invitation'
    );
  END IF;

  -- Update user profile with org_id
  UPDATE public.user_profiles
  SET org_id = v_invitation.org_id,
      role = v_invitation.role
  WHERE user_id = p_user_id;

  -- Mark invitation as accepted
  UPDATE public.invitations
  SET status = 'accepted',
      accepted_at = now()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'org_id', v_invitation.org_id,
    'role', v_invitation.role
  );
END;
$$;

-- 7. Function to expire old invitations (run via cron or manually)
CREATE OR REPLACE FUNCTION public.expire_old_invitations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < now();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;