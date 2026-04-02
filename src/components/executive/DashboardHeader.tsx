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
  isSyncing,
  isLoading,
  activeScoringJob,
  highFitAccounts,
  effectiveOrgId,
  onSyncApollo,
  onRefresh,
  onScore,
  onEnrich,
  onPowerUpComplete,
}: DashboardHeaderProps) {
  return (
    <div className="dashboard-toolbar">
      <div className="min-w-0 space-y-1">
        <p className="section-kicker">Overview</p>
        <p className="font-heading text-[0.98rem] font-medium tracking-[-0.04em] text-foreground/85">
          Revenue operating system
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <Button variant="default" onClick={onSyncApollo} disabled={isSyncing} size="sm" className="h-9 rounded-full px-4 text-[12px] font-medium">
            <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing" : "Sync"}
          </Button>

        <Button variant="ghost" size="sm" className="h-9 w-9 rounded-full p-0" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </Button>

        <Button variant="ghost" size="sm" className="h-9 rounded-full px-3.5 text-[12px] font-medium" onClick={onScore} disabled={!!activeScoringJob}>
          <Target className="h-3 w-3" />
          Score
        </Button>

        <Button variant="ghost" size="sm" className="h-9 rounded-full px-3.5 text-[12px] font-medium" onClick={onEnrich}>
          <LaunchPulseMark className="h-3 w-3" />
          Enrich
        </Button>

        <ExportToPdf />
        {effectiveOrgId && <PowerUpButton orgId={effectiveOrgId} onComplete={onPowerUpComplete} />}
        <QuickCampaignButton highFitAccounts={highFitAccounts} disabled={isLoading || highFitAccounts === 0} />
      </div>
    </div>
  );
}
