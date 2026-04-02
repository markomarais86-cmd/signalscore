import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ICPCoveragePanelProps {
  highFitAccounts: number;
  medFitAccounts: number;
  lowFitAccounts: number;
  totalScored: number;
  highFitLeads?: number;
  medFitLeads?: number;
  lowFitLeads?: number;
  totalLeads?: number;
  className?: string;
}

const FIT_COLORS = {
  high: "hsl(var(--fit-high))",
  medium: "hsl(var(--fit-medium))",
  low: "hsl(var(--fit-low))",
};

export function ICPCoveragePanel({
  highFitAccounts, medFitAccounts, lowFitAccounts, totalScored,
  highFitLeads = 0, medFitLeads = 0, lowFitLeads = 0, totalLeads = 0,
  className,
}: ICPCoveragePanelProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"accounts" | "leads">("accounts");

  const isAccounts = activeTab === "accounts";
  const data = isAccounts
    ? [
        { name: "High Fit", value: highFitAccounts, color: FIT_COLORS.high },
        { name: "Medium Fit", value: medFitAccounts, color: FIT_COLORS.medium },
        { name: "Low Fit", value: lowFitAccounts, color: FIT_COLORS.low },
      ]
    : [
        { name: "High Fit", value: highFitLeads, color: FIT_COLORS.high },
        { name: "Medium Fit", value: medFitLeads, color: FIT_COLORS.medium },
        { name: "Low Fit", value: lowFitLeads, color: FIT_COLORS.low },
      ];

  const total = isAccounts ? totalScored : totalLeads;
  const icpFit = data[0].value + data[1].value;
  const pct = total > 0 ? Math.round((icpFit / total) * 100) : 0;

  // Unique ID for gradient
  const gradId = useMemo(() => `cov-grad-${Math.random().toString(36).slice(2, 8)}`, []);

  if (totalScored === 0) {
    return (
      <div className={`${className ?? ""} rounded-lg border bg-card p-8 text-center`}>
        <p className="text-sm text-muted-foreground">No scored accounts yet. Run scoring to see ICP coverage.</p>
      </div>
    );
  }

  return (
    <div className={`${className ?? ""} widget-card`}>
      {/* Header */}
      <div className="widget-header">
        <span className="text-sm font-medium text-foreground">ICP Coverage</span>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "accounts" | "leads")}>
          <TabsList className="h-7 bg-transparent p-0 gap-0">
            <TabsTrigger value="accounts" className="h-7 rounded-none border-b-2 border-transparent px-3 text-[11px] text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              Accounts
            </TabsTrigger>
            <TabsTrigger value="leads" className="h-7 rounded-none border-b-2 border-transparent px-3 text-[11px] text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              Leads
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="p-5">
        {/* 3 metric cells */}
        <div className="grid grid-cols-3 gap-px rounded-md border bg-border overflow-hidden mb-5">
          <button type="button" className="bg-card px-3 py-3 text-left hover:bg-muted/10 transition-colors" onClick={() => navigate(isAccounts ? "/accounts" : "/leads")}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
            <p className="text-lg font-semibold font-mono tabular-nums text-foreground mt-0.5">{total.toLocaleString()}</p>
          </button>
          <button type="button" className="bg-card px-3 py-3 text-left hover:bg-muted/10 transition-colors" onClick={() => navigate(isAccounts ? "/accounts?fit=high" : "/leads?fit=high")}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">ICP Fit</p>
            <p className="text-lg font-semibold font-mono tabular-nums text-foreground mt-0.5">{icpFit.toLocaleString()}</p>
          </button>
          <div className="bg-card px-3 py-3 text-left">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Coverage</p>
            <p className="text-lg font-semibold font-mono tabular-nums text-primary mt-0.5">{pct}%</p>
          </div>
        </div>

        {/* Animated stacked bar with rounded ends */}
        <div className="h-3 rounded-full overflow-hidden flex bg-border/50 mb-5">
          {data.map((item) => {
            const w = total > 0 ? (item.value / total) * 100 : 0;
            return w > 0 ? (
              <div
                key={item.name}
                className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-700 ease-out"
                style={{ width: `${w}%`, backgroundColor: item.color }}
              />
            ) : null;
          })}
        </div>

        {/* Segment rows */}
        <div className="space-y-1">
          {data.map((item) => {
            const p = total > 0 ? (item.value / total) * 100 : 0;
            const fitParam = item.name.split(" ")[0].toLowerCase();
            return (
              <button
                key={item.name}
                type="button"
                className="flex w-full items-center justify-between py-2 px-2 rounded-md text-left transition-colors hover:bg-muted/10 group"
                onClick={() => navigate(isAccounts ? `/accounts?fit=${fitParam}` : `/leads?fit=${fitParam}`)}
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-foreground group-hover:text-primary transition-colors">{item.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono tabular-nums text-foreground font-medium">{item.value.toLocaleString()}</span>
                  <span className="text-[11px] font-mono tabular-nums text-muted-foreground w-10 text-right">{p.toFixed(0)}%</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
