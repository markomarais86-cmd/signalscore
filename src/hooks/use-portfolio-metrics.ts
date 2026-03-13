import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HealthStatus = "green" | "amber" | "red" | "gray";

export interface PortfolioCompanyMetrics {
  id: string;
  name: string;
  status: string;
  created_at: string;
  // GTM health dimensions
  icpDefined: boolean;
  icpCount: number;
  totalAccounts: number;
  scoredAccounts: number;
  enrichedAccounts: number;
  totalLeads: number;
  totalCampaigns: number;
  activeCampaigns: number;
  activeSignals: number;
  enrichmentCreditsUsed: number;
  enrichmentCreditsTotal: number;
  // Computed
  scoringCoverage: number; // 0-100
  enrichmentCoverage: number; // 0-100
  overallHealth: HealthStatus;
  healthScore: number; // 0-100
}

function computeHealth(m: Omit<PortfolioCompanyMetrics, "overallHealth" | "healthScore" | "scoringCoverage" | "enrichmentCoverage">): Pick<PortfolioCompanyMetrics, "overallHealth" | "healthScore" | "scoringCoverage" | "enrichmentCoverage"> {
  const scoringCoverage = m.totalAccounts > 0 ? Math.round((m.scoredAccounts / m.totalAccounts) * 100) : 0;
  const enrichmentCoverage = m.totalAccounts > 0 ? Math.round((m.enrichedAccounts / m.totalAccounts) * 100) : 0;

  let score = 0;
  // ICP defined: 25 points
  if (m.icpDefined) score += 25;
  // Scoring coverage: 25 points
  score += Math.round(scoringCoverage * 0.25);
  // Enrichment coverage: 25 points
  score += Math.round(enrichmentCoverage * 0.25);
  // Campaign activity: 25 points
  if (m.activeCampaigns > 0) score += 15;
  if (m.totalCampaigns >= 3) score += 10;

  let overallHealth: HealthStatus = "gray";
  if (m.totalAccounts === 0) overallHealth = "gray";
  else if (score >= 70) overallHealth = "green";
  else if (score >= 40) overallHealth = "amber";
  else overallHealth = "red";

  return { scoringCoverage, enrichmentCoverage, overallHealth, healthScore: score };
}

export function usePortfolioMetrics() {
  return useQuery({
    queryKey: ["portfolio-command-center"],
    queryFn: async () => {
      // Get all child orgs (orgs with a parent_org_id)
      const { data: orgs, error: orgsError } = await supabase
        .from("organizations")
        .select("id, name, status, created_at, parent_org_id, enrichment_credits_used, enrichment_credits_total")
        .order("name");

      if (orgsError) throw orgsError;
      if (!orgs || orgs.length === 0) return [];

      // Get child orgs (those with parent_org_id set)
      const childOrgs = orgs.filter((o: any) => o.parent_org_id);
      // If no children, show all orgs as portfolio
      const targetOrgs = childOrgs.length > 0 ? childOrgs : orgs;

      const metrics: PortfolioCompanyMetrics[] = await Promise.all(
        targetOrgs.map(async (org: any) => {
          const orgId = org.id;
          // Determine data org (parent or self)
          const dataOrgId = org.parent_org_id || orgId;

          // Parallel queries
          const [
            icpResult,
            accountsResult,
            scoredResult,
            enrichedResult,
            leadsResult,
            campaignsResult,
            activeCampaignsResult,
            signalsResult,
          ] = await Promise.all([
            supabase.from("icp_profiles").select("id", { count: "exact", head: true }).eq("org_id", orgId),
            supabase.from("accounts").select("id", { count: "exact", head: true }).eq("org_id", dataOrgId),
            supabase.from("accounts").select("id", { count: "exact", head: true }).eq("org_id", dataOrgId).not("propensity_score", "is", null),
            supabase.from("accounts").select("id", { count: "exact", head: true }).eq("org_id", dataOrgId).not("enriched_at", "is", null),
            supabase.from("Leads").select("id", { count: "exact", head: true }).eq("org_id", dataOrgId),
            supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("org_id", orgId),
            supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active"),
            supabase.from("account_signals").select("id", { count: "exact", head: true }).eq("org_id", dataOrgId).is("actioned_at", null).is("dismissed_at", null),
          ]);

          const base = {
            id: orgId,
            name: org.name,
            status: org.status,
            created_at: org.created_at,
            icpDefined: (icpResult.count ?? 0) > 0,
            icpCount: icpResult.count ?? 0,
            totalAccounts: accountsResult.count ?? 0,
            scoredAccounts: scoredResult.count ?? 0,
            enrichedAccounts: enrichedResult.count ?? 0,
            totalLeads: leadsResult.count ?? 0,
            totalCampaigns: campaignsResult.count ?? 0,
            activeCampaigns: activeCampaignsResult.count ?? 0,
            activeSignals: signalsResult.count ?? 0,
            enrichmentCreditsUsed: org.enrichment_credits_used ?? 0,
            enrichmentCreditsTotal: org.enrichment_credits_total ?? 0,
          };

          return { ...base, ...computeHealth(base) };
        })
      );

      return metrics;
    },
    staleTime: 60_000,
  });
}
