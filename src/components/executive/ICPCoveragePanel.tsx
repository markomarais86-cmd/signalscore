import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

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
        { name: "High", value: highFitAccounts, color: FIT_COLORS.high },
        { name: "Medium", value: medFitAccounts, color: FIT_COLORS.medium },
        { name: "Low", value: lowFitAccounts, color: FIT_COLORS.low },
      ]
    : [
        { name: "High", value: highFitLeads, color: FIT_COLORS.high },
        { name: "Medium", value: medFitLeads, color: FIT_COLORS.medium },
        { name: "Low", value: lowFitLeads, color: FIT_COLORS.low },
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
    <div className={`${className ?? ""} rounded-lg border bg-card`}>
      <div className="flex items-center justify-between border-b px-5 py-3">
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
          <button type="button" className="bg-card px-3 py-3 text-left hover:bg-muted/10" onClick={() => navigate(isAccounts ? "/accounts" : "/leads")}>
            <p className="text-[11px] text-muted-foreground">Total</p>
            <p className="text-lg font-semibold font-mono tabular-nums text-foreground mt-0.5">{total.toLocaleString()}</p>
          </button>
          <button type="button" className="bg-card px-3 py-3 text-left hover:bg-muted/10" onClick={() => navigate(isAccounts ? "/accounts?fit=high" : "/leads?fit=high")}>
            <p className="text-[11px] text-muted-foreground">ICP Fit</p>
            <p className="text-lg font-semibold font-mono tabular-nums text-foreground mt-0.5">{icpFit.toLocaleString()}</p>
          </button>
          <div className="bg-card px-3 py-3 text-left">
            <p className="text-[11px] text-muted-foreground">Coverage</p>
            <p className="text-lg font-semibold font-mono tabular-nums text-foreground mt-0.5">{pct}%</p>
          </div>
        </div>

        {/* Chart + list */}
        <div className="grid items-center gap-5 lg:grid-cols-[180px_1fr]">
          <div className="relative mx-auto h-44 w-44 lg:mx-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={54} outerRadius={76} paddingAngle={2} dataKey="value" stroke="hsl(var(--card))" strokeWidth={2}>
                  {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold font-mono tabular-nums text-foreground">{pct}%</span>
            </div>
          </div>

          <div className="space-y-0 divide-y divide-border">
            {data.map((item) => {
              const p = total > 0 ? (item.value / total) * 100 : 0;
              const fitParam = item.name === "High" ? "high" : item.name === "Medium" ? "medium" : "low";
              return (
                <button
                  key={item.name}
                  type="button"
                  className="flex w-full items-center justify-between py-2.5 px-1 text-left transition-colors hover:bg-muted/10"
                  onClick={() => navigate(isAccounts ? `/accounts?fit=${fitParam}` : `/leads?fit=${fitParam}`)}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-foreground">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono tabular-nums text-foreground">{item.value.toLocaleString()}</span>
                    <span className="text-[11px] font-mono tabular-nums text-muted-foreground w-8 text-right">{p.toFixed(0)}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
