import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Target, Building2, Users } from "lucide-react";

interface ICPCoveragePanelProps {
  highFitAccounts: number;
  medFitAccounts: number;
  lowFitAccounts: number;
  totalScored: number;
  // Leads data
  highFitLeads?: number;
  medFitLeads?: number;
  lowFitLeads?: number;
  totalLeads?: number;
  className?: string;
}

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
  const [activeTab, setActiveTab] = useState<"accounts" | "leads">("accounts");

  const icpFitAccounts = highFitAccounts + medFitAccounts;
  const icpFitLeadsCount = highFitLeads + medFitLeads;

  const accountsData = [
    { name: "High-Fit", value: highFitAccounts, color: "hsl(161 85% 60%)" },
    { name: "Medium-Fit", value: medFitAccounts, color: "hsl(43 96% 56%)" },
    { name: "Low-Fit", value: lowFitAccounts, color: "hsl(0 84% 60%)" },
  ];

  const leadsData = [
    { name: "High-Fit", value: highFitLeads, color: "hsl(161 85% 60%)" },
    { name: "Medium-Fit", value: medFitLeads, color: "hsl(43 96% 56%)" },
    { name: "Low-Fit", value: lowFitLeads, color: "hsl(0 84% 60%)" },
  ];

  const currentData = activeTab === "accounts" ? accountsData : leadsData;
  const currentTotal = activeTab === "accounts" ? totalScored : totalLeads;
  const currentIcpFit = activeTab === "accounts" ? icpFitAccounts : icpFitLeadsCount;
  const currentIcpFitPercentage = currentTotal > 0 
    ? Math.round((currentIcpFit / currentTotal) * 100) 
    : 0;

  if (totalScored === 0) {
    return (
      <Card className={`${className} floating-card border-border/50 bg-card/80 backdrop-blur-sm`}>
        <CardContent className="flex flex-col items-center justify-center h-80 p-6">
          <Target className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">No scored accounts yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className} floating-card border-border/30 bg-card/90 backdrop-blur-xl shadow-2xl shadow-primary/10`}>
      <CardContent className="p-8">
        {/* Header with Tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">ICP Coverage Overview</h3>
              <p className="text-xs text-muted-foreground">Breakdown by fit level</p>
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "accounts" | "leads")}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="accounts" className="text-xs gap-1.5">
                <Building2 className="h-3 w-3" />
                Accounts
              </TabsTrigger>
              <TabsTrigger value="leads" className="text-xs gap-1.5">
                <Users className="h-3 w-3" />
                Leads
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className="text-2xl font-bold text-foreground">{currentTotal.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total {activeTab === "accounts" ? "Scored" : "Leads"}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-2xl font-bold text-primary">{currentIcpFit.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">ICP-Fit</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className="text-2xl font-bold text-foreground">{currentIcpFitPercentage}%</p>
            <p className="text-xs text-muted-foreground">Coverage</p>
          </div>
        </div>

        {/* Main Content: Donut + Legend */}
        <div className="flex items-center gap-8">
          {/* Donut Chart */}
          <div className="relative w-48 h-48 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <filter id="donut-glow">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <Pie
                  data={currentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                  filter="url(#donut-glow)"
                >
                  {currentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-semibold text-primary uppercase tracking-widest">ICP</span>
              <span className="text-4xl font-bold text-foreground">{currentIcpFitPercentage}%</span>
              <span className="text-[10px] text-muted-foreground">ICP-Fit</span>
            </div>
          </div>

          {/* Legend with Counts */}
          <div className="flex-1 space-y-3">
            {currentData.map((item) => {
              const percentage = currentTotal > 0 ? (item.value / currentTotal) * 100 : 0;
              return (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full shadow-sm"
                      style={{ 
                        backgroundColor: item.color,
                        boxShadow: `0 0 8px ${item.color}40`
                      }}
                    />
                    <span className="text-sm font-medium text-foreground">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-foreground">{item.value.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground w-12 text-right">{percentage.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}