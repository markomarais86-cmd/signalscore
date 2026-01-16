import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Download, FileSpreadsheet, CheckCircle, XCircle, Loader2, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

interface ExportJob {
  id: string;
  export_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_records: number;
  processed_records: number;
  filename: string | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export function ExportQueueManager() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query for campaign snapshots as export history
  const { data: recentExports } = useQuery({
    queryKey: ["export-history", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) throw new Error("No organization found");

      const { data, error } = await supabase
        .from("campaign_snapshots")
        .select("id, export_type, total_contacts, export_filename, exported_at, sync_status, sync_destination")
        .eq("org_id", userProfile.org_id)
        .order("exported_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      
      // Transform to ExportJob format
      return (data || []).map((snap): ExportJob => ({
        id: snap.id,
        export_type: snap.export_type || 'csv',
        status: snap.sync_status === 'failed' ? 'failed' : 'completed',
        total_records: snap.total_contacts || 0,
        processed_records: snap.total_contacts || 0,
        filename: snap.export_filename,
        created_at: snap.exported_at,
        completed_at: snap.exported_at,
        error_message: null,
      }));
    },
    enabled: !!userProfile?.org_id,
    refetchInterval: 30000,
  });

  // Real-time subscription for new exports
  useEffect(() => {
    if (!userProfile?.org_id) return;

    const channel = supabase
      .channel('export-queue')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'campaign_snapshots',
          filter: `org_id=eq.${userProfile.org_id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["export-history", userProfile.org_id] });
          toast({
            title: "Export Complete",
            description: "Your campaign export is ready for download",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile?.org_id, queryClient, toast]);

  const activeExports = recentExports?.filter(e => e.status === 'processing' || e.status === 'pending') || [];
  const completedExports = recentExports?.filter(e => e.status === 'completed' || e.status === 'failed') || [];

  const getExportIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatExportType = (type: string): string => {
    const typeMap: Record<string, string> = {
      'csv': 'CSV Export',
      'salesforce': 'Salesforce Sync',
      'hubspot': 'HubSpot Sync',
      'apollo': 'Apollo Sync',
    };
    return typeMap[type] || type;
  };

  if (!recentExports || recentExports.length === 0) {
    return null; // Don't show if no exports
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Download className="h-5 w-5" />
          {activeExports.length > 0 && (
            <Badge
              variant="default"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center bg-blue-500"
            >
              {activeExports.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Export History</h3>
          </div>
          <Badge variant="secondary">{recentExports.length} recent</Badge>
        </div>
        <ScrollArea className="h-[300px]">
          {/* Active exports with progress */}
          {activeExports.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                In Progress
              </div>
              {activeExports.map((exportJob) => (
                <div key={exportJob.id} className="p-4 border-b">
                  <div className="flex items-center gap-2 mb-2">
                    {getExportIcon(exportJob.status)}
                    <span className="text-sm font-medium">{formatExportType(exportJob.export_type)}</span>
                  </div>
                  <Progress 
                    value={(exportJob.processed_records / exportJob.total_records) * 100} 
                    className="h-1.5 mb-1"
                  />
                  <p className="text-xs text-muted-foreground">
                    {exportJob.processed_records} of {exportJob.total_records} records
                  </p>
                </div>
              ))}
            </>
          )}

          {/* Completed exports */}
          {completedExports.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                Completed
              </div>
              {completedExports.map((exportJob) => (
                <DropdownMenuItem 
                  key={exportJob.id} 
                  className="flex items-start gap-3 p-4 cursor-pointer"
                >
                  <div className="mt-0.5">{getExportIcon(exportJob.status)}</div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">
                      {formatExportType(exportJob.export_type)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {exportJob.total_records} records exported
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(exportJob.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}

          {recentExports.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No recent exports
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
