import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrganizationMetrics {
  id: string;
  name: string;
  status: string;
  created_at: string;
  total_users: number;
  total_accounts: number;
  total_contacts: number;
  total_leads: number;
  total_icps: number;
  enrichment_credits_used: number;
  enrichment_credits_total: number;
  last_activity: string | null;
}

export const usePlatformAdmin = () => {
  const { data: organizations, isLoading: orgsLoading, error: orgsError } = useQuery({
    queryKey: ["platform-admin-organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: organizationMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["platform-admin-metrics", organizations],
    queryFn: async () => {
      if (!organizations) return [];

      const metrics: OrganizationMetrics[] = await Promise.all(
        organizations.map(async (org) => {
          // Count users - using auth.users via RPC or a view would be better
          // For now, we'll use audit_logs as a proxy for user activity
          const { data: userActivity } = await supabase
            .from("audit_logs")
            .select("actor")
            .eq("org_id", org.id);
          
          const uniqueUsers = new Set(userActivity?.map(log => log.actor)).size;

          // Count accounts
          const { count: accountCount } = await supabase
            .from("accounts")
            .select("*", { count: "exact", head: true })
            .eq("org_id", org.id);

          // Count contacts
          const { count: contactCount } = await supabase
            .from("contacts")
            .select("*", { count: "exact", head: true })
            .eq("org_id", org.id);

          // Count leads
          const { count: leadCount } = await supabase
            .from("Leads")
            .select("*", { count: "exact", head: true })
            .eq("org_id", org.id);

          // Count ICPs
          const { count: icpCount } = await supabase
            .from("icp_profiles")
            .select("*", { count: "exact", head: true })
            .eq("org_id", org.id);

          // Get last activity from audit logs
          const { data: lastActivity } = await supabase
            .from("audit_logs")
            .select("created_at")
            .eq("org_id", org.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          return {
            id: org.id,
            name: org.name,
            status: org.status,
            created_at: org.created_at,
            total_users: uniqueUsers || 0,
            total_accounts: accountCount || 0,
            total_contacts: contactCount || 0,
            total_leads: leadCount || 0,
            total_icps: icpCount || 0,
            enrichment_credits_used: org.enrichment_credits_used || 0,
            enrichment_credits_total: org.enrichment_credits_total || 0,
            last_activity: lastActivity?.created_at || null,
          };
        })
      );

      return metrics;
    },
    enabled: !!organizations,
  });

  const { data: recentAudits, isLoading: auditsLoading } = useQuery({
    queryKey: ["platform-admin-audits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select(`
          *,
          organizations (name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  return {
    organizations,
    organizationMetrics,
    recentAudits,
    isLoading: orgsLoading || metricsLoading || auditsLoading,
    error: orgsError,
  };
};
