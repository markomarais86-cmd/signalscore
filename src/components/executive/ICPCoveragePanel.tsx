import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Target, Building2, Users } from "lucide-react";

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

  const icpFitAccounts = highFitAccounts + medFitAccounts;
  const icpFitLeadsCount = highFitLeads + medFitLeads;

  const accountsData = [
    { name: "High-Fit", value: highFitAccounts, color: FIT_COLORS.high },
    { name: "Medium-Fit", value: medFitAccounts, color: FIT_COLORS.medium },
    { name: "Low-Fit", value: lowFitAccounts, color: FIT_COLORS.low },
  ];

  const leadsData = [
    { name: "High-Fit", value: highFitLeads, color: FIT_COLORS.high },
    { name: "Medium-Fit", value: medFitLeads, color: FIT_COLORS.medium },
    { name: "Low-Fit", value: lowFitLeads, color: FIT_COLORS.low },
  ];

  const currentData = activeTab === "accounts" ? accountsData : leadsData;
  const currentTotal = activeTab === "accounts" ? totalScored : totalLeads;
  const currentIcpFit = activeTab === "accounts" ? icpFitAccounts : icpFitLeadsCount;
  const currentIcpFitPercentage = currentTotal > 0 ? Math.round((currentIcpFit / currentTotal) * 100) : 0;

  if (totalScored === 0) {
    return (
      <Card className={`${className ?? ""} border bg-card`}>
        <CardContent className="flex h-64 flex-col items-center justify-center p-8 text-center">
          <div className="mb-3 rounded-lg bg-muted/30 p-3">
            <Target className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No scored accounts yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Run scoring to populate ICP coverage.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className ?? ""} border bg-card`}>
      <CardContent className="p-5 lg:p-6">
        {/* Header row */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Target className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">ICP Coverage</h3>
          </div>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "accounts" | "leads")}>
            <TabsList className="h-7 bg-muted/50 p-0.5">
              <TabsTrigger value="accounts" className="gap-1 h-6 px-2.5 text-[11px] data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Building2 className="h-3 w-3" />
                Accounts
              </TabsTrigger>
              <TabsTrigger value="leads" className="gap-1 h-6 px-2.5 text-[11px] data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Users className="h-3 w-3" />
                Leads
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Summary row — uniform metric cards */}
        <div className="mb-5 grid grid-cols-3 gap-2">
          <button
            type="button"
            className="rounded-lg border px-3 py-3 text-left transition-colors hover:bg-muted/20"
            onClick={() => navigate(activeTab === "accounts" ? "/accounts" : "/leads")}
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Total</p>
            <p className="mt-1 text-xl font-semibold tracking-tight font-mono text-foreground">{currentTotal.toLocaleString()}</p>
          </button>

          <button
            type="button"
            className="rounded-lg border border-primary/20 px-3 py-3 text-left transition-colors hover:bg-primary/5"
            onClick={() => navigate(activeTab === "accounts" ? "/accounts?fit=high" : "/leads?fit=high")}
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">ICP-Fit</p>
            <p className="mt-1 text-xl font-semibold tracking-tight font-mono text-foreground">{currentIcpFit.toLocaleString()}</p>
          </button>

          <div className="rounded-lg border px-3 py-3 text-left">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Coverage</p>
            <p className="mt-1 text-xl font-semibold tracking-tight font-mono text-foreground">{currentIcpFitPercentage}%</p>
          </div>
        </div>

        {/* Chart + breakdown */}
        <div className="grid items-center gap-6 lg:grid-cols-[200px_1fr]">
          <div className="relative mx-auto h-48 w-48 lg:mx-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={currentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="hsl(var(--background))"
                  strokeWidth={3}
                >
                  {currentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold font-mono text-foreground">{currentIcpFitPercentage}%</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Coverage</span>
            </div>
          </div>

          <div className="space-y-2">
            {currentData.map((item) => {
              const percentage = currentTotal > 0 ? (item.value / currentTotal) * 100 : 0;
              const fitParam = item.name === "High-Fit" ? "high" : item.name === "Medium-Fit" ? "medium" : "low";

              return (
                <button
                  key={item.name}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/20"
                  onClick={() => navigate(activeTab === "accounts" ? `/accounts?fit=${fitParam}` : `/leads?fit=${fitParam}`)}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-medium text-foreground">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-foreground tabular-nums">{item.value.toLocaleString()}</span>
                    <span className="w-10 text-right text-[11px] text-muted-foreground tabular-nums">{percentage.toFixed(0)}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
