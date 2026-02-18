import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, ClipboardList, Kanban, DollarSign, ArrowRight, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import { useOpportunities, DEAL_STAGES } from "@/hooks/use-opportunities";
import { useAuth } from "@/hooks/use-auth";
import { useBrandedConfig } from "@/hooks/useBrandedConfig";
import { useEffectiveOrg } from "@/hooks/use-effective-org";
import { ComponentErrorBoundary } from "@/components/ComponentErrorBoundary";
import { BulkScoring } from "@/components/BulkScoring";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

function useLeadCount() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.org_id;
  return useQuery({
    queryKey: ["customer-lead-count", orgId],
    queryFn: async () => {
      if (!orgId) return 0;
      const { count, error } = await supabase
        .from("Leads")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!orgId,
  });
}

export default function CustomerDashboard() {
  const { userProfile } = useAuth();
  const { effectiveOrgId } = useEffectiveOrg();
  const { data: brandConfig } = useBrandedConfig({ orgId: effectiveOrgId || undefined });
  const { tasks, isLoading: tasksLoading } = useTasks();
  const { data: deals, isLoading: dealsLoading } = useOpportunities();
  const { data: leadCount, isLoading: leadsLoading } = useLeadCount();

  const hasBrand = !!brandConfig?.brand_primary_color;
  const brandStyle = hasBrand ? { color: "var(--brand-primary)" } : undefined;
  const brandBgStyle = hasBrand ? { backgroundColor: "var(--brand-primary)", opacity: 0.1 } : undefined;

  const pendingTasks = tasks.filter((t) => t.status === "pending" || t.status === "overdue");
  const overdueTasks = tasks.filter((t) => t.status === "overdue" || (t.status === "pending" && new Date(t.due_at) < new Date()));

  const openDeals = deals?.filter((d) => d.status === "open") || [];
  const pipelineValue = openDeals.reduce((sum, d) => sum + (d.amount || 0), 0);

  // Stage summary for pipeline section
  const stageSummary = DEAL_STAGES.filter((s) => s.key !== "closed_won" && s.key !== "closed_lost").map((stage) => {
    const stageDeals = openDeals.filter((d) => d.stage === stage.key);
    return {
      ...stage,
      count: stageDeals.length,
      value: stageDeals.reduce((s, d) => s + (d.amount || 0), 0),
    };
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex items-center gap-4">
        <div
          className={`h-12 w-12 rounded-xl flex items-center justify-center ${hasBrand ? "" : "bg-primary/10"}`}
          style={hasBrand ? { backgroundColor: "color-mix(in srgb, var(--brand-primary) 15%, transparent)" } : undefined}
        >
          <Kanban className={hasBrand ? "h-6 w-6" : "h-6 w-6 text-primary"} style={brandStyle} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {brandConfig?.company_name ? `Welcome back, ${brandConfig.company_name}` : "My Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground">Your leads, tasks, and pipeline at a glance</p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold text-foreground">{leadsLoading ? "—" : leadCount}</p>
              </div>
              <Users className={hasBrand ? "h-8 w-8 opacity-60" : "h-8 w-8 text-primary/60"} style={brandStyle} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Tasks</p>
                <p className="text-2xl font-bold text-foreground">{tasksLoading ? "—" : pendingTasks.length}</p>
                {overdueTasks.length > 0 && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                    <AlertTriangle className="h-3 w-3" /> {overdueTasks.length} overdue
                  </p>
                )}
              </div>
              <ClipboardList className={hasBrand ? "h-8 w-8 opacity-60" : "h-8 w-8 text-primary/60"} style={brandStyle} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Deals</p>
                <p className="text-2xl font-bold text-foreground">{dealsLoading ? "—" : openDeals.length}</p>
              </div>
              <Kanban className={hasBrand ? "h-8 w-8 opacity-60" : "h-8 w-8 text-primary/60"} style={brandStyle} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pipeline Value</p>
                <p className="text-2xl font-bold text-foreground">{dealsLoading ? "—" : formatCurrency(pipelineValue)}</p>
              </div>
              <DollarSign className={hasBrand ? "h-8 w-8 opacity-60" : "h-8 w-8 text-primary/60"} style={brandStyle} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">My Tasks</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tasks">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {tasksLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : pendingTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm">All caught up! No pending tasks.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingTasks.slice(0, 5).map((task) => {
                  const isOverdue = new Date(task.due_at) < new Date();
                  return (
                    <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                      <Clock className={`h-4 w-4 mt-0.5 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Due {new Date(task.due_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={isOverdue ? "destructive" : "secondary"} className="text-xs shrink-0">
                        {task.task_type}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Pipeline */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">My Pipeline</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/opportunities">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {dealsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : openDeals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Kanban className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No open deals yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stageSummary.map((stage) => (
                  <div key={stage.key} className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${stage.color}`} />
                    <span className="text-sm text-foreground flex-1">{stage.label}</span>
                    <Badge variant="outline" className="text-xs">
                      {stage.count} deal{stage.count !== 1 ? "s" : ""}
                    </Badge>
                    <span className="text-sm font-medium text-foreground w-24 text-right">
                      {formatCurrency(stage.value)}
                    </span>
                  </div>
                ))}
                <div className="border-t pt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Total Pipeline</span>
                  <span className="text-sm font-bold text-primary">{formatCurrency(pipelineValue)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bulk Scoring */}
      <ComponentErrorBoundary fallbackTitle="Bulk Scoring unavailable">
        <BulkScoring />
      </ComponentErrorBoundary>
    </div>
  );
}
