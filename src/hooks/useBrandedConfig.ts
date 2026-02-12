import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BrandConfig {
  org_id: string;
  company_name: string | null;
  logo_url: string | null;
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
  value_proposition: string | null;
  target_persona_description: string | null;
  calendly_base_url: string | null;
}

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

  return useQuery<BrandConfig | null>({
    queryKey: ["branded-config", slug || orgId],
    queryFn: async () => {
      if (slug) {
        const { data, error } = await supabase.rpc("get_branded_config_by_slug" as any, {
          p_slug: slug,
        });
        if (error) throw error;
        const rows = data as any[];
        return rows?.[0] ?? null;
      }
      if (orgId) {
        const { data, error } = await supabase.rpc("get_branded_config_by_org_id" as any, {
          p_org_id: orgId,
        });
        if (error) throw error;
        const rows = data as any[];
        return rows?.[0] ?? null;
      }
      return null;
    },
    enabled: !!(slug || orgId),
    staleTime: 5 * 60 * 1000,
  });
}
