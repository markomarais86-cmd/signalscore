import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle, AlertCircle, Clock, ChevronDown } from "lucide-react";

interface IntegrationSyncHistoryProps {
  integrationId: string;
  integrationName: string;
  lastSync?: string;
  syncStatus?: 'success' | 'error' | 'in_progress';
  recordsSynced?: number;
}

export function IntegrationSyncHistory({ 
  integrationId, 
  integrationName,
  lastSync,
  syncStatus,
  recordsSynced
}: IntegrationSyncHistoryProps) {
  const getStatusIcon = () => {
    switch (syncStatus) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-executive-green" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-executive-red" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    switch (syncStatus) {
      case 'success':
        return <Badge variant="default" className="text-xs">Success</Badge>;
      case 'error':
        return <Badge variant="destructive" className="text-xs">Failed</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Never synced</Badge>;
    }
  };

  if (!lastSync) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        No sync history available
      </div>
    );
  }

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between">
          <span className="text-sm">Recent Activity</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <Card className="border">
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              {getStatusIcon()}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {getStatusBadge()}
                  <span className="text-xs text-muted-foreground">
                    {new Date(lastSync).toLocaleString()}
                  </span>
                </div>
                
                {syncStatus === 'success' && recordsSynced && (
                  <p className="text-sm">
                    {recordsSynced.toLocaleString()} records synced
                  </p>
                )}
                
                {syncStatus === 'error' && (
                  <div className="mt-2 rounded-md border border-executive-red/30 bg-executive-red/5 p-2">
                    <p className="text-xs text-executive-red font-medium mb-1">Sync Failed</p>
                    <p className="text-xs text-muted-foreground">
                      Check your API credentials and try again, or contact support if the issue persists.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
