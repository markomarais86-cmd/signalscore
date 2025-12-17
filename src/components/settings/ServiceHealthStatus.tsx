import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  RefreshCw,
  Clock,
  TrendingUp,
  Server
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface ServiceHealth {
  id: string;
  service_name: string;
  circuit_state: 'closed' | 'open' | 'half_open';
  failure_count: number;
  success_count: number;
  last_failure_at: string | null;
  last_success_at: string | null;
  last_error_message: string | null;
  state_changed_at: string;
  cooldown_until: string | null;
  avg_response_time_ms: number | null;
  total_requests: number;
  total_failures: number;
}

const SERVICE_DISPLAY_NAMES: Record<string, string> = {
  pdl: 'People Data Labs',
  clearbit: 'Clearbit',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  salesforce: 'Salesforce',
  hubspot: 'HubSpot',
  apollo: 'Apollo.io',
  abacus: 'Abacus AI',
  lovable: 'Lovable AI',
};

const getStateIcon = (state: string) => {
  switch (state) {
    case 'closed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'half_open':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'open':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Activity className="h-4 w-4 text-muted-foreground" />;
  }
};

const getStateBadgeVariant = (state: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (state) {
    case 'closed':
      return 'default';
    case 'half_open':
      return 'secondary';
    case 'open':
      return 'destructive';
    default:
      return 'outline';
  }
};

const getStateLabel = (state: string) => {
  switch (state) {
    case 'closed':
      return 'Healthy';
    case 'half_open':
      return 'Recovering';
    case 'open':
      return 'Unavailable';
    default:
      return 'Unknown';
  }
};

export function ServiceHealthStatus() {
  const queryClient = useQueryClient();

  const { data: services, isLoading, error } = useQuery({
    queryKey: ['service-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_health')
        .select('*')
        .order('service_name');
      
      if (error) throw error;
      return data as ServiceHealth[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const resetMutation = useMutation({
    mutationFn: async (serviceName: string) => {
      const { error } = await supabase
        .from('service_health')
        .update({
          circuit_state: 'closed',
          failure_count: 0,
          success_count: 0,
          state_changed_at: new Date().toISOString(),
          cooldown_until: null,
          last_error_message: null,
        })
        .eq('service_name', serviceName);
      
      if (error) throw error;
    },
    onSuccess: (_, serviceName) => {
      toast.success(`Reset circuit breaker for ${SERVICE_DISPLAY_NAMES[serviceName] || serviceName}`);
      queryClient.invalidateQueries({ queryKey: ['service-health'] });
    },
    onError: (error) => {
      toast.error('Failed to reset circuit breaker');
      console.error('Reset error:', error);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            External Service Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            External Service Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Failed to load service health status
          </div>
        </CardContent>
      </Card>
    );
  }

  const healthyCount = services?.filter(s => s.circuit_state === 'closed').length || 0;
  const degradedCount = services?.filter(s => s.circuit_state === 'half_open').length || 0;
  const unavailableCount = services?.filter(s => s.circuit_state === 'open').length || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              External Service Health
            </CardTitle>
            <CardDescription className="mt-1">
              Circuit breaker status for external API integrations
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {healthyCount} Healthy
            </Badge>
            {degradedCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {degradedCount} Recovering
              </Badge>
            )}
            {unavailableCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                {unavailableCount} Unavailable
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {services?.map((service) => (
            <div 
              key={service.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {getStateIcon(service.circuit_state)}
                <div>
                  <div className="font-medium">
                    {SERVICE_DISPLAY_NAMES[service.service_name] || service.service_name}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    {service.total_requests > 0 && (
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {service.total_requests} requests
                      </span>
                    )}
                    {service.avg_response_time_ms && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {service.avg_response_time_ms}ms avg
                      </span>
                    )}
                    {service.total_failures > 0 && (
                      <span className="text-destructive">
                        {service.total_failures} failures
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {service.circuit_state === 'open' && service.cooldown_until && (
                  <div className="text-xs text-muted-foreground">
                    Retry {formatDistanceToNow(new Date(service.cooldown_until), { addSuffix: true })}
                  </div>
                )}
                
                {service.last_error_message && service.circuit_state !== 'closed' && (
                  <div 
                    className="text-xs text-destructive max-w-[200px] truncate"
                    title={service.last_error_message}
                  >
                    {service.last_error_message}
                  </div>
                )}
                
                <Badge variant={getStateBadgeVariant(service.circuit_state)}>
                  {getStateLabel(service.circuit_state)}
                </Badge>
                
                {service.circuit_state !== 'closed' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => resetMutation.mutate(service.service_name)}
                    disabled={resetMutation.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 ${resetMutation.isPending ? 'animate-spin' : ''}`} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {(!services || services.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            No service health data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
