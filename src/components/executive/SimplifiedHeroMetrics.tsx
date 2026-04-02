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
    },
    {
      label: "Total Leads",
      value: totalLeads.toLocaleString(),
      subtitle: sourceFilter === "database" ? "Available contacts" : "In your pipeline",
      icon: Users,
      onClick: () => navigate("/leads"),
    },
    {
      label: "Campaign Ready",
      value: campaignReady.toLocaleString(),
      subtitle: "Ready for outreach",
      icon: Rocket,
      onClick: () => navigate("/leads?campaign_ready=true"),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {metrics.map((metric, idx) => (
        <Card
          key={metric.label}
          className="cursor-pointer group relative overflow-hidden border bg-card shadow-sm hover:shadow-md transition-shadow duration-200"
          onClick={metric.onClick}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-primary/10">
                    <metric.icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                </div>
                <p className="text-4xl font-bold tracking-tight font-mono text-foreground">{metric.value}</p>
                <p className="text-xs text-muted-foreground">{metric.subtitle}</p>
              </div>
              <div className="w-24 h-16">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={miniChartData} barCategoryGap="15%">
                    <defs>
                      <linearGradient id={`barGradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                      </linearGradient>
                    </defs>
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {miniChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`url(#barGradient-${idx})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}