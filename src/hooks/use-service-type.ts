import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveOrg } from "@/hooks/use-effective-org";

export type ServiceType = "managed" | "self_service";

export function useServiceType() {
  const { effectiveOrgId } = useEffectiveOrg();

  const { data, isLoading } = useQuery({
    queryKey: ["org-service-type", effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select("service_type, subscription_status")
        .eq("id", effectiveOrgId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveOrgId,
    staleTime: 5 * 60 * 1000,
  });

  const serviceType = (data?.service_type as ServiceType) || "self_service";

  return {
    serviceType,
    isManaged: serviceType === "managed",
    isSelfService: serviceType === "self_service",
    subscriptionStatus: data?.subscription_status as string | null,
    loading: isLoading,
  };
}
