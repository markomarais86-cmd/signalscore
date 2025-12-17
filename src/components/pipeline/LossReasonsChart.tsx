import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { LossReasonBreakdown } from '@/hooks/use-pipeline-analytics';

interface LossReasonsChartProps {
  reasons: LossReasonBreakdown[];
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--muted-foreground))',
];

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function LossReasonsChart({ reasons }: LossReasonsChartProps) {
  if (!reasons || reasons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-sm">No lost deals in this period</p>
        <p className="text-xs">Great job keeping deals on track!</p>
      </div>
    );
  }

  const data = reasons.map((reason, index) => ({
    ...reason,
    fill: COLORS[index % COLORS.length],
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;
    
    const data = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold">{data.reason}</p>
        <div className="space-y-1 mt-2 text-muted-foreground">
          <p>Deals Lost: <span className="text-foreground font-medium">{data.count}</span></p>
          <p>Value Lost: <span className="text-foreground font-medium">{formatCurrency(data.value)}</span></p>
          <p>Percentage: <span className="text-foreground font-medium">{data.percentage.toFixed(0)}%</span></p>
        </div>
      </div>
    );
  };

  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-4">
        {payload?.map((entry: any, index: number) => (
          <div key={`legend-${index}`} className="flex items-center gap-1 text-xs">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="reason"
            cx="50%"
            cy="45%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={2}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Summary stats below */}
      <div className="flex justify-center gap-6 mt-2 text-xs text-muted-foreground">
        <div>
          Total Lost: <span className="font-medium text-foreground">
            {reasons.reduce((sum, r) => sum + r.count, 0)}
          </span>
        </div>
        <div>
          Value Lost: <span className="font-medium text-foreground">
            {formatCurrency(reasons.reduce((sum, r) => sum + r.value, 0))}
          </span>
        </div>
      </div>
    </div>
  );
}
