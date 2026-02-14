import { Card, CardContent } from "@/components/ui/card";
import { Globe, Database, Star, TrendingUp, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface GrowthCommandKPIsProps {
  totalAccounts: number;
  tamEstimate: number;
  dataCompleteness: number;
  highFitAccounts: number;
  campaignReadyAccounts: number;
  pipelinePotential: number;
  revenueAtRisk: number;
  averageDealSize: number;
}

function getBenchmarkColor(percent: number) {
  if (percent >= 70) return "text-green-500";
  if (percent >= 40) return "text-yellow-500";
  return "text-destructive";
}

function getBenchmarkBg(percent: number) {
  if (percent >= 70) return "bg-green-500/10 border-green-500/20";
  if (percent >= 40) return "bg-yellow-500/10 border-yellow-500/20";
  return "bg-destructive/10 border-destructive/20";
}

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export function GrowthCommandKPIs({
  totalAccounts,
  tamEstimate,
  dataCompleteness,
  highFitAccounts,
  campaignReadyAccounts,
  pipelinePotential,
  revenueAtRisk,
  averageDealSize,
}: GrowthCommandKPIsProps) {
  const navigate = useNavigate();

  const hasTAM = tamEstimate > 0 && tamEstimate !== totalAccounts;
  const marketCoverage = hasTAM ? Math.round((totalAccounts / tamEstimate) * 100) : 0;
  const priorityCount = highFitAccounts;

  const tiles = [
    {
      label: "Market Coverage",
      value: hasTAM ? `${marketCoverage}%` : totalAccounts.toLocaleString(),
      soWhat: hasTAM
        ? `${totalAccounts.toLocaleString()} of ${tamEstimate.toLocaleString()} reachable accounts in system`
        : `${totalAccounts.toLocaleString()} accounts loaded — connect TAM source for coverage %`,
      icon: Globe,
      benchmarkPercent: hasTAM ? marketCoverage : (totalAccounts > 0 ? 60 : 0),
      onClick: () => navigate("/accounts"),
    },
    {
      label: "Data Completeness",
      value: `${dataCompleteness}%`,
      soWhat: dataCompleteness >= 80
        ? "Strong enrichment — ready for accurate scoring"
        : "Enrich accounts to improve scoring accuracy",
      icon: Database,
      benchmarkPercent: dataCompleteness,
      onClick: () => navigate("/enrichment"),
    },
    {
      label: "Priority Accounts",
      value: priorityCount.toLocaleString(),
      soWhat: "High-fit & high-readiness — sales focus here",
      icon: Star,
      benchmarkPercent: totalAccounts > 0 ? Math.round((priorityCount / totalAccounts) * 100) : 0,
      onClick: () => navigate("/accounts?fit=high"),
    },
    {
      label: "Pipeline Potential",
      value: formatCurrency(pipelinePotential),
      soWhat: `Modelled upside across ${campaignReadyAccounts.toLocaleString()} campaign-ready accounts`,
      icon: TrendingUp,
      benchmarkPercent: pipelinePotential > 0 ? 60 : 30,
      onClick: () => navigate("/accounts"),
    },
    {
      label: "Revenue at Risk",
      value: formatCurrency(revenueAtRisk),
      soWhat: "Opportunity lost to data gaps — enrich to recover",
      icon: AlertTriangle,
      benchmarkPercent: revenueAtRisk > 0 ? 30 : 80,
      onClick: () => navigate("/enrichment"),
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
