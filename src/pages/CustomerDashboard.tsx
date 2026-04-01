import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, ClipboardList, Kanban, DollarSign, ArrowRight, CheckCircle2,
  Clock, AlertTriangle, Upload, Target, Sparkles, Activity, Zap,
  BarChart3, Search, FileDown, Shield,
} from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import { useOpportunities, DEAL_STAGES } from "@/hooks/use-opportunities";
import { useAuth } from "@/hooks/use-auth";
import { useBrandedConfig } from "@/hooks/useBrandedConfig";
import { useEffectiveOrg } from "@/hooks/use-effective-org";
import { ComponentErrorBoundary } from "@/components/ComponentErrorBoundary";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useServiceType } from "@/hooks/use-service-type";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ─── Data hooks ──────────────────────────────────────────────

function useCustomerStats() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.org_id;

  return useQuery({
    queryKey: ["customer-dashboard-stats", orgId],
    queryFn: async () => {
      if (!orgId) return null;

      const [leadsRes, accountsRes, icpRes, enrichedRes, signalsRes] = await Promise.all([
        supabase.from("Leads").select("*", { count: "exact", head: true }).eq("org_id", orgId),
        supabase.from("accounts").select("*", { count: "exact", head: true }).eq("org_id", orgId),
        supabase.from("accounts").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("icp_qualified", true),
        supabase.from("accounts").select("*", { count: "exact", head: true }).eq("org_id", orgId).not("enriched_at", "is", null),
        supabase.from("account_signals").select("id, signal_type, signal_priority, title, account_name, created_at")
          .eq("org_id", orgId)
          .is("dismissed_at", null)
          .is("actioned_at", null)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      return {
        leadCount: leadsRes.count || 0,
        accountCount: accountsRes.count || 0,
        icpQualifiedCount: icpRes.count || 0,
        enrichedCount: enrichedRes.count || 0,
        recentSignals: signalsRes.data || [],
      };
    },
    enabled: !!orgId,
  });
}

function useScoreDistribution() {
  const { userProfile } = useAuth();
  const orgId = userProfile?.org_id;

  return useQuery({
    queryKey: ["customer-score-distribution", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("accounts")
        .select("propensity_score")
        .eq("org_id", orgId)
        .not("propensity_score", "is", null);

      if (!data?.length) return [];

      const buckets = [
        { range: "0-20", min: 0, max: 20, count: 0 },
        { range: "21-40", min: 21, max: 40, count: 0 },
        { range: "41-60", min: 41, max: 60, count: 0 },
        { range: "61-80", min: 61, max: 80, count: 0 },
        { range: "81-100", min: 81, max: 100, count: 0 },
      ];

      for (const row of data) {
        const score = row.propensity_score ?? 0;
        const bucket = buckets.find((b) => score >= b.min && score <= b.max);
        if (bucket) bucket.count++;
      }

      return buckets;
    },
    enabled: !!orgId,
  });
}

// ─── Sub-components ──────────────────────────────────────────

const BUCKET_COLORS = [
  "hsl(var(--destructive))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--primary))",
];

const PRIORITY_MAP: Record<string, { variant: "destructive" | "secondary" | "outline"; label: string }> = {
  critical: { variant: "destructive", label: "Critical" },
  high: { variant: "destructive", label: "High" },
  medium: { variant: "secondary", label: "Medium" },
  low: { variant: "outline", label: "Low" },
};

function ScoreDistributionChart({ data }: { data: { range: string; count: number }[] }) {
  if (!data.length || data.every((d) => d.count === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <BarChart3 className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">No scored accounts yet</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <XAxis dataKey="range" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
          formatter={(value: number) => [value, "Accounts"]}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={BUCKET_COLORS[i]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function SignalsFeed({ signals }: { signals: any[] }) {
  if (!signals.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <Activity className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm font-medium text-foreground">No active signals</p>
        <p className="text-xs mt-1">Signals will appear here as they are detected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {signals.map((s) => {
        const p = PRIORITY_MAP[s.signal_priority] || PRIORITY_MAP.low;
        return (
          <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
            <Zap className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
              {s.account_name && (
                <p className="text-xs text-muted-foreground mt-0.5">{s.account_name}</p>
              )}
            </div>
            <Badge variant={p.variant} className="text-xs shrink-0">{p.label}</Badge>
          </div>
        );
      })}
    </div>
  );
}

function QuickActions() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: "Top Accounts", icon: Target, to: "/accounts?sort=propensity_score&dir=desc" },
        { label: "Overdue Tasks", icon: AlertTriangle, to: "/tasks" },
        { label: "View Leads", icon: Search, to: "/leads" },
        { label: "Export Data", icon: FileDown, to: "/list-builder" },
      ].map((a) => (
        <Button key={a.label} variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
          <Link to={a.to}>
            <a.icon className="h-5 w-5 text-primary" />
            <span className="text-xs font-medium">{a.label}</span>
          </Link>
        </Button>
      ))}
    </div>
  );
}

function FirstRunChecklist({ accountCount, leadCount, hasTasks }: { accountCount: number; leadCount: number; hasTasks: boolean }) {
  const navigate = useNavigate();
  const { isSelfService } = useServiceType();

  const steps = [
    { label: "Upload your accounts", done: accountCount > 0, action: () => navigate("/data-upload"), icon: Upload, show: isSelfService },
    { label: "Configure your ICP", done: false, action: () => navigate("/icp-manager"), icon: Target, show: isSelfService },
    { label: "Review your leads", done: leadCount > 0, action: () => navigate("/leads"), icon: Users, show: true },
    { label: "Create your first task", done: hasTasks, action: () => navigate("/tasks"), icon: ClipboardList, show: true },
  ].filter((s) => s.show);

  const completedCount = steps.filter((s) => s.done).length;
  if (completedCount === steps.length) return null;

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Get Started with LaunchPulse</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{completedCount} of {steps.length} steps completed</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(completedCount / steps.length) * 100}%` }} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {steps.map((step, i) => (
            <button key={i} onClick={step.action} className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left">
              <div className={`p-1.5 rounded-lg ${step.done ? "bg-primary/10" : "bg-muted"}`}>
                {step.done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <step.icon className="h-4 w-4 text-muted-foreground" />}
              </div>
              <span className={`text-sm flex-1 ${step.done ? "text-muted-foreground line-through" : "text-foreground font-medium"}`}>{step.label}</span>
              {!step.done && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────

export default function CustomerDashboard() {
  const { userProfile } = useAuth();
  const { effectiveOrgId } = useEffectiveOrg();
  const { data: brandConfig } = useBrandedConfig({ orgId: effectiveOrgId || undefined });
  const { tasks, isLoading: tasksLoading } = useTasks();
  const { data: deals, isLoading: dealsLoading } = useOpportunities();
  const { data: stats, isLoading: statsLoading } = useCustomerStats();
  const { data: scoreDist = [] } = useScoreDistribution();

  const hasBrand = !!brandConfig?.brand_primary_color;
  const brandStyle = hasBrand ? { color: "var(--brand-primary)" } : undefined;

  const pendingTasks = tasks.filter((t) => t.status === "pending" || t.status === "overdue");
  const overdueTasks = tasks.filter((t) => t.status === "overdue" || (t.status === "pending" && new Date(t.due_at) < new Date()));

  const openDeals = deals?.filter((d) => d.status === "open") || [];
  const pipelineValue = openDeals.reduce((sum, d) => sum + (d.amount || 0), 0);

  const stageSummary = DEAL_STAGES.filter((s) => s.key !== "closed_won" && s.key !== "closed_lost").map((stage) => {
    const stageDeals = openDeals.filter((d) => d.stage === stage.key);
    return { ...stage, count: stageDeals.length, value: stageDeals.reduce((s, d) => s + (d.amount || 0), 0) };
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);

  const icpRate = stats?.accountCount
    ? Math.round((stats.icpQualifiedCount / stats.accountCount) * 100)
    : 0;

  const enrichRate = stats?.accountCount
    ? Math.round((stats.enrichedCount / stats.accountCount) * 100)
    : 0;

  const isFirstRun = !statsLoading && !tasksLoading && (stats?.leadCount || 0) === 0 && (stats?.accountCount || 0) === 0;

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

      {/* First-run checklist */}
      {isFirstRun && (
        <FirstRunChecklist accountCount={stats?.accountCount || 0} leadCount={stats?.leadCount || 0} hasTasks={tasks.length > 0} />
      )}

      {/* Quick Actions */}
      {!isFirstRun && <QuickActions />}

      {/* KPI Cards — 6 metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Accounts", value: statsLoading ? "—" : stats?.accountCount ?? 0, icon: Users },
          { label: "Leads", value: statsLoading ? "—" : stats?.leadCount ?? 0, icon: Users },
          { label: "ICP Qualified", value: statsLoading ? "—" : `${icpRate}%`, icon: Shield },
          { label: "Enriched", value: statsLoading ? "—" : `${enrichRate}%`, icon: Sparkles },
          { label: "Pending Tasks", value: tasksLoading ? "—" : pendingTasks.length, icon: ClipboardList, alert: overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : undefined },
          { label: "Pipeline", value: dealsLoading ? "—" : formatCurrency(pipelineValue), icon: DollarSign },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                <kpi.icon className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <p className="text-xl font-bold text-foreground">{kpi.value}</p>
              {kpi.alert && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3" /> {kpi.alert}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Middle row: Score Distribution + Signals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Account Score Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ComponentErrorBoundary fallbackTitle="Chart unavailable">
              <ScoreDistributionChart data={scoreDist} />
            </ComponentErrorBoundary>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Recent Signals
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/accounts">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <SignalsFeed signals={stats?.recentSignals || []} />
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Tasks + Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">My Tasks</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tasks">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {tasksLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : pendingTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-primary/60" />
                <p className="text-sm font-medium text-foreground">All caught up!</p>
                <p className="text-xs mt-1">No pending tasks right now.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingTasks.slice(0, 5).map((task) => {
                  const isOverdue = new Date(task.due_at) < new Date();
                  return (
                    <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                      <Clock className={`h-4 w-4 mt-0.5 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Due {new Date(task.due_at).toLocaleDateString()}</p>
                      </div>
                      <Badge variant={isOverdue ? "destructive" : "secondary"} className="text-xs shrink-0">{task.task_type}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">My Pipeline</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/opportunities">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {dealsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : openDeals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Kanban className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium text-foreground">No open deals yet</p>
                <p className="text-xs mt-1">Create an opportunity to start tracking your pipeline.</p>
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <Link to="/opportunities">Add Deal</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {stageSummary.map((stage) => (
                  <div key={stage.key} className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${stage.color}`} />
                    <span className="text-sm text-foreground flex-1">{stage.label}</span>
                    <Badge variant="outline" className="text-xs">{stage.count} deal{stage.count !== 1 ? "s" : ""}</Badge>
                    <span className="text-sm font-medium text-foreground w-24 text-right">{formatCurrency(stage.value)}</span>
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
    </div>
  );
}
