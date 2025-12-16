import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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

const DISMISSED_KEY = "launchpulse_dismissed_notifications";

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

  // Merge and normalize both sources
  const allNotifications = useMemo<UnifiedNotification[]>(() => {
    const agentNotifications: UnifiedNotification[] = (recentRuns || []).map(run => ({
      id: `agent-${run.id}`,
      type: 'agent_run' as const,
      name: run.ai_agents?.name || "Agent",
      status: run.status,
      records_affected: run.records_affected || 0,
      records_processed: run.records_processed || 0,
      timestamp: new Date(run.started_at),
      agentType: run.ai_agents?.agent_type,
    }));

    const enrichmentNotifications: UnifiedNotification[] = (enrichmentJobs || []).map(job => ({
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

  // Clean up old dismissed IDs that are no longer in the notifications
  useEffect(() => {
    if (allNotifications.length > 0) {
      const currentIds = new Set(allNotifications.map(n => n.id));
      const validDismissed = new Set([...dismissedIds].filter(id => currentIds.has(id)));
      if (validDismissed.size !== dismissedIds.size) {
        setDismissedIds(validDismissed);
        saveDismissedIds(validDismissed);
      }
    }
  }, [allNotifications]);

  const visibleNotifications = allNotifications.filter(
    notification => !dismissedIds.has(notification.id)
  );

  const unreadCount = visibleNotifications.filter(
    notification => notification.status === "completed" || notification.status === "failed"
  ).length;

  const dismissNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newDismissed = new Set(dismissedIds);
    newDismissed.add(id);
    setDismissedIds(newDismissed);
    saveDismissedIds(newDismissed);
  };

  const dismissAll = () => {
    const allIds = new Set(allNotifications.map(n => n.id));
    setDismissedIds(allIds);
    saveDismissedIds(allIds);
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
