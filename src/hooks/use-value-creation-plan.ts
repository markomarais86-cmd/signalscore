import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

// Default milestones for the 100-Day GTM Value Creation Plan
const DEFAULT_MILESTONES = [
  // Phase 1: Foundation (Days 1-14)
  { milestone_key: "crm_connected", title: "CRM Connected", description: "Salesforce or HubSpot integrated and syncing", target_day: 1, phase: "Foundation", sort_order: 1 },
  { milestone_key: "data_imported", title: "Account Data Imported", description: "Initial account dataset uploaded or synced from CRM", target_day: 3, phase: "Foundation", sort_order: 2 },
  { milestone_key: "closed_won_uploaded", title: "Closed-Won Deals Uploaded", description: "Historical closed-won deal data uploaded for ICP validation", target_day: 5, phase: "Foundation", sort_order: 3 },
  { milestone_key: "icp_defined", title: "ICP Defined", description: "At least one ICP profile created with industry, size, and geo criteria", target_day: 7, phase: "Foundation", sort_order: 4 },
  { milestone_key: "icp_validated", title: "ICP Validated Against Deals", description: "ICP scoring validated against closed-won data with >60% match rate", target_day: 14, phase: "Foundation", sort_order: 5 },

  // Phase 2: Enrichment (Days 15-30)
  { milestone_key: "enrichment_started", title: "Enrichment Waterfall Running", description: "At least one enrichment batch completed across providers", target_day: 15, phase: "Enrichment", sort_order: 6 },
  { milestone_key: "enrichment_50pct", title: "50% Enrichment Coverage", description: "At least half of all accounts have enriched firmographics", target_day: 21, phase: "Enrichment", sort_order: 7 },
  { milestone_key: "leads_enriched", title: "Contact/Lead Enrichment", description: "Lead records have verified emails and phone numbers", target_day: 25, phase: "Enrichment", sort_order: 8 },
  { milestone_key: "tam_sized", title: "TAM/SAM Sized", description: "Total Addressable Market calculated from enriched account data", target_day: 30, phase: "Enrichment", sort_order: 9 },

  // Phase 3: Scoring & Segmentation (Days 31-50)
  { milestone_key: "scoring_complete", title: "Full Scoring Run Complete", description: "All accounts scored against ICP with A/B/C band distribution", target_day: 35, phase: "Scoring", sort_order: 10 },
  { milestone_key: "segments_created", title: "Segments Created", description: "Account segments defined for campaign targeting", target_day: 40, phase: "Scoring", sort_order: 11 },
  { milestone_key: "a_band_identified", title: "A-Band Accounts Identified", description: "Top-tier accounts identified and prioritized for outreach", target_day: 45, phase: "Scoring", sort_order: 12 },
  { milestone_key: "signals_active", title: "Signal Detection Active", description: "Account signals (intent, funding, hiring) being tracked", target_day: 50, phase: "Scoring", sort_order: 13 },

  // Phase 4: Campaign Activation (Days 51-75)
  { milestone_key: "first_campaign", title: "First Campaign Launched", description: "First outbound campaign created and exported from Campaign Builder", target_day: 55, phase: "Activation", sort_order: 14 },
  { milestone_key: "fuel_lines_configured", title: "Fuel Lines Configured", description: "At least 2 different fuel line types used (ABM, Technographic, etc.)", target_day: 60, phase: "Activation", sort_order: 15 },
  { milestone_key: "suppression_active", title: "Suppression Lists Active", description: "Global suppression rules configured to prevent duplicate outreach", target_day: 65, phase: "Activation", sort_order: 16 },
  { milestone_key: "three_campaigns", title: "3+ Campaigns Running", description: "Multiple campaigns active across different fuel line types", target_day: 75, phase: "Activation", sort_order: 17 },

  // Phase 5: Optimization (Days 76-100)
  { milestone_key: "performance_reviewed", title: "Campaign Performance Reviewed", description: "Fuel line analytics reviewed and optimization decisions made", target_day: 80, phase: "Optimization", sort_order: 18 },
  { milestone_key: "icp_refined", title: "ICP Refined from Results", description: "ICP updated based on campaign conversion data", target_day: 90, phase: "Optimization", sort_order: 19 },
  { milestone_key: "playbook_documented", title: "GTM Playbook Documented", description: "Winning segments, sequences, and fuel lines documented for repeatability", target_day: 100, phase: "Optimization", sort_order: 20 },
];

export interface Milestone {
  id: string;
  plan_id: string;
  org_id: string;
  milestone_key: string;
  title: string;
  description: string | null;
  target_day: number;
  phase: string;
  auto_detect: boolean;
  completed_at: string | null;
  completed_by: string | null;
  manual_notes: string | null;
  sort_order: number;
  // Computed client-side
  autoDetected?: boolean;
}

export interface ValueCreationPlan {
  id: string;
  org_id: string;
  plan_name: string;
  started_at: string;
  target_completion_at: string;
  status: string;
  notes: string | null;
  created_at: string;
}

async function autoDetectMilestones(orgId: string, dataOrgId: string): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  const [
    icpResult,
    accountsResult,
    enrichedResult,
    scoredResult,
    leadsResult,
    campaignsResult,
    signalsResult,
    suppressionResult,
  ] = await Promise.all([
    supabase.from("icp_profiles").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("org_id", dataOrgId),
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("org_id", dataOrgId).not("enriched_at", "is", null),
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("org_id", dataOrgId).not("propensity_score", "is", null),
    supabase.from("Leads").select("id", { count: "exact", head: true }).eq("org_id", dataOrgId),
    supabase.from("campaigns").select("id, fuel_line_type, status", { count: "exact" }).eq("org_id", orgId),
    supabase.from("account_signals").select("id", { count: "exact", head: true }).eq("org_id", dataOrgId),
    supabase.from("suppression_rules").select("id", { count: "exact", head: true }).eq("org_id", orgId),
  ]);

  const totalAccounts = accountsResult.count ?? 0;
  const enrichedAccounts = enrichedResult.count ?? 0;
  const scoredAccounts = scoredResult.count ?? 0;
  const icpCount = icpResult.count ?? 0;
  const leadCount = leadsResult.count ?? 0;
  const campaigns = campaignsResult.data ?? [];
  const campaignCount = campaigns.length;
  const signalCount = signalsResult.count ?? 0;
  const suppressionCount = suppressionResult.count ?? 0;

  const enrichmentPct = totalAccounts > 0 ? enrichedAccounts / totalAccounts : 0;
  const fuelLineTypes = new Set(campaigns.map((c: any) => c.fuel_line_type).filter(Boolean));

  results["data_imported"] = totalAccounts > 0;
  results["icp_defined"] = icpCount > 0;
  results["icp_validated"] = icpCount > 0 && scoredAccounts > 10;
  results["enrichment_started"] = enrichedAccounts > 0;
  results["enrichment_50pct"] = enrichmentPct >= 0.5;
  results["leads_enriched"] = leadCount > 0;
  results["tam_sized"] = totalAccounts > 100 && enrichmentPct > 0.3;
  results["scoring_complete"] = scoredAccounts > 0 && (totalAccounts > 0 ? scoredAccounts / totalAccounts > 0.5 : false);
  results["a_band_identified"] = scoredAccounts > 10;
  results["signals_active"] = signalCount > 0;
  results["first_campaign"] = campaignCount > 0;
  results["fuel_lines_configured"] = fuelLineTypes.size >= 2;
  results["suppression_active"] = suppressionCount > 0;
  results["three_campaigns"] = campaignCount >= 3;

  return results;
}

export function useValueCreationPlan(orgId: string | null) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Resolve data org
  const { data: dataOrgId } = useQuery({
    queryKey: ["data-org-for-plan", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data } = await supabase
        .from("organizations")
        .select("parent_org_id")
        .eq("id", orgId)
        .single();
      return (data as any)?.parent_org_id || orgId;
    },
    enabled: !!orgId,
  });

  // Fetch or create plan
  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ["value-creation-plan", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data } = await supabase
        .from("value_creation_plans")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as ValueCreationPlan | null;
    },
    enabled: !!orgId,
  });

  // Fetch milestones
  const { data: milestones, isLoading: milestonesLoading } = useQuery({
    queryKey: ["value-creation-milestones", plan?.id],
    queryFn: async () => {
      if (!plan?.id) return [];
      const { data } = await supabase
        .from("value_creation_milestones")
        .select("*")
        .eq("plan_id", plan.id)
        .order("sort_order");
      return (data ?? []) as Milestone[];
    },
    enabled: !!plan?.id,
  });

  // Auto-detect
  const { data: autoDetected } = useQuery({
    queryKey: ["value-creation-auto-detect", orgId, dataOrgId],
    queryFn: async () => {
      if (!orgId || !dataOrgId) return {};
      return autoDetectMilestones(orgId, dataOrgId);
    },
    enabled: !!orgId && !!dataOrgId,
    staleTime: 30_000,
  });

  // Merge auto-detection into milestones
  const enrichedMilestones: Milestone[] = (milestones ?? []).map((m) => ({
    ...m,
    autoDetected: autoDetected?.[m.milestone_key] ?? false,
  }));

  // Create plan mutation
  const createPlan = useMutation({
    mutationFn: async () => {
      if (!orgId || !userProfile) throw new Error("Missing org or user");

      const { data: newPlan, error: planError } = await supabase
        .from("value_creation_plans")
        .insert({
          org_id: orgId,
          created_by: userProfile.id,
        } as any)
        .select()
        .single();

      if (planError) throw planError;

      const milestonesToInsert = DEFAULT_MILESTONES.map((m) => ({
        plan_id: (newPlan as any).id,
        org_id: orgId,
        ...m,
      }));

      const { error: msError } = await supabase
        .from("value_creation_milestones")
        .insert(milestonesToInsert as any);

      if (msError) throw msError;
      return newPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["value-creation-plan", orgId] });
      toast({ title: "100-Day Plan created", description: "Milestones initialized for this organization." });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  // Complete milestone mutation
  const completeMilestone = useMutation({
    mutationFn: async ({ milestoneId, notes }: { milestoneId: string; notes?: string }) => {
      const { error } = await supabase
        .from("value_creation_milestones")
        .update({
          completed_at: new Date().toISOString(),
          completed_by: userProfile?.id,
          manual_notes: notes || null,
        } as any)
        .eq("id", milestoneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["value-creation-milestones"] });
      toast({ title: "Milestone completed" });
    },
  });

  // Uncomplete milestone
  const uncompleteMilestone = useMutation({
    mutationFn: async (milestoneId: string) => {
      const { error } = await supabase
        .from("value_creation_milestones")
        .update({ completed_at: null, completed_by: null } as any)
        .eq("id", milestoneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["value-creation-milestones"] });
    },
  });

  const completedCount = enrichedMilestones.filter((m) => m.completed_at || m.autoDetected).length;
  const totalCount = enrichedMilestones.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Days elapsed
  const daysElapsed = plan ? Math.floor((Date.now() - new Date(plan.started_at).getTime()) / 86400000) : 0;
  const daysRemaining = plan ? Math.max(0, 100 - daysElapsed) : 100;

  return {
    plan,
    milestones: enrichedMilestones,
    isLoading: planLoading || milestonesLoading,
    createPlan,
    completeMilestone,
    uncompleteMilestone,
    completedCount,
    totalCount,
    progressPct,
    daysElapsed,
    daysRemaining,
  };
}
