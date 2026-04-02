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

function getBenchmarkColor(percent: number) {
  if (percent >= 70) return "text-primary";
  if (percent >= 40) return "text-status-warning";
  return "text-destructive";
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
        ? `${icpFitAccounts.toLocaleString()} of ${totalScored.toLocaleString()} scored accounts match ICP (A+B bands)`
        : "No accounts scored yet — run scoring to see coverage",
      icon: Globe,
      benchmarkPercent: marketCoverage,
      onClick: () => navigate("/accounts"),
    },
    {
      label: "Data Completeness",
      value: dataCompleteness === 0 && totalScored === 0 ? "—" : `${dataCompleteness}%`,
      soWhat: dataCompleteness === 0 && totalScored === 0
        ? "No scored accounts yet — score to measure completeness"
        : dataCompleteness >= 80
          ? "Strong enrichment — ready for accurate scoring"
          : "Enrich accounts to improve scoring accuracy",
      icon: Database,
      benchmarkPercent: dataCompleteness === 0 && totalScored === 0 ? 50 : dataCompleteness,
      onClick: () => navigate("/enrichment"),
    },
    {
      label: "Priority Accounts",
      value: priorityCount.toLocaleString(),
      soWhat: "High-fit & high-readiness — sales focus here",
      icon: Star,
      benchmarkPercent: totalScored > 0
        ? (priorityCount / totalScored >= 0.10 ? 80 : priorityCount / totalScored >= 0.05 ? 50 : 20)
        : 50,
      onClick: () => navigate("/accounts?fit=high"),
    },
    {
      label: "Pipeline Potential",
      value: formatCurrency(pipelinePotential),
      soWhat: `Modelled upside across ${campaignReadyAccounts.toLocaleString()} campaign-ready accounts`,
      icon: TrendingUp,
      benchmarkPercent: pipelinePotential > 0 ? 80 : campaignReadyAccounts > 0 ? 50 : 30,
      onClick: () => navigate("/accounts"),
    },
    {
      label: "Revenue at Risk",
      value: formatCurrency(revenueAtRisk),
      soWhat: revenueAtRisk > 0
        ? "Unscored accounts represent unrealized pipeline — score to unlock"
        : "All accounts scored — pipeline fully visible",
      icon: AlertTriangle,
      benchmarkPercent: revenueAtRisk === 0 ? 80
        : totalAccounts > 0
          ? (totalScored / totalAccounts >= 0.80 ? 50 : totalScored / totalAccounts >= 0.50 ? 40 : 20)
          : 50,
      onClick: () => navigate("/accounts"),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {tiles.map((tile) => (
        <Card
          key={tile.label}
          className={cn(
            "cursor-pointer group relative overflow-hidden border shadow-sm hover:shadow-lg transition-all duration-300",
            getBenchmarkBg(tile.benchmarkPercent)
          )}
          onClick={tile.onClick}
        >
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <tile.icon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {tile.label}
              </p>
            </div>
            <p className={cn("text-3xl font-bold tracking-tight", getBenchmarkColor(tile.benchmarkPercent))}>
              {tile.value}
            </p>
            <p className="text-xs text-muted-foreground leading-snug">
              {tile.soWhat}
            </p>
          </CardContent>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        </Card>
      ))}
    </div>
  );
}
