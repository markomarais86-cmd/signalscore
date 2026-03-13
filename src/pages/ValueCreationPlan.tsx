import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRoles } from "@/hooks/use-roles";
import { useEffectiveOrg } from "@/hooks/use-effective-org";
import { useValueCreationPlan, Milestone } from "@/hooks/use-value-creation-plan";
import { useOrgSwitcher } from "@/contexts/OrgSwitcherContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2,
  Circle,
  Clock,
  Rocket,
  Target,
  Sparkles,
  BarChart3,
  Zap,
  CalendarDays,
  Plus,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

// Phase config using semantic design tokens
const phaseConfig: Record<string, { icon: typeof Target; label: string }> = {
  Foundation: { icon: Target, label: "Foundation" },
  Enrichment: { icon: Sparkles, label: "Enrichment" },
  Scoring: { icon: BarChart3, label: "Scoring" },
  Activation: { icon: Zap, label: "Activation" },
  Optimization: { icon: Rocket, label: "Optimization" },
};

const phases = ["Foundation", "Enrichment", "Scoring", "Activation", "Optimization"];

function MilestoneCard({
  milestone,
  onComplete,
  onUncomplete,
}: {
  milestone: Milestone;
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
}) {
  const isComplete = !!milestone.completed_at;
  const isAutoDetected = !isComplete && milestone.autoDetected;

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 transition-all ${
        isComplete
          ? "border-primary/30 bg-primary/5"
          : isAutoDetected
          ? "border-primary/30 bg-primary/5 ring-1 ring-primary/20"
          : "border-border bg-card hover:bg-muted/30"
      }`}
    >
      {/* Status icon */}
      <div className="pt-0.5">
        {isComplete ? (
          <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
        ) : isAutoDetected ? (
          <Tooltip>
            <TooltipTrigger>
              <AlertCircle className="h-5 w-5 text-primary shrink-0" />
            </TooltipTrigger>
            <TooltipContent>Auto-detected as complete — click to confirm</TooltipContent>
          </Tooltip>
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isComplete ? "line-through text-muted-foreground" : ""}`}>
            {milestone.title}
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
            Day {milestone.target_day}
          </Badge>
          {isAutoDetected && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
              <Sparkles className="h-2.5 w-2.5" />
              Auto
            </Badge>
          )}
        </div>
        {milestone.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{milestone.description}</p>
        )}
        {milestone.completed_at && (
          <p className="text-xs text-primary mt-1">
            Completed {new Date(milestone.completed_at).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Action */}
      <div className="shrink-0">
        {isComplete ? (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onUncomplete(milestone.id)}>
            Undo
          </Button>
        ) : (
          <Button
            variant={isAutoDetected ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onComplete(milestone.id)}
          >
            {isAutoDetected ? "Confirm" : "Complete"}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ValueCreationPlanPage() {
  const { isSuperAdmin, loading: rolesLoading } = useRoles();
  const navigate = useNavigate();
  const { effectiveOrgId } = useEffectiveOrg();
  const { organizations } = useOrgSwitcher();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const targetOrgId = selectedOrgId || effectiveOrgId;
  const {
    plan,
    milestones,
    isLoading,
    createPlan,
    completeMilestone,
    uncompleteMilestone,
    completedCount,
    totalCount,
    progressPct,
    daysElapsed,
    daysRemaining,
  } = useValueCreationPlan(targetOrgId);

  // Auth guard — must be in useEffect to avoid conditional returns before hooks
  useEffect(() => {
    if (!rolesLoading && !isSuperAdmin) {
      navigate("/dashboard");
    }
  }, [rolesLoading, isSuperAdmin, navigate]);

  if (rolesLoading || !isSuperAdmin) return null;

  // Group milestones by phase
  const groupedByPhase: Record<string, Milestone[]> = {};
  phases.forEach((p) => (groupedByPhase[p] = []));
  milestones.forEach((m) => {
    if (groupedByPhase[m.phase]) groupedByPhase[m.phase].push(m);
  });

  const selectedOrgName = organizations.find((o) => o.id === targetOrgId)?.name ?? "Select organization";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">100-Day Value Creation Plan</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track GTM readiness milestones from CRM connection to optimized campaigns
          </p>
        </div>
        <Select value={targetOrgId ?? ""} onValueChange={setSelectedOrgId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select organization" />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* No plan state */}
      {!isLoading && !plan && targetOrgId && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Rocket className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">No 100-Day Plan for {selectedOrgName}</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Initialize a 100-day GTM value creation plan with 20 milestones across 5 phases.
                Progress will be auto-detected from platform activity.
              </p>
            </div>
            <Button onClick={() => createPlan.mutate()} disabled={createPlan.isPending} className="mt-2">
              <Plus className="h-4 w-4 mr-2" />
              {createPlan.isPending ? "Creating..." : "Initialize 100-Day Plan"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      )}

      {/* Plan exists */}
      {plan && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{progressPct}%</p>
                    <p className="text-xs text-muted-foreground">Overall Progress</p>
                  </div>
                </div>
                <Progress value={progressPct} className="mt-3 h-1.5" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{completedCount}<span className="text-sm text-muted-foreground font-normal">/{totalCount}</span></p>
                  <p className="text-xs text-muted-foreground">Milestones Complete</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-accent/10 p-2">
                  <CalendarDays className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{daysElapsed}</p>
                  <p className="text-xs text-muted-foreground">Days Elapsed</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{daysRemaining}</p>
                  <p className="text-xs text-muted-foreground">Days Remaining</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Phase timeline */}
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {phases.map((phase, i) => {
              const cfg = phaseConfig[phase];
              const phaseMilestones = groupedByPhase[phase] || [];
              const phaseComplete = phaseMilestones.filter((m) => m.completed_at || m.autoDetected).length;
              const phaseTotal = phaseMilestones.length;
              const Icon = cfg.icon;
              const allDone = phaseComplete === phaseTotal && phaseTotal > 0;

              return (
                <div key={phase} className="flex items-center">
                  <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                    allDone ? "bg-primary/15" : "bg-muted/50"
                  }`}>
                    <Icon className={`h-4 w-4 ${allDone ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${allDone ? "text-primary" : "text-foreground"}`}>{phase}</span>
                    <Badge variant={allDone ? "default" : "secondary"} className="text-[10px] h-4">
                      {phaseComplete}/{phaseTotal}
                    </Badge>
                  </div>
                  {i < phases.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground/30 mx-1 shrink-0" />}
                </div>
              );
            })}
          </div>

          {/* Milestone cards by phase */}
          <div className="space-y-6">
            {phases.map((phase) => {
              const cfg = phaseConfig[phase];
              const phaseMilestones = groupedByPhase[phase] || [];
              if (phaseMilestones.length === 0) return null;
              const Icon = cfg.icon;

              return (
                <Card key={phase}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-md p-1.5 bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-medium">{phase}</CardTitle>
                        <CardDescription className="text-xs">
                          Days {phaseMilestones[0]?.target_day}–{phaseMilestones[phaseMilestones.length - 1]?.target_day}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {phaseMilestones.map((m) => (
                      <MilestoneCard
                        key={m.id}
                        milestone={m}
                        onComplete={(id) => completeMilestone.mutate({ milestoneId: id })}
                        onUncomplete={(id) => uncompleteMilestone.mutate(id)}
                      />
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
