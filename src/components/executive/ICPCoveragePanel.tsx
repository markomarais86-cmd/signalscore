import { useState } from "react";
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
  highFitAccounts,
  medFitAccounts,
  lowFitAccounts,
  totalScored,
  highFitLeads = 0,
  medFitLeads = 0,
  lowFitLeads = 0,
  totalLeads = 0,
  className,
}: ICPCoveragePanelProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"accounts" | "leads">("accounts");

  const isAccounts = activeTab === "accounts";
  const data = isAccounts
    ? [
        { name: "High fit", value: highFitAccounts, color: FIT_COLORS.high },
        { name: "Medium fit", value: medFitAccounts, color: FIT_COLORS.medium },
        { name: "Low fit", value: lowFitAccounts, color: FIT_COLORS.low },
      ]
    : [
        { name: "High fit", value: highFitLeads, color: FIT_COLORS.high },
        { name: "Medium fit", value: medFitLeads, color: FIT_COLORS.medium },
        { name: "Low fit", value: lowFitLeads, color: FIT_COLORS.low },
      ];

  const total = isAccounts ? totalScored : totalLeads;
  const icpFit = data[0].value + data[1].value;
  const pct = total > 0 ? Math.round((icpFit / total) * 100) : 0;

  if (totalScored === 0) {
    return (
      <div className={`${className ?? ""} rounded-lg border bg-card p-8 text-center`}>
        <p className="text-sm text-muted-foreground">No scored accounts yet. Run scoring to see ICP coverage.</p>
      </div>
    );
  }

  return (
    <div className={`${className ?? ""} widget-card`}>
      <div className="widget-header">
        <div>
          <p className="widget-eyebrow">Coverage snapshot</p>
          <span className="widget-title">ICP coverage</span>
        </div>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "accounts" | "leads")}>
          <TabsList className="h-9 rounded-full border border-border bg-background/70 p-1">
            <TabsTrigger value="accounts" className="h-7 rounded-full px-3 text-[12px] font-medium text-muted-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-none">
              Accounts
            </TabsTrigger>
            <TabsTrigger value="leads" className="h-7 rounded-full px-3 text-[12px] font-medium text-muted-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-none">
              Leads
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="p-5">
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          <button type="button" className="metric-panel" onClick={() => navigate(isAccounts ? "/accounts" : "/leads")}>
            <p className="metric-panel__label">Total scored</p>
            <p className="metric-panel__value">{total.toLocaleString()}</p>
            <p className="metric-panel__hint">All evaluated records</p>
          </button>
          <button type="button" className="metric-panel" onClick={() => navigate(isAccounts ? "/accounts?fit=high" : "/leads?fit=high")}>
            <p className="metric-panel__label">ICP fit</p>
            <p className="metric-panel__value">{icpFit.toLocaleString()}</p>
            <p className="metric-panel__hint">High and medium fit combined</p>
          </button>
          <div className="metric-panel">
            <p className="metric-panel__label">Coverage rate</p>
            <p className="metric-panel__value text-primary">{pct}%</p>
            <p className="metric-panel__hint">Fit share of scored volume</p>
          </div>
        </div>

        <div className="mb-5 flex h-3 overflow-hidden rounded-full bg-border/50">
          {data.map((item) => {
            const w = total > 0 ? (item.value / total) * 100 : 0;
            return w > 0 ? (
              <div
                key={item.name}
                className="h-full transition-all duration-700 ease-out first:rounded-l-full last:rounded-r-full"
                style={{ width: `${w}%`, backgroundColor: item.color }}
              />
            ) : null;
          })}
        </div>

        <div className="space-y-1">
          {data.map((item) => {
            const p = total > 0 ? (item.value / total) * 100 : 0;
            const fitParam = item.name.split(" ")[0].toLowerCase();
            return (
              <button
                key={item.name}
                type="button"
                className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[0.95rem] px-3 py-3 text-left transition-colors hover:bg-muted/10"
                onClick={() => navigate(isAccounts ? `/accounts?fit=${fitParam}` : `/leads?fit=${fitParam}`)}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <div className="min-w-0">
                  <span className="text-[14px] font-medium text-foreground transition-colors group-hover:text-primary">{item.name}</span>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/50">
                    <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.max(p, 4)}%`, backgroundColor: item.color }} />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                  <span className="text-[14px] font-medium text-foreground tabular-nums">{item.value.toLocaleString()}</span>
                  <span className="w-10 text-right text-[13px] text-muted-foreground tabular-nums">{p.toFixed(0)}%</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
