import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOpportunities, DEAL_STAGES, type Deal } from "@/hooks/use-opportunities";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";
import { TrendingUp, DollarSign, Calendar, Target } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, isWithinInterval } from "date-fns";

function fmt(v: number) {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function DealForecastPanel() {
  const { data: deals = [], isLoading } = useOpportunities();

  const openDeals = useMemo(
    () => deals.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost"),
    [deals]
  );

  // Weighted pipeline
  const weighted = useMemo(() => {
    return openDeals.reduce((sum, d) => {
      const prob = DEAL_STAGES.find((s) => s.key === d.stage)?.probability ?? 0;
      return sum + (Number(d.amount) || 0) * (prob / 100);
    }, 0);
  }, [openDeals]);

  const totalPipeline = useMemo(
    () => openDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0),
    [openDeals]
  );

  // Best case (all open deals close)
  const bestCase = totalPipeline;
  // Commit (negotiation+)
  const commit = useMemo(
    () =>
      openDeals
        .filter((d) => d.stage === "negotiation")
        .reduce((s, d) => s + (Number(d.amount) || 0), 0),
    [openDeals]
  );

  // Monthly forecast
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: { month: string; weighted: number; bestCase: number; count: number }[] = [];

    for (let i = 0; i < 6; i++) {
      const m = addMonths(now, i);
      const ms = startOfMonth(m);
      const me = endOfMonth(m);
      const monthDeals = openDeals.filter((d) => {
        if (!d.expected_close_date) return i === 0; // no date → current month
        const cd = new Date(d.expected_close_date);
        return isWithinInterval(cd, { start: ms, end: me });
      });

      const w = monthDeals.reduce((s, d) => {
        const prob = DEAL_STAGES.find((st) => st.key === d.stage)?.probability ?? 0;
        return s + (Number(d.amount) || 0) * (prob / 100);
      }, 0);
      const bc = monthDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);

      months.push({
        month: format(ms, "MMM"),
        weighted: Math.round(w),
        bestCase: Math.round(bc),
        count: monthDeals.length,
      });
    }
    return months;
  }, [openDeals]);

  // Stage funnel
  const stageData = useMemo(() => {
    return DEAL_STAGES.filter((s) => s.key !== "closed_won" && s.key !== "closed_lost").map((s) => {
      const stageDeals = openDeals.filter((d) => d.stage === s.key);
      return {
        name: s.label,
        value: stageDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0),
        count: stageDeals.length,
        probability: s.probability,
      };
    });
  }, [openDeals]);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-48" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (openDeals.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold">No open deals to forecast</h3>
          <p className="text-sm text-muted-foreground">Create deals in the Pipeline tab to see forecasting.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" /> Total Pipeline
            </div>
            <p className="text-xl font-bold">{fmt(totalPipeline)}</p>
            <p className="text-xs text-muted-foreground">{openDeals.length} deals</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Target className="h-4 w-4" /> Weighted Forecast
            </div>
            <p className="text-xl font-bold">{fmt(weighted)}</p>
            <p className="text-xs text-muted-foreground">probability-adjusted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" /> Commit
            </div>
            <p className="text-xl font-bold">{fmt(commit)}</p>
            <p className="text-xs text-muted-foreground">negotiation stage</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" /> Best Case
            </div>
            <p className="text-xl font-bold">{fmt(bestCase)}</p>
            <p className="text-xs text-muted-foreground">if all close</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Monthly forecast chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">6-Month Revenue Forecast</CardTitle>
            <CardDescription className="text-xs">Based on expected close dates & stage probability</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="weighted" name="Weighted" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="bestCase" name="Best Case" fill="hsl(var(--primary) / 0.3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Stage funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pipeline by Stage</CardTitle>
            <CardDescription className="text-xs">Value and deal count per stage</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stageData} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number, name: string) => fmt(v)}
                  labelFormatter={(label) => {
                    const s = stageData.find((d) => d.name === label);
                    return `${label} (${s?.count} deals, ${s?.probability}% prob)`;
                  }}
                />
                <Bar dataKey="value" name="Value" radius={[0, 4, 4, 0]}>
                  {stageData.map((_, i) => (
                    <Cell key={i} fill={`hsl(var(--primary) / ${0.4 + i * 0.15})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
