import { useQuery } from "@tanstack/react-query";
import type { BrandedConfigRow } from "@/types/supabase-rpc";
import { callCustomRpc, unwrapRpcResult } from "@/types/supabase-rpc";

export type { BrandedConfigRow as BrandConfig };

interface UseBrandedConfigBySlug {
  slug: string;
  orgId?: never;
}

interface UseBrandedConfigByOrgId {
  slug?: never;
  orgId: string;
}

type UseBrandedConfigParams = UseBrandedConfigBySlug | UseBrandedConfigByOrgId;

export function useBrandedConfig(params: UseBrandedConfigParams) {
  const { slug, orgId } = params;

  return useQuery<BrandedConfigRow | null>({
    queryKey: ["branded-config", slug || orgId],
    queryFn: async () => {
      if (slug) {
        const { data, error } = await callCustomRpc<BrandedConfigRow[]>("get_branded_config_by_slug", {
          p_slug: slug,
        });
        if (error) throw error;
        return (data as BrandedConfigRow[])?.[0] ?? null;
      }
      if (orgId) {
        const { data, error } = await callCustomRpc<BrandedConfigRow[]>("get_branded_config_by_org_id", {
          p_org_id: orgId,
        });
        if (error) throw error;
        return (data as BrandedConfigRow[])?.[0] ?? null;
      }
      return null;
    },
    enabled: !!(slug || orgId),
    staleTime: 5 * 60 * 1000,
  });
}
