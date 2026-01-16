import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Bell, CheckCircle, XCircle, Info, X, CheckCheck, ChevronRight, Database, Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

const DISMISSED_KEY = "launchpulse_dismissed_notifications";
const LAST_SEEN_KEY = "launchpulse_notifications_last_seen";
const NOTIFICATION_MAX_AGE_HOURS = 48;

interface UnifiedNotification {
  id: string;
  type: 'agent_run' | 'enrichment_job';
  name: string;
  status: string;
  records_affected: number;
  records_processed: number;
  timestamp: Date;
  agentType?: string;
  provider?: string;
}

function getDismissedIds(): Set<string> {
  try {
    const saved = localStorage.getItem(DISMISSED_KEY);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissedIds(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

function getLastSeenTimestamp(): number {
  try {
    const saved = localStorage.getItem(LAST_SEEN_KEY);
    return saved ? parseInt(saved, 10) : 0;
  } catch {
    return 0;
  }
}

function saveLastSeenTimestamp(timestamp: number) {
  localStorage.setItem(LAST_SEEN_KEY, timestamp.toString());
}

function formatProviderName(provider: string): string {
  const providerMap: Record<string, string> = {
    'smart-waterfall': 'Smart Enrichment',
    'apollo': 'Apollo',
    'pdl': 'People Data Labs',
    'ai-estimation': 'AI Estimation',
    'deep-research': 'Deep Research',
  };
  return providerMap[provider] || provider;
}

export function NotificationCenter() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(getDismissedIds);

  // Query for AI agent runs
  const { data: recentRuns } = useQuery({
    queryKey: ["agent-notifications", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) throw new Error("No organization found");

      const { data, error } = await supabase
        .from("ai_agent_runs")
        .select("*, ai_agents!inner(name, agent_type)")
        .in("ai_agents.agent_type", ["data_enrichment"])
        .order("started_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as any[];
    },
    enabled: !!userProfile?.org_id,
    refetchInterval: 30000,
  });

  // Query for enrichment jobs
  const { data: enrichmentJobs } = useQuery({
    queryKey: ["enrichment-notifications", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) throw new Error("No organization found");

      const { data, error } = await supabase
        .from("enrichment_jobs")
        .select("*")
        .eq("org_id", userProfile.org_id)
        .in("status", ["completed", "failed", "processing", "pending"])
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as any[];
    },
    enabled: !!userProfile?.org_id,
    refetchInterval: 30000,
  });

  // Real-time subscription for enrichment jobs
  useEffect(() => {
    if (!userProfile?.org_id) return;

    const channel = supabase
      .channel('notification-enrichment-jobs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'enrichment_jobs',
          filter: `org_id=eq.${userProfile.org_id}`,
        },
        (payload) => {
          // Invalidate query to refetch
          queryClient.invalidateQueries({ queryKey: ["enrichment-notifications", userProfile.org_id] });
          
          // Show toast for completed/failed jobs
          const newJob = payload.new as any;
          if (payload.eventType === 'UPDATE' && newJob) {
            if (newJob.status === 'completed') {
              toast({
                title: "Enrichment Complete",
                description: `${formatProviderName(newJob.provider || 'Enrichment')} finished - ${newJob.enriched_records || 0} records enriched`,
              });
            } else if (newJob.status === 'failed') {
              toast({
                title: "Enrichment Failed",
                description: `${formatProviderName(newJob.provider || 'Enrichment')} encountered an error`,
                variant: "destructive",
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile?.org_id, queryClient, toast]);

  // Real-time subscription for AI agent runs
  useEffect(() => {
    if (!userProfile?.org_id) return;

    const channel = supabase
      .channel('notification-agent-runs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_agent_runs',
        },
        (payload) => {
          // Invalidate query to refetch
          queryClient.invalidateQueries({ queryKey: ["agent-notifications", userProfile.org_id] });
          
          // Show toast for completed/failed runs
          const newRun = payload.new as any;
          if (payload.eventType === 'UPDATE' && newRun) {
            if (newRun.status === 'completed') {
              toast({
                title: "Agent Run Complete",
                description: `${newRun.records_affected || 0} records affected`,
              });
            } else if (newRun.status === 'failed') {
              toast({
                title: "Agent Run Failed",
                description: newRun.error_message || "An error occurred",
                variant: "destructive",
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile?.org_id, queryClient, toast]);

  // Merge and normalize both sources - only show recent notifications
  const allNotifications = useMemo<UnifiedNotification[]>(() => {
    const maxAgeMs = NOTIFICATION_MAX_AGE_HOURS * 60 * 60 * 1000;
    const cutoffTime = Date.now() - maxAgeMs;

    const agentNotifications: UnifiedNotification[] = (recentRuns || [])
      .filter(run => new Date(run.started_at).getTime() > cutoffTime)
      .map(run => ({
        id: `agent-${run.id}`,
        type: 'agent_run' as const,
        name: run.ai_agents?.name || "Agent",
        status: run.status,
        records_affected: run.records_affected || 0,
        records_processed: run.records_processed || 0,
        timestamp: new Date(run.started_at),
        agentType: run.ai_agents?.agent_type,
      }));

    const enrichmentNotifications: UnifiedNotification[] = (enrichmentJobs || [])
      .filter(job => new Date(job.created_at).getTime() > cutoffTime)
      .map(job => ({
        id: `enrichment-${job.id}`,
        type: 'enrichment_job' as const,
        name: formatProviderName(job.provider || 'enrichment'),
        status: job.status,
        records_affected: job.enriched_records || 0,
        records_processed: job.processed_records || job.total_records || 0,
        timestamp: new Date(job.created_at),
        provider: job.provider,
      }));

    return [...agentNotifications, ...enrichmentNotifications]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [recentRuns, enrichmentJobs]);

  // Don't clean up dismissed IDs - keep them so notifications stay dismissed
  const visibleNotifications = allNotifications.filter(
    notification => !dismissedIds.has(notification.id)
  );

  // Only count as "unread" notifications newer than last seen timestamp
  const lastSeen = getLastSeenTimestamp();
  const unreadCount = visibleNotifications.filter(
    notification => 
      (notification.status === "completed" || notification.status === "failed") &&
      notification.timestamp.getTime() > lastSeen
  ).length;

  const dismissNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newDismissed = new Set(dismissedIds);
    newDismissed.add(id);
    setDismissedIds(newDismissed);
    saveDismissedIds(newDismissed);
  };

  const dismissAll = () => {
    const allIds = new Set([...dismissedIds, ...allNotifications.map(n => n.id)]);
    setDismissedIds(allIds);
    saveDismissedIds(allIds);
    // Update last seen to current time
    saveLastSeenTimestamp(Date.now());
  };

  const getNavigationPath = (notification: UnifiedNotification): string => {
    if (notification.type === 'enrichment_job') {
      return "/accounts";
    }
    switch (notification.agentType) {
      case "lead_qualification":
        return "/leads?status=qualified";
      case "follow_up":
        return "/leads?status=follow_up_needed";
      case "meeting_scheduler":
        return "/leads?status=meeting_ready";
      case "data_enrichment":
        return "/accounts";
      default:
        return "/agents";
    }
  };

  const handleNotificationClick = (notification: UnifiedNotification) => {
    const path = getNavigationPath(notification);
    navigate(path);
  };

  const getNotificationIcon = (notification: UnifiedNotification) => {
    if (notification.type === 'enrichment_job') {
      switch (notification.status) {
        case "completed":
          return <Database className="h-4 w-4 text-green-500" />;
        case "failed":
          return <XCircle className="h-4 w-4 text-red-500" />;
        case "processing":
          return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
        default:
          return <Database className="h-4 w-4 text-muted-foreground" />;
      }
    }
    
    switch (notification.status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusText = (notification: UnifiedNotification): string => {
    if (notification.type === 'enrichment_job') {
      switch (notification.status) {
        case "completed":
          return "completed";
        case "failed":
          return "failed";
        case "processing":
          return "in progress";
        case "pending":
          return "pending";
        default:
          return notification.status;
      }
    }
    return notification.status;
  };

  const getRecordsText = (notification: UnifiedNotification): string => {
    if (notification.type === 'enrichment_job') {
      if (notification.status === 'pending') {
        return `${notification.records_processed} records queued`;
      }
      return `${notification.records_affected} of ${notification.records_processed} records enriched`;
    }
    return `${notification.records_affected} of ${notification.records_processed} records affected`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Badge variant="secondary">{unreadCount} new</Badge>
            )}
            {visibleNotifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={dismissAll}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[400px]">
          {visibleNotifications.length > 0 ? (
            visibleNotifications.map((notification) => (
              <DropdownMenuItem 
                key={notification.id} 
                className="flex items-start gap-3 p-4 cursor-pointer group hover:bg-accent/50 transition-colors"
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="mt-0.5">{getNotificationIcon(notification)}</div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">
                    {notification.name} {getStatusText(notification)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getRecordsText(notification)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => dismissNotification(notification.id, e)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          )}
        </ScrollArea>
        {allNotifications.length > 0 && dismissedIds.size > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => {
                  setDismissedIds(new Set());
                  saveDismissedIds(new Set());
                }}
              >
                Show {dismissedIds.size} dismissed
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
