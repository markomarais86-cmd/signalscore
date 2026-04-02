import { Button } from "@/components/ui/button";
import { RefreshCw, Target, Activity } from "lucide-react";
import { LaunchPulseMark } from "@/components/BrandLogo";
import { SourceFilterToggle, type SourceFilter } from "@/components/executive/SourceFilterToggle";
import { ExportToPdf } from "@/components/executive/ExportToPdf";
import { PowerUpButton } from "@/components/executive/PowerUpButton";
import { QuickCampaignButton } from "@/components/executive/QuickCampaignButton";

interface DashboardHeaderProps {
  sourceFilter: SourceFilter;
  onSourceFilterChange: (v: SourceFilter) => void;
  filterStats: { crm: number; database: number } | undefined;
  isSyncing: boolean;
  isLoading: boolean;
  activeScoringJob: unknown;
  showHealthDashboard: boolean;
  highFitAccounts: number;
  effectiveOrgId: string | undefined;
  onSyncApollo: () => void;
  onRefresh: () => void;
  onScore: () => void;
  onEnrich: () => void;
  onToggleHealth: () => void;
  onPowerUpComplete: () => void;
}

export function DashboardHeader({
  sourceFilter,
  onSourceFilterChange,
  filterStats,
  isSyncing,
  isLoading,
  activeScoringJob,
  showHealthDashboard,
  highFitAccounts,
  effectiveOrgId,
  onSyncApollo,
  onRefresh,
  onScore,
  onEnrich,
  onToggleHealth,
  onPowerUpComplete,
}: DashboardHeaderProps) {
  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-col gap-5 px-5 py-5 lg:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
              Executive dashboard
            </div>
            <div>
              <h1 className="text-2xl font-semibold leading-none sm:text-3xl lg:text-4xl">Growth Command Center</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                Revenue intelligence across your ICP coverage, market opportunity, and campaign readiness.
              </p>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:justify-end">
            <SourceFilterToggle
              value={sourceFilter}
              onChange={onSourceFilterChange}
              stats={{ crm: filterStats?.crm || 0, database: filterStats?.database || 0 }}
            />

            {sourceFilter === "database" && (
              <Button variant="default" onClick={onSyncApollo} disabled={isSyncing} size="sm">
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Syncing Apollo" : "Sync Apollo"}</span>
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>

            <Button variant="outline" size="sm" onClick={onScore} disabled={!!activeScoringJob}>
              <Target className="h-4 w-4" />
              <span>{activeScoringJob ? "Scoring" : "Score accounts"}</span>
            </Button>

            <Button variant="outline" size="sm" onClick={onEnrich}>
              <LaunchPulseMark className="h-4 w-4" />
              <span>Enrich</span>
            </Button>

            <Button
              variant={showHealthDashboard ? "default" : "outline"}
              size="sm"
              onClick={onToggleHealth}
            >
              <Activity className="h-4 w-4" />
              <span>Health</span>
            </Button>

            <ExportToPdf onExport={() => {}} />

            {effectiveOrgId && (
              <PowerUpButton orgId={effectiveOrgId} onComplete={onPowerUpComplete} />
            )}

            <QuickCampaignButton highFitAccounts={highFitAccounts} disabled={isLoading || highFitAccounts === 0} />
          </div>
        </div>
      </div>
    </section>
  );
}
