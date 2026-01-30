import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export type CircuitState = 'closed' | 'open' | 'half_open';
export type HealthStatus = 'healthy' | 'degraded' | 'down';

export interface ProviderHealth {
  serviceName: string;
  circuitState: CircuitState;
  failureCount: number;
  avgResponseTimeMs: number | null;
  cooldownUntil: string | null;
  status: HealthStatus;
}

export interface ProviderCost {
  provider: string;
  costPerContact: number;
  estimatedSuccessRate: number;
}

// Provider costs from estimate-enrichment-cost edge function
const PROVIDER_COSTS: Record<string, ProviderCost> = {
  apollo: { provider: 'apollo', costPerContact: 0.015, estimatedSuccessRate: 35 },
  pdl: { provider: 'pdl', costPerContact: 0.01, estimatedSuccessRate: 40 },
  hunter: { provider: 'hunter', costPerContact: 0.005, estimatedSuccessRate: 90 },
  perplexity: { provider: 'perplexity', costPerContact: 0.005, estimatedSuccessRate: 60 },
  firecrawl: { provider: 'firecrawl', costPerContact: 0.003, estimatedSuccessRate: 75 },
  claude: { provider: 'claude', costPerContact: 0.008, estimatedSuccessRate: 80 },
};

function getHealthStatus(circuitState: string, failureCount: number): HealthStatus {
  if (circuitState === 'open') return 'down';
  if (circuitState === 'half_open' || failureCount > 3) return 'degraded';
  return 'healthy';
}

export function useProviderHealth(providers: string[] = ['apollo', 'pdl', 'hunter']) {
  const { userProfile } = useAuth();
  
  return useQuery({
    queryKey: ['provider-health', providers],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_health')
        .select('service_name, circuit_state, failure_count, avg_response_time_ms, cooldown_until')
        .in('service_name', providers);
      
      if (error) throw error;
      
      const healthMap: Record<string, ProviderHealth> = {};
      
      for (const provider of providers) {
        const record = data?.find(r => r.service_name === provider);
        
        if (record) {
          healthMap[provider] = {
            serviceName: record.service_name,
            circuitState: (record.circuit_state || 'closed') as CircuitState,
            failureCount: record.failure_count || 0,
            avgResponseTimeMs: record.avg_response_time_ms,
            cooldownUntil: record.cooldown_until,
            status: getHealthStatus(record.circuit_state || 'closed', record.failure_count || 0),
          };
        } else {
          // Default to healthy if no record exists
          healthMap[provider] = {
            serviceName: provider,
            circuitState: 'closed',
            failureCount: 0,
            avgResponseTimeMs: null,
            cooldownUntil: null,
            status: 'healthy',
          };
        }
      }
      
      return healthMap;
    },
    enabled: !!userProfile?.org_id,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useEnrichmentCostEstimate(accountCount: number, providers: string[] = ['perplexity', 'firecrawl', 'claude', 'pdl', 'apollo']) {
  const { userProfile } = useAuth();
  
  return useQuery({
    queryKey: ['enrichment-cost-estimate', accountCount, providers],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('estimate-enrichment-cost', {
        body: {
          accountCount,
          providers,
          orgId: userProfile?.org_id,
        },
      });
      
      if (error) throw error;
      return data as {
        totalAccounts: number;
        totalCost: number;
        breakdown: Array<{
          provider: string;
          accountCount: number;
          costPerAccount: number;
          totalCost: number;
          estimatedSuccessRate: number;
        }>;
        estimatedCredits: number;
        estimatedDuration: string;
        warnings: string[];
      };
    },
    enabled: !!userProfile?.org_id && accountCount > 0,
    staleTime: 60000, // 1 minute
  });
}

export function getProviderCost(provider: string): ProviderCost | undefined {
  return PROVIDER_COSTS[provider];
}
