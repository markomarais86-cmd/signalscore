import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LeadsMetrics {
  total_leads: number;
  icp_qualified_count: number;
  campaign_ready_count: number;
  enriched_count: number;
  linked_to_accounts_count: number;
  avg_reachability: number;
}

export function useLeadsMetrics(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ["leads-metrics", orgId],
    queryFn: async (): Promise<LeadsMetrics> => {
      if (!orgId) {
        return {
          total_leads: 0,
          icp_qualified_count: 0,
          campaign_ready_count: 0,
          enriched_count: 0,
          linked_to_accounts_count: 0,
          avg_reachability: 0,
        };
      }

      const { data, error } = await supabase.rpc("get_leads_metrics", {
        p_org_id: orgId,
      });

      if (error) {
        console.error("Error fetching leads metrics:", error);
        throw error;
      }

      // RPC returns an array with one row
      const row = Array.isArray(data) ? data[0] : data;
      
      return {
        total_leads: Number(row?.total_leads ?? 0),
        icp_qualified_count: Number(row?.icp_qualified_count ?? 0),
        campaign_ready_count: Number(row?.campaign_ready_count ?? 0),
        enriched_count: Number(row?.enriched_count ?? 0),
        linked_to_accounts_count: Number(row?.linked_to_accounts_count ?? 0),
        avg_reachability: Number(row?.avg_reachability ?? 0),
      };
    },
    enabled: !!orgId,
    staleTime: 30_000, // Cache for 30 seconds
  });
}
