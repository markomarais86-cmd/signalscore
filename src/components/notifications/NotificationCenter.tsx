import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Bell, CheckCircle, XCircle, Info, X, CheckCheck, ChevronRight,
  Database, Loader2, Zap, ClipboardList, AlertTriangle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const DISMISSED_KEY = "launchpulse_dismissed_notifications";
const LAST_SEEN_KEY = "launchpulse_notifications_last_seen";
const NOTIFICATION_MAX_AGE_HOURS = 48;

type NotificationType = "agent_run" | "enrichment_job" | "signal" | "task_overdue";

interface UnifiedNotification {
  id: string;
  type: NotificationType;
  name: string;
  status: string;
  records_affected: number;
  records_processed: number;
  timestamp: Date;
  agentType?: string;
  provider?: string;
  priority?: string;
  accountName?: string;
}

function getDismissedIds(): Set<string> {
  try {
    const saved = localStorage.getItem(DISMISSED_KEY);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch { return new Set(); }
}

function saveDismissedIds(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

function getLastSeenTimestamp(): number {
  try {
    const saved = localStorage.getItem(LAST_SEEN_KEY);
    return saved ? parseInt(saved, 10) : 0;
  } catch { return 0; }
}

function saveLastSeenTimestamp(timestamp: number) {
  localStorage.setItem(LAST_SEEN_KEY, timestamp.toString());
}

function formatProviderName(provider: string): string {
  const providerMap: Record<string, string> = {
    "smart-waterfall": "Smart Enrichment",
    apollo: "Apollo",
    pdl: "People Data Labs",
    "ai-estimation": "AI Estimation",
    "deep-research": "Deep Research",
  };
  return providerMap[provider] || provider;
}

// ─── Tabs for filtering ──────────────────────────────────────

const TABS: { value: string; label: string; types: NotificationType[] }[] = [
  { value: "all", label: "All", types: [] },
  { value: "signals", label: "Signals", types: ["signal"] },
  { value: "tasks", label: "Tasks", types: ["task_overdue"] },
  { value: "jobs", label: "Jobs", types: ["agent_run", "enrichment_job"] },
];

export function NotificationCenter() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(getDismissedIds);
  const [activeTab, setActiveTab] = useState("all");

  // ── Agent runs ──
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

  // ── Enrichment jobs ──
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

  // ── Account signals (high/critical only) ──
  const { data: recentSignals } = useQuery({
    queryKey: ["signal-notifications", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) return [];
      const { data, error } = await supabase
        .from("account_signals")
        .select("id, title, signal_type, signal_priority, account_name, created_at")
        .eq("org_id", userProfile.org_id)
        .in("signal_priority", ["high", "critical"])
        .is("dismissed_at", null)
        .is("actioned_at", null)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!userProfile?.org_id,
    refetchInterval: 30000,
  });

  // ── Overdue tasks ──
  const { data: overdueTasks } = useQuery({
    queryKey: ["task-notifications", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) return [];
      const { data, error } = await supabase
        .from("lead_tasks")
        .select("id, title, task_type, due_at, status")
        .eq("org_id", userProfile.org_id)
        .in("status", ["pending", "overdue"])
        .lt("due_at", new Date().toISOString())
        .order("due_at", { ascending: true })
        .limit(10);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!userProfile?.org_id,
    refetchInterval: 60000,
  });

  // ── Real-time: enrichment jobs ──
  useEffect(() => {
    if (!userProfile?.org_id) return;
    const channel = supabase
      .channel("notification-enrichment-jobs")
      .on("postgres_changes", { event: "*", schema: "public", table: "enrichment_jobs", filter: `org_id=eq.${userProfile.org_id}` }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["enrichment-notifications", userProfile.org_id] });
        const newJob = payload.new as any;
        if (payload.eventType === "UPDATE" && newJob) {
          if (newJob.status === "completed") {
            toast({ title: "Enrichment Complete", description: `${formatProviderName(newJob.provider || "Enrichment")} finished - ${newJob.enriched_records || 0} records enriched` });
          } else if (newJob.status === "failed") {
            toast({ title: "Enrichment Failed", description: `${formatProviderName(newJob.provider || "Enrichment")} encountered an error`, variant: "destructive" });
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userProfile?.org_id, queryClient, toast]);

  // ── Real-time: agent runs ──
  useEffect(() => {
    if (!userProfile?.org_id) return;
    const channel = supabase
      .channel("notification-agent-runs")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_agent_runs" }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["agent-notifications", userProfile.org_id] });
        const newRun = payload.new as any;
        if (payload.eventType === "UPDATE" && newRun) {
          if (newRun.status === "completed") {
            toast({ title: "Agent Run Complete", description: `${newRun.records_affected || 0} records affected` });
          } else if (newRun.status === "failed") {
            toast({ title: "Agent Run Failed", description: newRun.error_message || "An error occurred", variant: "destructive" });
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userProfile?.org_id, queryClient, toast]);

  // ── Real-time: signals ──
  useEffect(() => {
    if (!userProfile?.org_id) return;
    const channel = supabase
      .channel("notification-signals")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "account_signals", filter: `org_id=eq.${userProfile.org_id}` }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["signal-notifications", userProfile.org_id] });
        const sig = payload.new as any;
        if (sig.signal_priority === "high" || sig.signal_priority === "critical") {
          toast({ title: `${sig.signal_priority === "critical" ? "🔴" : "🟠"} ${sig.title}`, description: sig.account_name || sig.signal_type });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userProfile?.org_id, queryClient, toast]);

  // ── Merge all sources ──
  const allNotifications = useMemo<UnifiedNotification[]>(() => {
    const maxAgeMs = NOTIFICATION_MAX_AGE_HOURS * 60 * 60 * 1000;
    const cutoffTime = Date.now() - maxAgeMs;

    const agentNotifs: UnifiedNotification[] = (recentRuns || [])
      .filter((r) => new Date(r.started_at).getTime() > cutoffTime)
      .map((r) => ({
        id: `agent-${r.id}`, type: "agent_run" as const, name: r.ai_agents?.name || "Agent",
        status: r.status, records_affected: r.records_affected || 0, records_processed: r.records_processed || 0,
        timestamp: new Date(r.started_at), agentType: r.ai_agents?.agent_type,
      }));

    const enrichNotifs: UnifiedNotification[] = (enrichmentJobs || [])
      .filter((j) => new Date(j.created_at).getTime() > cutoffTime)
      .map((j) => ({
        id: `enrichment-${j.id}`, type: "enrichment_job" as const, name: formatProviderName(j.provider || "enrichment"),
        status: j.status, records_affected: j.enriched_records || 0, records_processed: j.processed_records || j.total_records || 0,
        timestamp: new Date(j.created_at), provider: j.provider,
      }));

    const signalNotifs: UnifiedNotification[] = (recentSignals || [])
      .filter((s) => new Date(s.created_at).getTime() > cutoffTime)
      .map((s) => ({
        id: `signal-${s.id}`, type: "signal" as const, name: s.title, status: s.signal_priority,
        records_affected: 0, records_processed: 0, timestamp: new Date(s.created_at),
        priority: s.signal_priority, accountName: s.account_name,
      }));

    const taskNotifs: UnifiedNotification[] = (overdueTasks || []).map((t) => ({
      id: `task-${t.id}`, type: "task_overdue" as const, name: t.title, status: "overdue",
      records_affected: 0, records_processed: 0, timestamp: new Date(t.due_at),
    }));

    return [...agentNotifs, ...enrichNotifs, ...signalNotifs, ...taskNotifs]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [recentRuns, enrichmentJobs, recentSignals, overdueTasks]);

  const visibleNotifications = allNotifications.filter((n) => !dismissedIds.has(n.id));

  const lastSeen = getLastSeenTimestamp();
  const unreadCount = visibleNotifications.filter(
    (n) => n.timestamp.getTime() > lastSeen &&
      (n.status === "completed" || n.status === "failed" || n.type === "signal" || n.type === "task_overdue")
  ).length;

  const filteredNotifications = useMemo(() => {
    const tab = TABS.find((t) => t.value === activeTab);
    if (!tab || tab.value === "all") return visibleNotifications;
    return visibleNotifications.filter((n) => tab.types.includes(n.type));
  }, [visibleNotifications, activeTab]);

  const dismissNotification = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = new Set(dismissedIds);
    updated.add(id);
    setDismissedIds(updated);
    saveDismissedIds(updated);
  }, [dismissedIds]);

  const dismissAll = useCallback(() => {
    const allIds = new Set([...dismissedIds, ...allNotifications.map((n) => n.id)]);
    setDismissedIds(allIds);
    saveDismissedIds(allIds);
    saveLastSeenTimestamp(Date.now());
  }, [dismissedIds, allNotifications]);

  const handleOpen = useCallback((open: boolean) => {
    if (open && unreadCount > 0) {
      saveLastSeenTimestamp(Date.now());
    }
  }, [unreadCount]);

  const getNavigationPath = (n: UnifiedNotification): string => {
    if (n.type === "signal") return "/accounts";
    if (n.type === "task_overdue") return "/tasks";
    if (n.type === "enrichment_job") return "/accounts";
    switch (n.agentType) {
      case "lead_qualification": return "/leads?status=qualified";
      case "follow_up": return "/leads?status=follow_up_needed";
      case "meeting_scheduler": return "/leads?status=meeting_ready";
      case "data_enrichment": return "/accounts";
      default: return "/ai-agents";
    }
  };

  const getIcon = (n: UnifiedNotification) => {
    if (n.type === "signal") {
      return <Zap className={`h-4 w-4 ${n.priority === "critical" ? "text-destructive" : "text-amber-500"}`} />;
    }
    if (n.type === "task_overdue") {
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
    if (n.type === "enrichment_job") {
      switch (n.status) {
        case "completed": return <Database className="h-4 w-4 text-green-500" />;
        case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
        case "processing": return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
        default: return <Database className="h-4 w-4 text-muted-foreground" />;
      }
    }
    switch (n.status) {
      case "completed": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getDescription = (n: UnifiedNotification): string => {
    if (n.type === "signal") return n.accountName || n.status;
    if (n.type === "task_overdue") return `Due ${formatDistanceToNow(n.timestamp, { addSuffix: true })}`;
    if (n.type === "enrichment_job") {
      if (n.status === "pending") return `${n.records_processed} records queued`;
      return `${n.records_affected} of ${n.records_processed} records enriched`;
    }
    return `${n.records_affected} of ${n.records_processed} records affected`;
  };

  const getStatusLabel = (n: UnifiedNotification): string => {
    if (n.type === "signal") return n.priority === "critical" ? "Critical" : "High";
    if (n.type === "task_overdue") return "Overdue";
    if (n.type === "enrichment_job") {
      const map: Record<string, string> = { completed: "Done", failed: "Failed", processing: "Running", pending: "Queued" };
      return map[n.status] || n.status;
    }
    return n.status;
  };

  const getStatusVariant = (n: UnifiedNotification): "destructive" | "secondary" | "outline" => {
    if (n.type === "task_overdue" || n.priority === "critical" || n.status === "failed") return "destructive";
    if (n.status === "completed") return "secondary";
    return "outline";
  };

  // Count per tab for badges
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: visibleNotifications.length };
    for (const tab of TABS) {
      if (tab.value !== "all") {
        counts[tab.value] = visibleNotifications.filter((n) => tab.types.includes(n.type)).length;
      }
    }
    return counts;
  }, [visibleNotifications]);

  return (
    <DropdownMenu onOpenChange={handleOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && <Badge variant="secondary" className="text-xs">{unreadCount} new</Badge>}
            {visibleNotifications.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={dismissAll}>
                <CheckCheck className="h-3 w-3 mr-1" /> Clear all
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-9 px-2">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs px-2 py-1 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                {tab.label}
                {tabCounts[tab.value] > 0 && (
                  <span className="ml-1 text-muted-foreground">({tabCounts[tab.value]})</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <ScrollArea className="h-[380px]">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="flex items-start gap-3 p-3 cursor-pointer group hover:bg-accent/50 transition-colors"
                onClick={() => navigate(getNavigationPath(n))}
              >
                <div className="mt-0.5">{getIcon(n)}</div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-sm font-medium truncate">{n.name}</p>
                  <p className="text-xs text-muted-foreground">{getDescription(n)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(n.timestamp, { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant={getStatusVariant(n)} className="text-[10px] px-1.5">{getStatusLabel(n)}</Badge>
                  <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => dismissNotification(n.id, e)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="font-medium text-foreground">No notifications</p>
              <p className="text-xs mt-1">You're all caught up!</p>
            </div>
          )}
        </ScrollArea>

        {allNotifications.length > 0 && dismissedIds.size > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2 text-center">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => { setDismissedIds(new Set()); saveDismissedIds(new Set()); }}>
                Show {dismissedIds.size} dismissed
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
