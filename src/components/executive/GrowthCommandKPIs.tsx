import { Globe, Database, Star, TrendingUp, AlertTriangle, type LucideIcon } from "lucide-react";
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

interface KPITile {
  label: string;
  value: string;
  sub?: string | null;
  icon: LucideIcon;
  accentColor: string; // tailwind border color
  iconBg: string;
  iconColor: string;
  onClick: () => void;
}

function KPICard({ tile }: { tile: KPITile }) {
  return (
    <button
      type="button"
      onClick={tile.onClick}
      className="group relative rounded-xl border bg-card text-left transition-all hover:shadow-lg hover:-translate-y-0.5 overflow-hidden"
    >
      {/* Colored top accent bar */}
      <div className={`h-1 w-full ${tile.accentColor}`} />

      <div className="px-5 pt-4 pb-5">
        {/* Icon */}
        <div className={`inline-flex items-center justify-center h-10 w-10 rounded-lg ${tile.iconBg} mb-4`}>
          <tile.icon className={`h-5 w-5 ${tile.iconColor}`} />
        </div>

        {/* Value */}
        <p className="text-[32px] font-bold font-mono tabular-nums text-foreground leading-none tracking-tight">
          {tile.value}
        </p>

        {/* Label */}
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.15em] mt-2">
          {tile.label}
        </p>

        {/* Sub detail */}
        {tile.sub && (
          <p className="text-[11px] text-muted-foreground/50 mt-1 font-mono tabular-nums">
            {tile.sub}
          </p>
        )}
      </div>
    </button>
  );
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

  const tiles: KPITile[] = [
    {
      label: "Market Coverage",
      value: totalScored > 0 ? `${marketCoverage}%` : "—",
      sub: totalScored > 0 ? `${icpFitAccounts.toLocaleString()} of ${totalScored.toLocaleString()}` : null,
      icon: Globe,
      accentColor: "bg-primary",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      onClick: () => navigate("/accounts"),
    },
    {
      label: "Priority Accounts",
      value: highFitAccounts.toLocaleString(),
      sub: totalScored > 0 ? `B: ${medFitAccounts.toLocaleString()}` : null,
      icon: Star,
      accentColor: "bg-primary",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      onClick: () => navigate("/accounts?fit=high"),
    },
    {
      label: "Pipeline Potential",
      value: formatCurrency(pipelinePotential),
      sub: `${campaignReadyAccounts.toLocaleString()} ready`,
      icon: TrendingUp,
      accentColor: "bg-primary",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      onClick: () => navigate("/accounts"),
    },
    {
      label: "Enrichment",
      value: dataCompleteness === 0 && totalScored === 0 ? "—" : `${dataCompleteness}%`,
      sub: null,
      icon: Database,
      accentColor: "bg-status-warning",
      iconBg: "bg-status-warning/10",
      iconColor: "text-status-warning",
      onClick: () => navigate("/enrichment"),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {tiles.map((tile) => (
        <KPICard key={tile.label} tile={tile} />
      ))}
    </div>
  );
}
