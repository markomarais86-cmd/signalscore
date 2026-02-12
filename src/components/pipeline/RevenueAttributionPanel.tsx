import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRevenueAttribution } from '@/hooks/use-opportunities';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Tag, TrendingUp } from 'lucide-react';

function formatCurrency(v: number) {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(210, 70%, 50%)',
  'hsl(260, 60%, 55%)',
  'hsl(340, 65%, 50%)',
  'hsl(170, 55%, 45%)',
];

export function RevenueAttributionPanel() {
  const { data, isLoading } = useRevenueAttribution();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent className="p-6"><Skeleton className="h-48" /></CardContent></Card>
        <Card><CardContent className="p-6"><Skeleton className="h-48" /></CardContent></Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Tag className="h-5 w-5" /> Revenue Attribution
        </h2>
        <div className="flex items-center gap-3 text-sm">
          <Badge variant="secondary" className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {data.totalWonCount} won · {formatCurrency(data.totalWonValue)}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* By UTM Campaign */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Revenue by Campaign</CardTitle>
            <CardDescription className="text-xs">Closed-won revenue attributed to UTM campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            {data.byUtmCampaign.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No campaign data yet. Deals need attribution_utm to appear here.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.byUtmCampaign.slice(0, 6)} layout="vertical">
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {data.byUtmCampaign.slice(0, 6).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* By Source */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Revenue by Source</CardTitle>
            <CardDescription className="text-xs">Closed-won revenue by deal source</CardDescription>
          </CardHeader>
          <CardContent>
            {data.bySource.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No source data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.bySource.slice(0, 6)} layout="vertical">
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {data.bySource.slice(0, 6).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Funnel variant breakdown (if any) */}
      {data.byVariant.length > 0 && data.byVariant[0].name !== 'No Variant' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Revenue by Funnel Variant</CardTitle>
            <CardDescription className="text-xs">A/B test variant performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {data.byVariant.filter(v => v.name !== 'No Variant').map(v => (
                <div key={v.name} className="flex items-center justify-between text-sm border rounded-md p-2">
                  <Badge variant="outline">{v.name}</Badge>
                  <div className="text-right">
                    <span className="font-medium">{formatCurrency(v.value)}</span>
                    <span className="text-xs text-muted-foreground ml-2">({v.count} deals)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
