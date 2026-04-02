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
      <Card className={`${className ?? ""} border bg-card shadow-sm`}>
        <CardContent className="flex h-80 flex-col items-center justify-center p-8 text-center">
          <div className="mb-4 rounded-full bg-primary/10 p-4">
            <Target className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">No scored accounts yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Run scoring to populate ICP coverage.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className ?? ""} border bg-card shadow-sm`}>
      <CardContent className="p-6 lg:p-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">ICP Coverage Overview</h3>
              <p className="mt-1 text-sm text-muted-foreground">Breakdown by fit level across your scored records.</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "accounts" | "leads")}>
            <TabsList className="h-9 bg-muted p-1">
              <TabsTrigger value="accounts" className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Building2 className="h-3 w-3" />
                Accounts
              </TabsTrigger>
              <TabsTrigger value="leads" className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Users className="h-3 w-3" />
                Leads
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            className="rounded-xl border bg-muted/20 px-4 py-4 text-left transition-colors hover:bg-muted/30"
            onClick={() => navigate(activeTab === "accounts" ? "/accounts" : "/leads")}
          >
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Total</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight font-mono text-foreground">{currentTotal.toLocaleString()}</p>
            <p className="mt-1 text-xs text-muted-foreground">{activeTab === "accounts" ? "Scored accounts" : "Available leads"}</p>
          </button>

          <button
            type="button"
            className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 text-left transition-colors hover:bg-primary/10"
            onClick={() => navigate(activeTab === "accounts" ? "/accounts?fit=high" : "/leads?fit=high")}
          >
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">ICP-Fit</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight font-mono text-primary">{currentIcpFit.toLocaleString()}</p>
            <p className="mt-1 text-xs text-muted-foreground">High + medium fit records</p>
          </button>

          <div className="rounded-xl border bg-muted/20 px-4 py-4 text-left">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Coverage</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight font-mono text-foreground">{currentIcpFitPercentage}%</p>
            <p className="mt-1 text-xs text-muted-foreground">Of the current scored set</p>
          </div>
        </div>

        <div className="grid items-center gap-8 lg:grid-cols-[240px_1fr]">
          <div className="relative mx-auto h-56 w-56 lg:mx-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={currentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={64}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="hsl(var(--background))"
                  strokeWidth={4}
                >
                  {currentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-primary">ICP</span>
              <span className="mt-1 text-4xl font-semibold font-mono text-foreground">{currentIcpFitPercentage}%</span>
              <span className="mt-1 text-[11px] text-muted-foreground">Coverage</span>
            </div>
          </div>

          <div className="space-y-3">
            {currentData.map((item) => {
              const percentage = currentTotal > 0 ? (item.value / currentTotal) * 100 : 0;
              const fitParam = item.name === "High-Fit" ? "high" : item.name === "Medium-Fit" ? "medium" : "low";

              return (
                <button
                  key={item.name}
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border bg-muted/10 px-4 py-3 text-left transition-colors hover:bg-muted/20"
                  onClick={() => navigate(activeTab === "accounts" ? `/accounts?fit=${fitParam}` : `/leads?fit=${fitParam}`)}
                >
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full border border-background" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium text-foreground">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold font-mono text-foreground">{item.value.toLocaleString()}</span>
                    <span className="w-12 text-right text-xs text-muted-foreground">{percentage.toFixed(0)}%</span>
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
