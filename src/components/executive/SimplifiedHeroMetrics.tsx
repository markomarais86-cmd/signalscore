import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, Target } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router-dom";

interface SimplifiedHeroMetricsProps {
  totalAccounts: number;
  totalLeads: number;
  campaignReady: number;
  sourceFilter: 'crm' | 'database';
  tamProvider?: string;
}

const miniChartData = [
  { value: 30 },
  { value: 45 },
  { value: 35 },
  { value: 55 },
  { value: 48 },
  { value: 62 },
  { value: 58 },
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
      value: totalAccounts,
      subtitle: sourceFilter === 'database' ? `Via ${tamProvider || 'Database'}` : "In your CRM",
      icon: Building2,
      onClick: () => navigate('/accounts'),
    },
    {
      label: "Total Leads",
      value: totalLeads,
      subtitle: sourceFilter === 'database' ? "Available contacts" : "In your pipeline",
      icon: Users,
      onClick: () => navigate('/leads'),
    },
    {
      label: "Campaign Ready",
      value: campaignReady,
      subtitle: "Ready for outreach",
      icon: Target,
      onClick: () => navigate('/leads?campaign_ready=true'),
      highlight: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {metrics.map((metric) => (
        <Card
          key={metric.label}
          className="cursor-pointer hover:bg-muted/30 transition-all duration-200 border-border/50"
          onClick={metric.onClick}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">{metric.label}</p>
                <p className="text-3xl font-bold tracking-tight">
                  {metric.value.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{metric.subtitle}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <metric.icon className="h-5 w-5 text-muted-foreground" />
                {metric.highlight && metric.value > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
                    Ready
                  </span>
                )}
              </div>
            </div>
            {/* Mini bar chart */}
            <div className="h-10 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={miniChartData} barCategoryGap="20%">
                  <Bar
                    dataKey="value"
                    fill="hsl(var(--primary))"
                    radius={[2, 2, 0, 0]}
                    opacity={0.8}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
