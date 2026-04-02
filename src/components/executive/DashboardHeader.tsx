import { Button } from "@/components/ui/button";
import { RefreshCw, Target } from "lucide-react";
import { LaunchPulseMark } from "@/components/BrandLogo";
import { ExportToPdf } from "@/components/executive/ExportToPdf";
import { PowerUpButton } from "@/components/executive/PowerUpButton";
import { QuickCampaignButton } from "@/components/executive/QuickCampaignButton";
import type { SourceFilter } from "@/components/executive/SourceFilterToggle";

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
      <h1 className="font-heading text-[1.05rem] font-semibold leading-none tracking-[-0.03em] text-foreground">
        Growth Command Center
      </h1>

      <div className="flex items-center gap-1">
        {sourceFilter === "database" && (
          <Button variant="default" onClick={onSyncApollo} disabled={isSyncing} size="sm" className="h-8 px-3 text-[12px] font-medium">
            <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing" : "Sync"}
          </Button>
        )}

        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </Button>

        <Button variant="ghost" size="sm" className="h-8 px-2.5 text-[12px] font-medium" onClick={onScore} disabled={!!activeScoringJob}>
          <Target className="h-3 w-3" />
          Score
        </Button>

        <Button variant="ghost" size="sm" className="h-8 px-2.5 text-[12px] font-medium" onClick={onEnrich}>
          <LaunchPulseMark className="h-3 w-3" />
          Enrich
        </Button>

        <ExportToPdf onExport={() => {}} />
        {effectiveOrgId && <PowerUpButton orgId={effectiveOrgId} onComplete={onPowerUpComplete} />}
        <QuickCampaignButton highFitAccounts={highFitAccounts} disabled={isLoading || highFitAccounts === 0} />
      </div>
    </div>
  );
}
