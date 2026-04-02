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

const ACCENT_COLORS = [
  "bg-primary",          // mint green
  "bg-primary/70",       // lighter mint
  "bg-accent",           // dark green
  "bg-primary/50",       // soft mint
  "bg-destructive/70",   // muted red for risk
] as const;

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
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {tiles.map((tile, i) => (
        <button
          key={tile.label}
          type="button"
          className="stat-card text-left p-4 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary animate-fade-in-up"
          style={{ animationDelay: `${i * 60}ms` }}
          onClick={tile.onClick}
        >
          {/* Accent bar */}
          <div className={`stat-accent ${ACCENT_COLORS[i]}`} />

          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 leading-none">
            {tile.label}
          </p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-foreground leading-none tracking-tight">
            {tile.value}
          </p>
          {tile.sub && (
            <p className="text-[11px] text-muted-foreground/60 mt-2 leading-none font-mono tabular-nums">
              {tile.sub}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}
