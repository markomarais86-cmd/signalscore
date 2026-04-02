import { Card, CardContent } from "@/components/ui/card";
import { Globe, Database, Star, TrendingUp, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface GrowthCommandKPIsProps {
  totalAccounts: number;
  totalScored: number;
  medFitAccounts: number;
  dataCompleteness: number;
  highFitAccounts: number;
  campaignReadyAccounts: number;
  pipelinePotential: number;
  revenueAtRisk: number;
  averageDealSize: number;
}

function getStatusColor(percent: number) {
  if (percent >= 70) return "bg-primary";
  if (percent >= 40) return "bg-status-warning";
  return "bg-destructive";
}

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export function GrowthCommandKPIs({
  totalAccounts,
  totalScored,
  medFitAccounts,
  dataCompleteness,
  highFitAccounts,
  campaignReadyAccounts,
  pipelinePotential,
  revenueAtRisk,
  averageDealSize,
}: GrowthCommandKPIsProps) {
  const navigate = useNavigate();

  const icpFitAccounts = highFitAccounts + medFitAccounts;
  const marketCoverage = totalScored > 0 ? Math.round((icpFitAccounts / totalScored) * 100) : 0;
  const priorityCount = highFitAccounts;

  const tiles = [
    {
      label: "Market Coverage",
      value: totalScored > 0 ? `${marketCoverage}%` : "—",
      soWhat: totalScored > 0
        ? `${icpFitAccounts.toLocaleString()} of ${totalScored.toLocaleString()} match ICP`
        : "No accounts scored yet",
      icon: Globe,
      benchmarkPercent: marketCoverage,
      onClick: () => navigate("/accounts"),
    },
    {
      label: "Data Completeness",
      value: dataCompleteness === 0 && totalScored === 0 ? "—" : `${dataCompleteness}%`,
      soWhat: dataCompleteness === 0 && totalScored === 0
        ? "Score accounts to measure"
        : dataCompleteness >= 80
          ? "Strong enrichment coverage"
          : "Enrich to improve accuracy",
      icon: Database,
      benchmarkPercent: dataCompleteness === 0 && totalScored === 0 ? 50 : dataCompleteness,
      onClick: () => navigate("/enrichment"),
    },
    {
      label: "Priority Accounts",
      value: priorityCount.toLocaleString(),
      soWhat: "High-fit & high-readiness",
      icon: Star,
      benchmarkPercent: totalScored > 0
        ? (priorityCount / totalScored >= 0.10 ? 80 : priorityCount / totalScored >= 0.05 ? 50 : 20)
        : 50,
      onClick: () => navigate("/accounts?fit=high"),
    },
    {
      label: "Pipeline Potential",
      value: formatCurrency(pipelinePotential),
      soWhat: `${campaignReadyAccounts.toLocaleString()} campaign-ready accounts`,
      icon: TrendingUp,
      benchmarkPercent: pipelinePotential > 0 ? 80 : campaignReadyAccounts > 0 ? 50 : 30,
      onClick: () => navigate("/accounts"),
    },
    {
      label: "Revenue at Risk",
      value: formatCurrency(revenueAtRisk),
      soWhat: revenueAtRisk > 0
        ? "Unscored accounts — score to unlock"
        : "All accounts scored",
      icon: AlertTriangle,
      benchmarkPercent: revenueAtRisk === 0 ? 80
        : totalAccounts > 0
          ? (totalScored / totalAccounts >= 0.80 ? 50 : totalScored / totalAccounts >= 0.50 ? 40 : 20)
          : 50,
      onClick: () => navigate("/accounts"),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {tiles.map((tile) => (
        <Card
          key={tile.label}
          className="cursor-pointer group relative overflow-hidden border bg-card hover:border-primary/30 transition-all duration-200"
          onClick={tile.onClick}
        >
          {/* Status bar — thin top border indicating health */}
          <div className={cn("h-0.5 w-full", getStatusColor(tile.benchmarkPercent))} />
          <CardContent className="px-4 py-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.14em] leading-none">
                {tile.label}
              </p>
              <tile.icon className="h-3.5 w-3.5 text-muted-foreground/60" />
            </div>
            <p className="text-2xl font-semibold tracking-tight font-mono text-foreground leading-none pt-1">
              {tile.value}
            </p>
            <p className="text-[11px] text-muted-foreground/70 leading-tight">
              {tile.soWhat}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
