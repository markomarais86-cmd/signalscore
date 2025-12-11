import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Bell, CheckCircle, XCircle, Info, X, CheckCheck, ChevronRight } from "lucide-react";
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

export function NotificationCenter() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(getDismissedIds);

  const { data: recentRuns } = useQuery({
    queryKey: ["notifications", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) throw new Error("No organization found");

      const { data, error } = await supabase
        .from("ai_agent_runs")
        .select("*, ai_agents(name)")
        .order("started_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as any[];
    },
    enabled: !!userProfile?.org_id,
    refetchInterval: 30000,
  });

  // Clean up old dismissed IDs that are no longer in the notifications
  useEffect(() => {
    if (recentRuns) {
      const currentIds = new Set(recentRuns.map(r => r.id));
      const validDismissed = new Set([...dismissedIds].filter(id => currentIds.has(id)));
      if (validDismissed.size !== dismissedIds.size) {
        setDismissedIds(validDismissed);
        saveDismissedIds(validDismissed);
      }
    }
  }, [recentRuns]);

  const visibleNotifications = recentRuns?.filter(
    run => !dismissedIds.has(run.id)
  ) || [];

  const unreadCount = visibleNotifications.filter(
    run => run.status === "completed" || run.status === "failed"
  ).length;

  const dismissNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newDismissed = new Set(dismissedIds);
    newDismissed.add(id);
    setDismissedIds(newDismissed);
    saveDismissedIds(newDismissed);
  };

  const dismissAll = () => {
    if (!recentRuns) return;
    const allIds = new Set(recentRuns.map(r => r.id));
    setDismissedIds(allIds);
    saveDismissedIds(allIds);
  };

  const getNavigationPath = (agentType: string): string => {
    switch (agentType) {
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

  const handleNotificationClick = (run: any) => {
    const agentType = run.ai_agents?.agent_type || run.agent_type;
    const path = getNavigationPath(agentType);
    navigate(path);
  };

  const getNotificationIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
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
            visibleNotifications.map((run) => (
              <DropdownMenuItem 
                key={run.id} 
                className="flex items-start gap-3 p-4 cursor-pointer group hover:bg-accent/50 transition-colors"
                onClick={() => handleNotificationClick(run)}
              >
                <div className="mt-0.5">{getNotificationIcon(run.status)}</div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">
                    {run.ai_agents?.name || "Agent"} {run.status}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {run.records_affected} of {run.records_processed} records affected
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => dismissNotification(run.id, e)}
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
        {recentRuns && recentRuns.length > 0 && dismissedIds.size > 0 && (
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
