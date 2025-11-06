import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, AlertTriangle, Activity, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface IntegrationHealth {
  id: string;
  provider_name: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  last_sync_at: string | null;
  error_message: string | null;
  integration_type: string;
}

export function IntegrationHealthDashboard() {
  const [integrations, setIntegrations] = useState<IntegrationHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIntegrationHealth();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('integration-health')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'integration_configs' as any
        },
        () => {
          loadIntegrationHealth();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadIntegrationHealth = async () => {
    try {
      const { data, error } = await supabase
        .from('integration_configs' as any)
        .select('id, provider_name, status, last_sync_at, error_message, integration_type')
        .order('provider_name');

      if (error) throw error;
      
      if (data) {
        setIntegrations(data.map((item: any) => ({
          id: item.id,
          provider_name: item.provider_name,
          status: item.status,
          last_sync_at: item.last_sync_at,
          error_message: item.error_message,
          integration_type: item.integration_type
        })));
      }
    } catch (error) {
      console.error('Error loading integration health:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHealthyCount = () => {
    return integrations.filter(i => i.status === 'connected').length;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'syncing':
        return <Activity className="h-4 w-4 text-primary animate-pulse" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-warning" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
            Healthy
          </Badge>
        );
      case 'syncing':
        return (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            Syncing
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
            Warning
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (integrations.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <Activity className="h-12 w-12 mx-auto mb-2 opacity-20" />
          <p>No active integrations configured</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Integration Health</h3>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 w-2 rounded-full ${
                    i < getHealthyCount() ? 'bg-success' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              {getHealthyCount()}/{integrations.length} Healthy
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                {getStatusIcon(integration.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">
                      {integration.provider_name}
                    </span>
                    {getStatusBadge(integration.status)}
                  </div>
                  {integration.error_message && (
                    <p className="text-xs text-destructive mt-1">
                      {integration.error_message}
                    </p>
                  )}
                </div>
              </div>

              {integration.last_sync_at && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(integration.last_sync_at), {
                    addSuffix: true,
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}