import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Bell, CheckCircle, XCircle, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Notification {
  id: string;
  agent_id: string;
  status: string;
  records_processed: number;
  records_affected: number;
  started_at: string;
  completed_at: string | null;
}

export function NotificationCenter() {
  const { userProfile } = useAuth();

  const { data: recentRuns } = useQuery({
    queryKey: ["notifications", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) throw new Error("No organization found");

      const { data, error } = await supabase
        .from("ai_agent_runs")
        .select("*, ai_agents(name)")
        .order("started_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as any[];
    },
    enabled: !!userProfile?.org_id,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const unreadCount = recentRuns?.filter(
    (run) => run.status === "completed" || run.status === "failed"
  ).length || 0;

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
          {unreadCount > 0 && (
            <Badge variant="secondary">{unreadCount} new</Badge>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {recentRuns && recentRuns.length > 0 ? (
            recentRuns.map((run) => (
              <DropdownMenuItem key={run.id} className="flex items-start gap-3 p-4 cursor-default">
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
              </DropdownMenuItem>
            ))
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
