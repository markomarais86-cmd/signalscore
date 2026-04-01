import { cn } from "@/lib/utils";

/** CSS-native ICP donut + segment card — replaces external SVGs */
export function ICPVisualization({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-5", className)}>
      <div className="text-xs text-white/40 mb-3 font-medium uppercase tracking-wider">ICP Coverage</div>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 36 36" className="w-20 h-20 flex-shrink-0">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" stroke="hsl(161, 85%, 60%, 0.12)" strokeWidth="3.5"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" stroke="hsl(161, 85%, 60%)" strokeWidth="3.5"
            strokeDasharray="68, 100" strokeLinecap="round"
          />
          <text x="18" y="18" textAnchor="middle" dominantBaseline="central" className="fill-white text-[6px] font-bold">68%</text>
          <text x="18" y="23" textAnchor="middle" className="fill-white/40 text-[3px]">qualified</text>
        </svg>
        <div className="space-y-1.5 flex-1">
          {[
            { label: "Enterprise", pct: 42 },
            { label: "Mid-Market", pct: 35 },
            { label: "Growth", pct: 23 },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${s.pct}%`, opacity: 1 - i * 0.25 }} />
              </div>
              <span className="text-[10px] text-white/40 w-8 text-right">{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** CSS-native TAM indicator card — replaces external SVG */
export function TAMIndicator({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-5", className)}>
      <div className="text-xs text-white/40 mb-1 font-medium uppercase tracking-wider">Total Addressable Market</div>
      <div className="text-3xl font-bold text-white mb-2">$5.9B</div>
      <div className="space-y-1">
        {[
          { label: "Penetrated", value: "$2.2B", pct: 38 },
          { label: "Whitespace", value: "$3.7B", pct: 62 },
        ].map((r, i) => (
          <div key={i}>
            <div className="flex justify-between text-[10px] text-white/40 mb-0.5">
              <span>{r.label}</span>
              <span>{r.value}</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${r.pct}%`,
                  background: i === 0 ? 'hsl(161, 85%, 60%)' : 'hsl(161, 85%, 60%, 0.25)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
