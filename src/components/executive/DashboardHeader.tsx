import { Button } from "@/components/ui/button";
import { RefreshCw, Target, Activity, Zap } from "lucide-react";
import { LaunchPulseMark } from "@/components/BrandLogo";
import { SourceFilterToggle, type SourceFilter } from "@/components/executive/SourceFilterToggle";
import { ExportToPdf } from "@/components/executive/ExportToPdf";
import { PowerUpButton } from "@/components/executive/PowerUpButton";
import { QuickCampaignButton } from "@/components/executive/QuickCampaignButton";
import { useAuth } from "@/hooks/use-auth";

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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardHeader({
  sourceFilter, onSourceFilterChange, filterStats,
  isSyncing, isLoading, activeScoringJob, showHealthDashboard,
  highFitAccounts, effectiveOrgId,
  onSyncApollo, onRefresh, onScore, onEnrich, onToggleHealth, onPowerUpComplete,
}: DashboardHeaderProps) {
  const { userProfile } = useAuth();
  const firstName = userProfile?.full_name?.split(" ")[0] || "";

  return (
    <div className="space-y-4">
      {/* Greeting banner */}
      <div className="rounded-xl bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/20 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {getGreeting()}{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {highFitAccounts > 0
                ? `You have ${highFitAccounts} A-tier accounts and active signals`
                : "Your growth command center is ready"}
            </p>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-3">
        <SourceFilterToggle
          value={sourceFilter}
          onChange={onSourceFilterChange}
          stats={{ crm: filterStats?.crm || 0, database: filterStats?.database || 0 }}
        />

        <div className="flex items-center gap-1.5">
          {sourceFilter === "database" && (
            <Button variant="default" onClick={onSyncApollo} disabled={isSyncing} size="sm" className="h-8 text-xs">
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing" : "Sync Apollo"}
            </Button>
          )}

          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>

          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onScore} disabled={!!activeScoringJob}>
            <Target className="h-3.5 w-3.5" />
            Score
          </Button>

          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onEnrich}>
            <LaunchPulseMark className="h-3.5 w-3.5" />
            Enrich
          </Button>

          <Button
            variant={showHealthDashboard ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={onToggleHealth}
          >
            <Activity className="h-3.5 w-3.5" />
          </Button>

          <ExportToPdf onExport={() => {}} />
          {effectiveOrgId && <PowerUpButton orgId={effectiveOrgId} onComplete={onPowerUpComplete} />}
          <QuickCampaignButton highFitAccounts={highFitAccounts} disabled={isLoading || highFitAccounts === 0} />
        </div>
      </div>
    </div>
  );
}
