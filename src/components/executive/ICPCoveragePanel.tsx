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
        <span className="font-heading text-[15px] font-medium tracking-[-0.02em] text-foreground">
          ICP coverage
        </span>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "accounts" | "leads")}>
          <TabsList className="h-8 gap-0 bg-transparent p-0">
            <TabsTrigger value="accounts" className="h-8 rounded-none border-b-2 border-transparent px-3 text-[12px] font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none">
              Accounts
            </TabsTrigger>
            <TabsTrigger value="leads" className="h-8 rounded-none border-b-2 border-transparent px-3 text-[12px] font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none">
              Leads
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="p-5">
        <div className="mb-5 grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border">
          <button type="button" className="bg-card px-4 py-4 text-left transition-colors hover:bg-muted/10" onClick={() => navigate(isAccounts ? "/accounts" : "/leads")}>
            <p className="text-[11px] font-medium text-muted-foreground/75">Total</p>
            <p className="mt-1 font-heading text-[1.55rem] font-semibold tracking-[-0.04em] text-foreground tabular-nums">{total.toLocaleString()}</p>
          </button>
          <button type="button" className="bg-card px-4 py-4 text-left transition-colors hover:bg-muted/10" onClick={() => navigate(isAccounts ? "/accounts?fit=high" : "/leads?fit=high")}>
            <p className="text-[11px] font-medium text-muted-foreground/75">ICP fit</p>
            <p className="mt-1 font-heading text-[1.55rem] font-semibold tracking-[-0.04em] text-foreground tabular-nums">{icpFit.toLocaleString()}</p>
          </button>
          <div className="bg-card px-4 py-4 text-left">
            <p className="text-[11px] font-medium text-muted-foreground/75">Coverage</p>
            <p className="mt-1 font-heading text-[1.55rem] font-semibold tracking-[-0.04em] text-primary tabular-nums">{pct}%</p>
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
                className="group flex w-full items-center justify-between rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/10"
                onClick={() => navigate(isAccounts ? `/accounts?fit=${fitParam}` : `/leads?fit=${fitParam}`)}
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                  <span className="text-[13px] font-medium text-foreground transition-colors group-hover:text-primary">{item.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[13px] font-medium text-foreground tabular-nums">{item.value.toLocaleString()}</span>
                  <span className="w-10 text-right text-[12px] text-muted-foreground tabular-nums">{p.toFixed(0)}%</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
