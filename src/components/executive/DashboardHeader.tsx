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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold leading-tight truncate">Growth Command Center</h1>
        <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">Real-time revenue intelligence across your TAM</p>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
        <SourceFilterToggle
          value={sourceFilter}
          onChange={onSourceFilterChange}
          stats={{ crm: filterStats?.crm || 0, database: filterStats?.database || 0 }}
        />

        {sourceFilter === "database" && (
          <Button variant="default" onClick={onSyncApollo} disabled={isSyncing} size="sm">
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">{isSyncing ? "Syncing..." : "Sync Apollo"}</span>
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>

        <Button variant="outline" size="sm" onClick={onScore} disabled={!!activeScoringJob}>
          <Target className="h-4 w-4 mr-1.5" />
          <span className="hidden lg:inline">{activeScoringJob ? "Scoring..." : "Score"}</span>
        </Button>

        <Button variant="outline" size="sm" onClick={onEnrich}>
          <LaunchPulseMark className="h-4 w-4 mr-1.5" />
          <span className="hidden lg:inline">Enrich</span>
        </Button>

        <Button
          variant={showHealthDashboard ? "default" : "outline"}
          size="sm"
          onClick={onToggleHealth}
        >
          <Activity className="h-4 w-4" />
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
