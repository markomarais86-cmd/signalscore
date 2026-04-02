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
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold leading-none tracking-tight text-foreground sm:text-2xl">
          Growth Command Center
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Revenue intelligence across ICP coverage, market opportunity, and campaign readiness.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <SourceFilterToggle
          value={sourceFilter}
          onChange={onSourceFilterChange}
          stats={{ crm: filterStats?.crm || 0, database: filterStats?.database || 0 }}
        />

        {sourceFilter === "database" && (
          <Button variant="default" onClick={onSyncApollo} disabled={isSyncing} size="sm" className="h-7 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing" : "Sync Apollo"}</span>
          </Button>
        )}

        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </Button>

        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onScore} disabled={!!activeScoringJob}>
          <Target className="h-3.5 w-3.5" />
          <span>{activeScoringJob ? "Scoring" : "Score"}</span>
        </Button>

        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onEnrich}>
          <LaunchPulseMark className="h-3.5 w-3.5" />
          <span>Enrich</span>
        </Button>

        <Button
          variant={showHealthDashboard ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs"
          onClick={onToggleHealth}
        >
          <Activity className="h-3.5 w-3.5" />
        </Button>

        <ExportToPdf onExport={() => {}} />

        {effectiveOrgId && (
          <PowerUpButton orgId={effectiveOrgId} onComplete={onPowerUpComplete} />
        )}

        <QuickCampaignButton highFitAccounts={highFitAccounts} disabled={isLoading || highFitAccounts === 0} />
      </div>
    </div>
  );
}
