import { cn } from "@/lib/utils";
import { TrendingUp, Users, Target, DollarSign, PieChart } from "lucide-react";

interface HeroDashboardMockupProps {
  className?: string;
}

// Mini bar chart component for stat cards
function MiniBarChart({ values, color = "primary" }: { values: number[]; color?: string }) {
  return (
    <div className="flex items-end gap-1 h-8 mt-3">
      {values.map((value, i) => (
        <div
          key={i}
          className={cn(
            "w-3 rounded-sm bg-primary/60",
            i === values.length - 1 && "bg-primary"
          )}
          style={{ height: `${value}%` }}
        />
      ))}
    </div>
  );
}

// Stat card component
function StatCard({
  label,
  value,
  subtext,
  barValues,
  delay = 0,
}: {
  label: string;
  value: string;
  subtext?: string;
  barValues: number[];
  delay?: number;
}) {
  return (
    <div
      className="bg-card/60 backdrop-blur-xl border border-border/40 rounded-xl p-4 animate-fade-in"
      style={{ animationDelay: `${delay}s` }}
    >
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      {subtext && <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>}
      <MiniBarChart values={barValues} />
    </div>
  );
}

// ICP Donut chart visualization
function ICPDonutChart() {
  return (
    <div className="relative w-24 h-24">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="hsl(var(--muted) / 0.3)"
          strokeWidth="12"
        />
        {/* High fit segment */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="12"
          strokeDasharray="100 151"
          strokeDashoffset="0"
        />
        {/* Medium fit segment */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="hsl(var(--primary) / 0.5)"
          strokeWidth="12"
          strokeDasharray="60 191"
          strokeDashoffset="-100"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-primary">64%</span>
        <span className="text-[10px] text-muted-foreground">High Fit</span>
      </div>
    </div>
  );
}

// Horizontal bar chart for ICP coverage
function CoverageBarChart() {
  const data = [
    { label: "Enterprise", accounts: 85, leads: 72 },
    { label: "Mid-Market", accounts: 70, leads: 55 },
    { label: "SMB", accounts: 45, leads: 38 },
  ];

  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="text-foreground">{item.accounts}%</span>
          </div>
          <div className="h-2 bg-muted/20 rounded-full overflow-hidden flex gap-0.5">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${item.accounts}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HeroDashboardMockup({ className }: HeroDashboardMockupProps) {
  return (
    <div
      className={cn(
        "relative max-w-4xl mx-auto perspective-1000",
        className
      )}
    >
      {/* Glow effect behind the dashboard */}
      <div
        className="absolute inset-0 -z-10 blur-3xl opacity-30"
        style={{
          background: "radial-gradient(ellipse at center, hsl(var(--primary) / 0.4), transparent 70%)",
        }}
      />

      {/* Main dashboard container with perspective tilt */}
      <div
        className="relative transform-gpu hover:scale-[1.02] transition-transform duration-500"
        style={{
          transform: "rotateX(8deg) rotateY(-2deg)",
          transformStyle: "preserve-3d",
        }}
      >
        {/* Stat cards row */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <StatCard
            label="Total Accounts"
            value="78,755"
            subtext="+12% this month"
            barValues={[40, 55, 45, 70, 85, 90]}
            delay={0.1}
          />
          <StatCard
            label="Total Leads"
            value="278,636"
            subtext="+8% this month"
            barValues={[50, 60, 70, 65, 80, 95]}
            delay={0.2}
          />
          <StatCard
            label="Campaign Ready"
            value="24,892"
            subtext="ICP qualified"
            barValues={[30, 40, 35, 50, 60, 75]}
            delay={0.3}
          />
        </div>

        {/* ICP Coverage Overview card */}
        <div
          className="bg-card/60 backdrop-blur-xl border border-border/40 rounded-xl p-5 animate-fade-in"
          style={{ animationDelay: "0.4s" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <PieChart className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">ICP Coverage Overview</h3>
              <p className="text-xs text-muted-foreground">Total market and high-fit distribution</p>
            </div>
          </div>

          <div className="grid grid-cols-[auto_1fr_auto] gap-6 items-center">
            {/* TAM indicator */}
            <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 text-center">
              <div className="flex items-center gap-2 justify-center mb-1">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">TAM</span>
              </div>
              <span className="text-xl font-bold text-primary">$5.9B</span>
            </div>

            {/* Coverage bar chart */}
            <CoverageBarChart />

            {/* ICP donut chart */}
            <ICPDonutChart />
          </div>
        </div>
      </div>
    </div>
  );
}
