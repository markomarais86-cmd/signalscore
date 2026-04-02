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
  sourceFilter, onSourceFilterChange, filterStats,
  isSyncing, isLoading, activeScoringJob, showHealthDashboard,
  highFitAccounts, effectiveOrgId,
  onSyncApollo, onRefresh, onScore, onEnrich, onToggleHealth, onPowerUpComplete,
}: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <h1 className="text-lg font-semibold text-foreground leading-none">Growth Command Center</h1>
      </div>

      <div className="flex items-center gap-1">
        <SourceFilterToggle
          value={sourceFilter}
          onChange={onSourceFilterChange}
          stats={{ crm: filterStats?.crm || 0, database: filterStats?.database || 0 }}
        />

        {sourceFilter === "database" && (
          <Button variant="default" onClick={onSyncApollo} disabled={isSyncing} size="sm" className="h-7 text-[11px] px-2.5">
            <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing" : "Sync"}
          </Button>
        )}

        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </Button>

        <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" onClick={onScore} disabled={!!activeScoringJob}>
          <Target className="h-3 w-3" />
          Score
        </Button>

        <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" onClick={onEnrich}>
          <LaunchPulseMark className="h-3 w-3" />
          Enrich
        </Button>

        <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${showHealthDashboard ? "text-primary" : ""}`} onClick={onToggleHealth}>
          <Activity className="h-3.5 w-3.5" />
        </Button>

        <ExportToPdf onExport={() => {}} />
        {effectiveOrgId && <PowerUpButton orgId={effectiveOrgId} onComplete={onPowerUpComplete} />}
        <QuickCampaignButton highFitAccounts={highFitAccounts} disabled={isLoading || highFitAccounts === 0} />
      </div>
    </div>
  );
}
