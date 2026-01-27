import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Download, FileSpreadsheet, CheckCircle, XCircle, Loader2, History, ExternalLink } from "lucide-react";
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
  download_url: string | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export function ExportQueueManager() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query for export jobs
  const { data: exportJobs } = useQuery({
    queryKey: ["export-jobs", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) throw new Error("No organization found");

      const { data, error } = await supabase
        .from("export_jobs")
        .select("id, export_type, status, total_records, processed_records, filename, download_url, created_at, completed_at, error_message")
        .eq("org_id", userProfile.org_id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      
      return (data || []) as ExportJob[];
    },
    enabled: !!userProfile?.org_id,
    refetchInterval: 10000, // Poll every 10 seconds for active exports
  });

  // Real-time subscription for export job updates
  useEffect(() => {
    if (!userProfile?.org_id) return;

    const channel = supabase
      .channel('export-jobs-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'export_jobs',
          filter: `org_id=eq.${userProfile.org_id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["export-jobs", userProfile.org_id] });
          
          if (payload.eventType === 'UPDATE' && (payload.new as ExportJob).status === 'completed') {
            toast({
              title: "Export Complete",
              description: "Your export is ready for download!",
            });
          } else if (payload.eventType === 'UPDATE' && (payload.new as ExportJob).status === 'failed') {
            toast({
              title: "Export Failed",
              description: (payload.new as ExportJob).error_message || "An error occurred during export",
              variant: "destructive",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile?.org_id, queryClient, toast]);

  const activeExports = exportJobs?.filter(e => e.status === 'processing' || e.status === 'pending') || [];
  const completedExports = exportJobs?.filter(e => e.status === 'completed' || e.status === 'failed') || [];

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
      'accounts': 'Accounts Export',
      'leads': 'Leads Export',
      'csv': 'CSV Export',
      'salesforce': 'Salesforce Sync',
      'hubspot': 'HubSpot Sync',
      'apollo': 'Apollo Sync',
    };
    return typeMap[type] || type;
  };

  const handleDownload = (job: ExportJob) => {
    if (job.download_url) {
      window.open(job.download_url, '_blank');
    }
  };

  if (!exportJobs || exportJobs.length === 0) {
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
            <h3 className="font-semibold">Export Queue</h3>
          </div>
          <Badge variant="secondary">{exportJobs.length} exports</Badge>
        </div>
        <ScrollArea className="h-[350px]">
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
                    <Badge variant="outline" className="ml-auto text-xs">
                      {exportJob.status}
                    </Badge>
                  </div>
                  {exportJob.total_records > 0 && (
                    <>
                      <Progress 
                        value={(exportJob.processed_records / exportJob.total_records) * 100} 
                        className="h-1.5 mb-1"
                      />
                      <p className="text-xs text-muted-foreground">
                        {exportJob.processed_records.toLocaleString()} of {exportJob.total_records.toLocaleString()} records
                      </p>
                    </>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Started {formatDistanceToNow(new Date(exportJob.created_at), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </>
          )}

          {/* Completed exports */}
          {completedExports.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                Recent Exports
              </div>
              {completedExports.map((exportJob) => (
                <div 
                  key={exportJob.id} 
                  className="flex items-start gap-3 p-4 border-b hover:bg-muted/30 transition-colors"
                >
                  <div className="mt-0.5">{getExportIcon(exportJob.status)}</div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">
                      {formatExportType(exportJob.export_type)}
                    </p>
                    {exportJob.status === 'completed' ? (
                      <p className="text-xs text-muted-foreground">
                        {exportJob.total_records.toLocaleString()} records exported
                      </p>
                    ) : (
                      <p className="text-xs text-red-600">
                        {exportJob.error_message || "Export failed"}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(exportJob.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {exportJob.status === 'completed' && exportJob.download_url && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDownload(exportJob)}
                      className="shrink-0"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </>
          )}

          {exportJobs.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No recent exports
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
