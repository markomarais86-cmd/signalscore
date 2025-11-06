import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  ChevronDown,
  ChevronUp,
  Webhook
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface WebhookLog {
  id: string;
  webhook_type: 'outbound_message' | 'platform_event' | 'change_data_capture';
  object_type: string;
  record_id: string;
  action: 'created' | 'updated' | 'deleted' | 'undeleted';
  payload: any;
  processed: boolean;
  error_message?: string;
  created_at: string;
  processed_at?: string;
}

export default function WebhookLogViewer() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const loadLogs = async () => {
    if (!userProfile?.org_id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setLogs((data || []) as WebhookLog[]);
    } catch (error: any) {
      console.error('Error loading webhook logs:', error);
      toast({
        title: "Error",
        description: "Failed to load webhook logs",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();

    // Set up real-time subscription for new webhooks
    if (!userProfile?.org_id) return;

    const channel = supabase
      .channel('webhook_logs_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webhook_logs',
          filter: `org_id=eq.${userProfile.org_id}`,
        },
        (payload) => {
          console.log('New webhook received:', payload);
          setLogs((prev) => [payload.new as WebhookLog, ...prev.slice(0, 49)]);
          
          toast({
            title: "New Webhook Received",
            description: `${(payload.new as WebhookLog).object_type} ${(payload.new as WebhookLog).action}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile?.org_id]);

  const getWebhookTypeBadge = (type: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      outbound_message: { variant: 'default', label: 'Outbound Message' },
      platform_event: { variant: 'secondary', label: 'Platform Event' },
      change_data_capture: { variant: 'outline', label: 'CDC' },
    };
    const config = variants[type] || variants.outbound_message;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, { variant: any; color: string }> = {
      created: { variant: 'default', color: 'bg-green-500' },
      updated: { variant: 'secondary', color: 'bg-blue-500' },
      deleted: { variant: 'destructive', color: 'bg-red-500' },
      undeleted: { variant: 'outline', color: 'bg-purple-500' },
    };
    const config = variants[action] || variants.updated;
    return <Badge variant={config.variant}>{action}</Badge>;
  };

  const getStatusIcon = (log: WebhookLog) => {
    if (log.processed && !log.error_message) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else if (log.error_message) {
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    } else {
      return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Activity
          </CardTitle>
          <CardDescription>Loading webhook logs...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhook Activity
            </CardTitle>
            <CardDescription>
              Real-time Salesforce webhook events (last 50)
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No webhooks received yet</p>
            <p className="text-sm mt-2">
              Configure Salesforce to send webhooks to start seeing events here
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {logs.map((log) => (
                <Collapsible
                  key={log.id}
                  open={expandedLog === log.id}
                  onOpenChange={(open) => setExpandedLog(open ? log.id : null)}
                >
                  <Card>
                    <CollapsibleTrigger asChild>
                      <div className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {getStatusIcon(log)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-medium">{log.object_type}</span>
                                {getActionBadge(log.action)}
                                {getWebhookTypeBadge(log.webhook_type)}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Record ID: {log.record_id}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {new Date(log.created_at).toLocaleString()}
                              </div>
                              {log.error_message && (
                                <div className="text-sm text-red-600 mt-2">
                                  Error: {log.error_message}
                                </div>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            {expandedLog === log.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 border-t pt-4">
                        <h4 className="font-medium mb-2">Webhook Payload:</h4>
                        <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                        {log.processed_at && (
                          <div className="text-xs text-muted-foreground mt-3">
                            Processed at: {new Date(log.processed_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
