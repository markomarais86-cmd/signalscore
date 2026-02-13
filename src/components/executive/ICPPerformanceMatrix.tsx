import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ResponsiveContainer,
  ZAxis,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffectiveOrg } from '@/hooks/use-effective-org';
import { supabase } from '@/integrations/supabase/client';
import { Target } from 'lucide-react';

interface ICPPerformanceMatrixProps {
  icpId?: string;
}

interface AccountPoint {
  name: string;
  fit: number;
  intent: number;
  industry: string | null;
  revenueRange: string | null;
  hasDeal: boolean;
  dealStatus: string | null;
  dealAmount: number | null;
  quadrant: string;
  color: string;
}

const QUADRANT_CONFIG = {
  Prioritise: { color: 'hsl(142, 71%, 45%)' },
  Develop: { color: 'hsl(217, 91%, 60%)' },
  Nurture: { color: 'hsl(38, 92%, 50%)' },
  Deprioritise: { color: 'hsl(215, 14%, 60%)' },
} as const;

function classifyQuadrant(fit: number, intent: number): keyof typeof QUADRANT_CONFIG {
  if (fit >= 50 && intent >= 50) return 'Prioritise';
  if (fit >= 50 && intent < 50) return 'Develop';
  if (fit < 50 && intent >= 50) return 'Nurture';
  return 'Deprioritise';
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as AccountPoint;
  return (
    <div className="rounded-lg border bg-popover p-3 text-popover-foreground shadow-md text-sm space-y-1">
      <p className="font-semibold">{d.name}</p>
      <p>Fit: <span className="font-medium">{d.fit}</span> · Intent: <span className="font-medium">{d.intent}</span></p>
      {d.industry && <p className="text-muted-foreground">{d.industry}</p>}
      {d.hasDeal && (
        <p className="text-muted-foreground">
          Deal: {d.dealStatus}{d.dealAmount ? ` · $${d.dealAmount.toLocaleString()}` : ''}
        </p>
      )}
      <p style={{ color: d.color }} className="font-medium">{d.quadrant}</p>
    </div>
  );
}

export function ICPPerformanceMatrix({ icpId }: ICPPerformanceMatrixProps) {
  const { effectiveOrgId } = useEffectiveOrg();

  const { data: points, isLoading } = useQuery({
    queryKey: ['icp-performance-matrix', effectiveOrgId, icpId],
    enabled: !!effectiveOrgId,
    queryFn: async () => {
      // Fetch scores with account info
      let scoresQuery = supabase
        .from('scores')
        .select('fit, intent, overall, account_external_id, accounts!inner(name, industry_norm, revenue_range)')
        .eq('org_id', effectiveOrgId!)
        .not('fit', 'is', null)
        .not('intent', 'is', null);

      if (icpId) {
        scoresQuery = scoresQuery.eq('icp_id', icpId);
      }

      const [scoresRes, dealsRes] = await Promise.all([
        scoresQuery,
        supabase
          .from('deals')
          .select('account_external_id, status, amount')
          .eq('org_id', effectiveOrgId!),
      ]);

      if (scoresRes.error) throw scoresRes.error;

      // Build deal lookup by account_external_id
      const dealMap = new Map<string, { status: string; amount: number | null }>();
      if (!dealsRes.error && dealsRes.data) {
        for (const deal of dealsRes.data) {
          if (deal.account_external_id) {
            dealMap.set(deal.account_external_id, {
              status: deal.status,
              amount: deal.amount,
            });
          }
        }
      }

      return (scoresRes.data ?? []).map((row: any) => {
        const fit = row.fit as number;
        const intent = row.intent as number;
        const quadrant = classifyQuadrant(fit, intent);
        const deal = row.account_external_id ? dealMap.get(row.account_external_id) : undefined;
        return {
          name: row.accounts?.name ?? 'Unknown',
          fit,
          intent,
          industry: row.accounts?.industry_norm ?? null,
          revenueRange: row.accounts?.revenue_range ?? null,
          hasDeal: !!deal,
          dealStatus: deal?.status ?? null,
          dealAmount: deal?.amount ?? null,
          quadrant,
          color: QUADRANT_CONFIG[quadrant].color,
        } satisfies AccountPoint;
      });
    },
  });

  const quadrantCounts = useMemo(() => {
    if (!points) return { Prioritise: 0, Develop: 0, Nurture: 0, Deprioritise: 0 };
    return points.reduce(
      (acc, p) => {
        acc[p.quadrant as keyof typeof acc]++;
        return acc;
      },
      { Prioritise: 0, Develop: 0, Nurture: 0, Deprioritise: 0 }
    );
  }, [points]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!points || points.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            ICP Performance Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Target className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">No scored accounts yet</p>
            <p className="text-xs mt-1">Score accounts to see them plotted by Fit vs Intent</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5 text-primary" />
          ICP Performance Matrix
        </CardTitle>
        <CardDescription>
          {points.length} accounts plotted by ICP Fit vs Intent score
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={380}>
          <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              type="number"
              dataKey="fit"
              domain={[0, 100]}
              name="Fit"
              label={{ value: 'ICP Fit →', position: 'insideBottom', offset: -10, className: 'fill-muted-foreground text-xs' }}
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
            />
            <YAxis
              type="number"
              dataKey="intent"
              domain={[0, 100]}
              name="Intent"
              label={{ value: '← Intent', angle: -90, position: 'insideLeft', offset: 5, className: 'fill-muted-foreground text-xs' }}
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
            />
            <ZAxis
              type="number"
              dataKey={(d: AccountPoint) => (d.hasDeal ? 120 : 60)}
              range={[40, 160]}
            />
            <ReferenceLine x={50} strokeDasharray="4 4" className="stroke-border" />
            <ReferenceLine y={50} strokeDasharray="4 4" className="stroke-border" />

            {/* Quadrant labels */}
            <ReferenceLine
              x={75}
              y={75}
              ifOverflow="extendDomain"
              label={{ value: 'Prioritise', position: 'center', className: 'fill-muted-foreground/40 text-xs font-medium' }}
              stroke="none"
            />
            <ReferenceLine
              x={75}
              y={25}
              ifOverflow="extendDomain"
              label={{ value: 'Develop', position: 'center', className: 'fill-muted-foreground/40 text-xs font-medium' }}
              stroke="none"
            />
            <ReferenceLine
              x={25}
              y={75}
              ifOverflow="extendDomain"
              label={{ value: 'Nurture', position: 'center', className: 'fill-muted-foreground/40 text-xs font-medium' }}
              stroke="none"
            />
            <ReferenceLine
              x={25}
              y={25}
              ifOverflow="extendDomain"
              label={{ value: 'Deprioritise', position: 'center', className: 'fill-muted-foreground/40 text-xs font-medium' }}
              stroke="none"
            />

            <RechartsTooltip content={<CustomTooltip />} />
            <Scatter data={points} isAnimationActive={false}>
              {points.map((point, i) => (
                <Cell
                  key={i}
                  fill={point.color}
                  fillOpacity={0.7}
                  stroke={point.color}
                  strokeWidth={1}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>

        {/* Quadrant summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {(Object.entries(QUADRANT_CONFIG) as [keyof typeof QUADRANT_CONFIG, typeof QUADRANT_CONFIG[keyof typeof QUADRANT_CONFIG]][]).map(
            ([label, cfg]) => (
              <div key={label} className="flex items-center gap-2 rounded-md border px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                <span className="text-muted-foreground">{label}</span>
                <span className="ml-auto font-semibold">{quadrantCounts[label]}</span>
              </div>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
