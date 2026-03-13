import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Crosshair, Cpu, Building2, UserSearch, BarChart3 } from "lucide-react";
import { useFuelLineMetrics } from "@/hooks/use-fuel-line-metrics";
import { FUEL_LINE_TYPES, FuelLineType } from "./constants/campaign-config";
import { cn } from "@/lib/utils";

const FUEL_LINE_COLORS: Record<string, string> = {
  abm: 'hsl(var(--chart-1))',
  technographic: 'hsl(var(--chart-2))',
  firmographic: 'hsl(var(--chart-3))',
  persona: 'hsl(var(--chart-4))',
};

const FUEL_LINE_ICONS: Record<string, typeof Crosshair> = {
  abm: Crosshair,
  technographic: Cpu,
  firmographic: Building2,
  persona: UserSearch,
};

export function FuelLineAnalytics({ className }: { className?: string }) {
  const { data: metrics, isLoading } = useFuelLineMetrics();

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-48 w-full" /></CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Fuel Line Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No campaign data yet. Create campaigns with fuel line types to see analytics.</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = metrics.map((m) => ({
    name: FUEL_LINE_TYPES[m.fuel_line_type as FuelLineType]?.label || m.fuel_line_type,
    campaigns: m.campaign_count,
    accounts: m.total_accounts,
    contacts: m.total_contacts,
    type: m.fuel_line_type,
  }));

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Fuel Line Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chart */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 13 }}
                labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
              />
              <Bar dataKey="campaigns" name="Campaigns" radius={[4, 4, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.type} fill={FUEL_LINE_COLORS[entry.type] || 'hsl(var(--muted))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metrics.map((m) => {
            const Icon = FUEL_LINE_ICONS[m.fuel_line_type] || Building2;
            const label = FUEL_LINE_TYPES[m.fuel_line_type as FuelLineType]?.label || m.fuel_line_type;
            return (
              <div key={m.fuel_line_type} className="p-3 rounded-lg border bg-card space-y-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <div className="text-2xl font-bold">{m.campaign_count}</div>
                <div className="text-xs text-muted-foreground">
                  {m.total_accounts} accounts · {m.total_contacts} contacts
                </div>
                {m.from_signals > 0 && (
                  <Badge variant="secondary" className="text-xs">{m.from_signals} from signals</Badge>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
