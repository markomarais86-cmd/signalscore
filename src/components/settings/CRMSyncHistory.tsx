import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle, RotateCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SyncLog {
  id: string;
  provider_name: string | null;
  sync_type: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  records_processed: number | null;
  records_created: number | null;
  records_updated: number | null;
  records_failed: number | null;
  error_message: string | null;
  error_details: any;
  metadata: any;
}

interface CRMSyncHistoryProps {
  orgId: string;
  provider?: string;
}

export function CRMSyncHistory({ orgId, provider }: CRMSyncHistoryProps) {
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const loadSyncHistory = async () => {
    try {
      let query = supabase
        .from('integration_sync_logs')
        .select('*')
        .eq('org_id', orgId)
        .order('started_at', { ascending: false })
        .limit(20);

      if (provider) {
        query = query.eq('provider_name', provider);
      }

      const { data, error } = await query;

      if (error) throw error;

      setSyncLogs(data || []);
    } catch (error: any) {
      console.error('Error loading sync history:', error);
      toast({
        title: "Error",
        description: "Failed to load sync history",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadSyncHistory();

    // Set up real-time subscription for sync status updates
    const channel = supabase
      .channel('sync_logs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'integration_sync_logs',
          filter: `org_id=eq.${orgId}`
        },
        () => {
          loadSyncHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, provider]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadSyncHistory();
  };

  const handleRetry = async (logId: string) => {
    try {
      const { error } = await supabase.functions.invoke('retry-crm-sync', {
        body: { sync_log_id: logId, org_id: orgId }
      });

      if (error) throw error;

      toast({
        title: "Sync Retry Started",
        description: "The sync is being retried in the background"
      });

      loadSyncHistory();
    } catch (error: any) {
      toast({
        title: "Retry Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'in_progress':
      case 'retrying':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
      completed: 'default',
      failed: 'destructive',
      in_progress: 'secondary',
      retrying: 'secondary'
    };

    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sync History</CardTitle>
          <CardDescription>Loading recent sync activity...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sync History</CardTitle>
            <CardDescription>Recent CRM sync activity and status</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {syncLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No sync history available</p>
            <p className="text-sm mt-1">Syncs will appear here once they start</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {syncLogs.map((log) => (
                <Card key={log.id} className="border-2">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(log.status)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold capitalize">
                              {log.provider_name}
                            </span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-sm text-muted-foreground capitalize">
                              {log.sync_type.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(log.started_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(log.status)}
                        {log.status === 'failed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRetry(log.id)}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>

                    {log.status === 'completed' && (
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Processed</p>
                          <p className="font-semibold">{log.records_processed || 0}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Created</p>
                          <p className="font-semibold text-green-600">{log.records_created || 0}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Updated</p>
                          <p className="font-semibold text-blue-600">{log.records_updated || 0}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Failed</p>
                          <p className="font-semibold text-destructive">{log.records_failed || 0}</p>
                        </div>
                      </div>
                    )}

                    {log.status === 'failed' && log.error_message && (
                      <div className="mt-3 p-3 bg-destructive/10 rounded-md">
                        <p className="text-xs font-semibold text-destructive mb-1">Error:</p>
                        <p className="text-xs text-destructive/80">{log.error_message}</p>
                      </div>
                    )}

                    {log.metadata?.campaign_name && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        Campaign: <span className="font-medium">{log.metadata.campaign_name}</span>
                        {log.metadata.contact_count && (
                          <> • {log.metadata.contact_count} contacts</>
                        )}
                      </div>
                    )}

                    {log.status === 'in_progress' && (
                      <div className="mt-3">
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Sync in progress...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
