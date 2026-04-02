import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

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
}: GrowthCommandKPIsProps) {
  const navigate = useNavigate();

  const icpFitAccounts = highFitAccounts + medFitAccounts;
  const marketCoverage = totalScored > 0 ? Math.round((icpFitAccounts / totalScored) * 100) : 0;

  const tiles = [
    {
      label: "Market Coverage",
      value: totalScored > 0 ? `${marketCoverage}%` : "—",
      sub: totalScored > 0 ? `${icpFitAccounts.toLocaleString()} of ${totalScored.toLocaleString()}` : null,
      onClick: () => navigate("/accounts"),
    },
    {
      label: "Data Completeness",
      value: dataCompleteness === 0 && totalScored === 0 ? "—" : `${dataCompleteness}%`,
      sub: null,
      onClick: () => navigate("/enrichment"),
    },
    {
      label: "Priority Accounts",
      value: highFitAccounts.toLocaleString(),
      sub: totalScored > 0 ? `${((highFitAccounts / totalScored) * 100).toFixed(1)}% of scored` : null,
      onClick: () => navigate("/accounts?fit=high"),
    },
    {
      label: "Pipeline Potential",
      value: formatCurrency(pipelinePotential),
      sub: `${campaignReadyAccounts.toLocaleString()} ready`,
      onClick: () => navigate("/accounts"),
    },
    {
      label: "Revenue at Risk",
      value: formatCurrency(revenueAtRisk),
      sub: totalAccounts > 0 ? `${totalAccounts - totalScored} unscored` : null,
      onClick: () => navigate("/accounts"),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-px rounded-lg border bg-border overflow-hidden">
      {tiles.map((tile) => (
        <button
          key={tile.label}
          type="button"
          className="bg-card px-4 py-4 text-left transition-colors hover:bg-muted/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          onClick={tile.onClick}
        >
          <p className="text-[11px] text-muted-foreground mb-1.5 leading-none">
            {tile.label}
          </p>
          <p className="text-[22px] font-semibold font-mono tabular-nums text-foreground leading-none tracking-tight">
            {tile.value}
          </p>
          {tile.sub && (
            <p className="text-[11px] text-muted-foreground/60 mt-1.5 leading-none font-mono tabular-nums">
              {tile.sub}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}
