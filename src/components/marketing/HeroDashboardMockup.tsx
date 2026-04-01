import { cn } from "@/lib/utils";
import { BarChart3, Users, Target, TrendingUp, Activity } from "lucide-react";

interface HeroDashboardMockupProps {
  className?: string;
}

/** Pure CSS/Tailwind dashboard mockup — no external CDN images */
export function HeroDashboardMockup({ className }: HeroDashboardMockupProps) {
  return (
    <div className={cn("relative max-w-5xl mx-auto px-4 md:px-0", className)}>
      {/* Main dashboard frame */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md shadow-2xl shadow-primary/5 overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-4 py-0.5 rounded-md bg-white/5 text-xs text-white/30 font-mono">
              app.launchpulse.io/dashboard
            </div>
          </div>
        </div>

        {/* Dashboard content */}
        <div className="p-4 md:p-6 space-y-4">
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Accounts", value: "2,847", icon: Users, change: "+12%" },
              { label: "ICP Qualified", value: "1,204", icon: Target, change: "+8%" },
              { label: "Avg Fit Score", value: "74.2", icon: BarChart3, change: "+3.1" },
              { label: "Pipeline Value", value: "$14.2M", icon: TrendingUp, change: "+22%" },
            ].map((kpi, i) => (
              <div
                key={i}
                className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] md:text-xs text-white/40 uppercase tracking-wider">{kpi.label}</span>
                  <kpi.icon className="h-3.5 w-3.5 text-primary/60" />
                </div>
                <div className="text-lg md:text-2xl font-bold text-white">{kpi.value}</div>
                <span className="text-[10px] text-primary">{kpi.change}</span>
              </div>
            ))}
          </div>

          {/* Chart + Segment Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Score distribution chart */}
            <div className="md:col-span-2 rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-white/50 font-medium">Score Distribution</span>
                <Activity className="h-3.5 w-3.5 text-white/30" />
              </div>
              <div className="flex items-end gap-1 h-24">
                {[18, 25, 32, 45, 62, 78, 85, 72, 58, 42, 35, 28, 22, 15, 38, 52, 65, 80, 90, 75].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t transition-all"
                    style={{
                      height: `${h}%`,
                      background: h > 60
                        ? 'hsl(161, 85%, 60%)'
                        : h > 40
                        ? 'hsl(161, 85%, 60%, 0.4)'
                        : 'hsl(161, 85%, 60%, 0.15)',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* ICP Segment breakdown */}
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <span className="text-xs text-white/50 font-medium block mb-3">ICP Segments</span>
              <div className="space-y-2.5">
                {[
                  { label: "High Fit", pct: 42, color: "bg-primary" },
                  { label: "Medium Fit", pct: 31, color: "bg-primary/50" },
                  { label: "Low Fit", pct: 27, color: "bg-white/10" },
                ].map((seg, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-white/60">{seg.label}</span>
                      <span className="text-white/40">{seg.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", seg.color)} style={{ width: `${seg.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Mini donut */}
              <div className="mt-4 flex items-center justify-center">
                <svg viewBox="0 0 36 36" className="w-16 h-16">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke="hsl(161, 85%, 60%, 0.15)" strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke="hsl(161, 85%, 60%)" strokeWidth="3"
                    strokeDasharray="73, 100"
                  />
                  <text x="18" y="20" textAnchor="middle" className="fill-white text-[7px] font-bold">73%</text>
                </svg>
              </div>
            </div>
          </div>

          {/* TAM bar */}
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-xs text-white/40">TAM Coverage</div>
                <div className="text-sm font-bold text-white">$5.9B</div>
              </div>
            </div>
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full" style={{ width: '38%' }} />
            </div>
            <span className="text-xs text-white/40">38% penetrated</span>
          </div>
        </div>
      </div>
    </div>
  );
}
