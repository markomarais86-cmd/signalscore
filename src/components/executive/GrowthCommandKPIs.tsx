import { useNavigate } from "react-router-dom";
import { MiniSparkline } from "@/components/executive/MiniSparkline";
import { useCountUp } from "@/hooks/useCountUp";

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
  "bg-primary",
  "bg-primary/70",
  "bg-accent",
  "bg-primary/50",
  "bg-destructive/70",
] as const;

function KPITile({
  label,
  rawValue,
  formatFn,
  sub,
  onClick,
  accentClass,
  sparkSeed,
  sparkColor,
  delay,
}: {
  label: string;
  rawValue: number;
  formatFn?: (v: number) => string;
  sub: string | null;
  onClick: () => void;
  accentClass: string;
  sparkSeed: number;
  sparkColor?: string;
  delay: number;
}) {
  const animated = useCountUp(rawValue, 900);
  const displayValue = formatFn ? formatFn(animated) : animated.toLocaleString();

  return (
    <button
      type="button"
      className="stat-card text-left p-4 group focus:outline-none focus-visible:ring-1 focus-visible:ring-primary animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
      onClick={onClick}
    >
      <div className={`stat-accent ${accentClass}`} />

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 leading-none">
            {label}
          </p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-foreground leading-none tracking-tight">
            {rawValue === 0 && !formatFn ? "—" : displayValue}
          </p>
        </div>
        <div className="opacity-40 group-hover:opacity-70 transition-opacity pt-3">
          <MiniSparkline
            data={generateTrendFromSeed(sparkSeed, rawValue)}
            width={56}
            height={22}
            color={sparkColor || "hsl(var(--primary))"}
          />
        </div>
      </div>

      {sub && (
        <p className="text-[11px] text-muted-foreground/60 mt-2 leading-none font-mono tabular-nums">
          {sub}
        </p>
      )}
    </button>
  );
}

/** Generates a deterministic 7-point trend from a seed */
function generateTrendFromSeed(seed: number, target: number): number[] {
  const base = target || 50;
  const points: number[] = [];
  let val = base * 0.65;
  for (let i = 0; i < 7; i++) {
    val += Math.sin(seed * (i + 1) * 0.7) * base * 0.12 + base * 0.05;
    points.push(Math.max(0, val));
  }
  return points;
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

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <KPITile
        label="Market Coverage"
        rawValue={marketCoverage}
        formatFn={(v) => totalScored > 0 ? `${v}%` : "—"}
        sub={totalScored > 0 ? `${icpFitAccounts.toLocaleString()} of ${totalScored.toLocaleString()}` : null}
        onClick={() => navigate("/accounts")}
        accentClass={ACCENT_COLORS[0]}
        sparkSeed={1}
        delay={0}
      />
      <KPITile
        label="Data Completeness"
        rawValue={dataCompleteness}
        formatFn={(v) => (dataCompleteness === 0 && totalScored === 0) ? "—" : `${v}%`}
        sub={null}
        onClick={() => navigate("/enrichment")}
        accentClass={ACCENT_COLORS[1]}
        sparkSeed={2}
        delay={60}
      />
      <KPITile
        label="Priority Accounts"
        rawValue={highFitAccounts}
        sub={totalScored > 0 ? `${((highFitAccounts / totalScored) * 100).toFixed(1)}% of scored` : null}
        onClick={() => navigate("/accounts?fit=high")}
        accentClass={ACCENT_COLORS[2]}
        sparkSeed={3}
        delay={120}
      />
      <KPITile
        label="Pipeline Potential"
        rawValue={pipelinePotential}
        formatFn={formatCurrency}
        sub={`${campaignReadyAccounts.toLocaleString()} ready`}
        onClick={() => navigate("/accounts")}
        accentClass={ACCENT_COLORS[3]}
        sparkSeed={4}
        sparkColor="hsl(var(--primary))"
        delay={180}
      />
      <KPITile
        label="Revenue at Risk"
        rawValue={revenueAtRisk}
        formatFn={formatCurrency}
        sub={totalAccounts > 0 ? `${totalAccounts - totalScored} unscored` : null}
        onClick={() => navigate("/accounts")}
        accentClass={ACCENT_COLORS[4]}
        sparkSeed={5}
        sparkColor="hsl(var(--destructive))"
        delay={240}
      />
    </div>
  );
}
