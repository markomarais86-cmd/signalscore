-- Phase 7: Campaign Snapshot Storage
CREATE TABLE IF NOT EXISTS public.campaign_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  icp_id UUID REFERENCES public.icp_profiles(id),
  icp_name TEXT NOT NULL,
  icp_version INTEGER DEFAULT 1,
  persona_filters_applied JSONB,
  firmographic_filters JSONB,
  total_accounts INTEGER NOT NULL DEFAULT 0,
  total_contacts INTEGER NOT NULL DEFAULT 0,
  campaign_ready_contacts INTEGER NOT NULL DEFAULT 0,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  export_type TEXT NOT NULL, -- 'csv', 'salesforce', 'hubspot'
  export_filename TEXT,
  deduplication_strategy TEXT,
  max_contacts_per_account INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaign_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view campaign snapshots in their org"
  ON public.campaign_snapshots FOR SELECT
  USING (org_id = get_current_user_org_id());

CREATE POLICY "Users can insert campaign snapshots"
  ON public.campaign_snapshots FOR INSERT
  WITH CHECK (org_id = get_current_user_org_id());

CREATE POLICY "Admins can delete campaign snapshots"
  ON public.campaign_snapshots FOR DELETE
  USING (org_id = get_current_user_org_id() AND is_current_user_admin());

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_campaign_snapshots_org_id ON public.campaign_snapshots(org_id);
CREATE INDEX IF NOT EXISTS idx_campaign_snapshots_icp_id ON public.campaign_snapshots(icp_id);
CREATE INDEX IF NOT EXISTS idx_campaign_snapshots_exported_at ON public.campaign_snapshots(exported_at DESC);