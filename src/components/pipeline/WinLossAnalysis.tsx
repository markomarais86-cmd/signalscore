import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOpportunities, LOSS_CATEGORIES, type Deal } from "@/hooks/use-opportunities";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import { Trophy, XCircle, Percent, Clock } from "lucide-react";
import { differenceInDays } from "date-fns";

function fmt(v: number) {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(210, 70%, 50%)",
  "hsl(260, 60%, 55%)",
  "hsl(340, 65%, 50%)",
  "hsl(30, 80%, 55%)",
  "hsl(170, 55%, 45%)",
  "hsl(0, 60%, 50%)",
];

export function WinLossAnalysis() {
  const { data: deals = [], isLoading } = useOpportunities();

  const won = useMemo(() => deals.filter((d) => d.stage === "closed_won"), [deals]);
  const lost = useMemo(() => deals.filter((d) => d.stage === "closed_lost"), [deals]);
  const closedDeals = useMemo(() => [...won, ...lost], [won, lost]);

  const winRate = closedDeals.length > 0 ? (won.length / closedDeals.length) * 100 : 0;
  const avgWonValue = won.length > 0 ? won.reduce((s, d) => s + (Number(d.amount) || 0), 0) / won.length : 0;

  const avgCycleDays = useMemo(() => {
    const withDates = won.filter((d) => d.closed_date && d.created_at);
    if (withDates.length === 0) return 0;
    const total = withDates.reduce(
      (s, d) => s + differenceInDays(new Date(d.closed_date!), new Date(d.created_at)),
      0
    );
    return Math.round(total / withDates.length);
  }, [won]);

  // Loss reasons breakdown
  const lossReasons = useMemo(() => {
    const map = new Map<string, number>();
    lost.forEach((d) => {
      const cat = d.loss_category || "other";
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([key, count]) => ({
        name: LOSS_CATEGORIES.find((c) => c.key === key)?.label || key,
        value: count,
      }))
      .sort((a, b) => b.value - a.value);
  }, [lost]);

  // Win rate by owner
  const byOwner = useMemo(() => {
    const map = new Map<string, { won: number; lost: number; value: number }>();
    closedDeals.forEach((d) => {
      const owner = d.owner_name || "Unassigned";
      const entry = map.get(owner) || { won: 0, lost: 0, value: 0 };
      if (d.stage === "closed_won") {
        entry.won++;
        entry.value += Number(d.amount) || 0;
      } else {
        entry.lost++;
      }
      map.set(owner, entry);
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        winRate: data.won + data.lost > 0 ? Math.round((data.won / (data.won + data.lost)) * 100) : 0,
        won: data.won,
        lost: data.lost,
        value: data.value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [closedDeals]);

  if (isLoading) {
    return <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>;
  }

  if (closedDeals.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold">No closed deals yet</h3>
          <p className="text-sm text-muted-foreground">Close deals in the Pipeline to see win/loss analysis.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Percent className="h-4 w-4" /> Win Rate
            </div>
            <p className="text-xl font-bold">{winRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">{won.length}W / {lost.length}L</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Trophy className="h-4 w-4" /> Avg Won Deal
            </div>
            <p className="text-xl font-bold">{fmt(avgWonValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4" /> Avg Cycle
            </div>
            <p className="text-xl font-bold">{avgCycleDays}d</p>
            <p className="text-xs text-muted-foreground">creation to close</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <XCircle className="h-4 w-4" /> Top Loss Reason
            </div>
            <p className="text-xl font-bold truncate">{lossReasons[0]?.name || "—"}</p>
            <p className="text-xs text-muted-foreground">{lossReasons[0]?.value || 0} deals</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Loss reasons pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Loss Reasons</CardTitle>
            <CardDescription className="text-xs">Why deals are lost</CardDescription>
          </CardHeader>
          <CardContent>
            {lossReasons.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No lost deals recorded.</p>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie
                      data={lossReasons}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={35}
                    >
                      {lossReasons.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 flex-1">
                  {lossReasons.map((r, i) => (
                    <div key={r.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="truncate max-w-[120px]">{r.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] h-4">{r.value}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Win rate by rep */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Win Rate by Rep</CardTitle>
            <CardDescription className="text-xs">Performance by deal owner</CardDescription>
          </CardHeader>
          <CardContent>
            {byOwner.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No owner data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byOwner.slice(0, 6)} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) => `${v}%`}
                    labelFormatter={(label) => {
                      const o = byOwner.find((x) => x.name === label);
                      return `${label}: ${o?.won}W / ${o?.lost}L — ${fmt(o?.value || 0)}`;
                    }}
                  />
                  <Bar dataKey="winRate" name="Win Rate" radius={[0, 4, 4, 0]}>
                    {byOwner.slice(0, 6).map((entry, i) => (
                      <Cell key={i} fill={entry.winRate >= 50 ? "hsl(142, 60%, 45%)" : "hsl(0, 60%, 50%)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
