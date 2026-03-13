import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BrandedConfigRow } from "@/types/supabase-rpc";

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
        const { data, error } = await supabase.rpc("get_branded_config_by_slug" as any, {
          p_slug: slug,
        });
        if (error) throw error;
        const rows = data as BrandedConfigRow[];
        return rows?.[0] ?? null;
      }
      if (orgId) {
        const { data, error } = await supabase.rpc("get_branded_config_by_org_id" as any, {
          p_org_id: orgId,
        });
        if (error) throw error;
        const rows = data as BrandedConfigRow[];
        return rows?.[0] ?? null;
      }
      return null;
    },
    enabled: !!(slug || orgId),
    staleTime: 5 * 60 * 1000,
  });
}
