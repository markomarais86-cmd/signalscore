import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, ResponsiveContainer, Cell } from "recharts";
import { Building2, Users, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SimplifiedHeroMetricsProps {
  totalAccounts: number;
  totalLeads: number;
  campaignReady: number;
  sourceFilter: "crm" | "database";
  tamProvider?: string;
}

const miniChartData = [
  { value: 35 },
  { value: 48 },
  { value: 42 },
  { value: 58 },
  { value: 52 },
  { value: 68 },
  { value: 62 },
  { value: 75 },
];

export function SimplifiedHeroMetrics({
  totalAccounts,
  totalLeads,
  campaignReady,
  sourceFilter,
  tamProvider,
}: SimplifiedHeroMetricsProps) {
  const navigate = useNavigate();

  const metrics = [
    {
      label: "Total Accounts",
      value: totalAccounts.toLocaleString(),
      subtitle: sourceFilter === "database" ? `Via ${tamProvider || "Database"}` : "In your CRM",
      icon: Building2,
      onClick: () => navigate("/accounts"),
      floatClass: "floating-card-left",
    },
    {
      label: "Total Leads",
      value: totalLeads.toLocaleString(),
      subtitle: sourceFilter === "database" ? "Available contacts" : "In your pipeline",
      icon: Users,
      onClick: () => navigate("/leads"),
      floatClass: "floating-card",
    },
    {
      label: "Campaign Ready",
      value: campaignReady.toLocaleString(),
      subtitle: "Ready for outreach",
      icon: Rocket,
      onClick: () => navigate("/leads?campaign_ready=true"),
      floatClass: "floating-card-right",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {metrics.map((metric, idx) => (
        <Card
          key={metric.label}
          className={`${metric.floatClass} cursor-pointer group relative overflow-hidden border-border/30 bg-card/90 backdrop-blur-xl shadow-lg shadow-primary/5 hover:shadow-2xl hover:shadow-primary/15`}
          onClick={metric.onClick}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-primary/10">
                    <metric.icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                </div>
                <p className="text-4xl font-bold tracking-tight text-foreground">{metric.value}</p>
                <p className="text-xs text-muted-foreground">{metric.subtitle}</p>
              </div>
              <div className="w-24 h-16">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={miniChartData} barCategoryGap="15%">
                    <defs>
                      <linearGradient id={`barGradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(161 85% 60%)" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="hsl(161 85% 60%)" stopOpacity={0.2} />
                      </linearGradient>
                    </defs>
                    <Bar
                      dataKey="value"
                      radius={[3, 3, 0, 0]}
                    >
                      {miniChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`url(#barGradient-${idx})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
          {/* Glow effect on hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
        </Card>
      ))}
    </div>
  );
}