import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { StageMetrics } from '@/hooks/use-pipeline-analytics';

interface PipelineFunnelChartProps {
  stages: StageMetrics[];
}

const STAGE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
];

const STAGE_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  qualification: 'Qualification',
  demo: 'Demo',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closing: 'Closing',
};

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function PipelineFunnelChart({ stages }: PipelineFunnelChartProps) {
  if (!stages || stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No stage data available
      </div>
    );
  }

  const data = stages.map((stage, index) => ({
    ...stage,
    label: STAGE_LABELS[stage.stage] || stage.stage,
    fill: STAGE_COLORS[index % STAGE_COLORS.length],
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;
    
    const data = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold">{data.label}</p>
        <div className="space-y-1 mt-2 text-muted-foreground">
          <p>Deals: <span className="text-foreground font-medium">{data.count}</span></p>
          <p>Value: <span className="text-foreground font-medium">{formatCurrency(data.value)}</span></p>
          <p>Conversion: <span className="text-foreground font-medium">{data.conversionRate.toFixed(0)}%</span></p>
          <p>Avg Duration: <span className="text-foreground font-medium">{data.avgDurationDays.toFixed(1)} days</span></p>
        </div>
      </div>
    );
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
          <XAxis type="number" hide />
          <YAxis 
            type="category" 
            dataKey="label" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            width={75}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="count" 
            radius={[0, 4, 4, 0]}
            maxBarSize={40}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
            <LabelList 
              dataKey="count" 
              position="right" 
              fill="hsl(var(--foreground))"
              fontSize={12}
              formatter={(value: number) => `${value} deals`}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      {/* Conversion rates below chart */}
      <div className="flex justify-between mt-4 px-2">
        {data.slice(0, -1).map((stage, index) => {
          const nextStage = data[index + 1];
          if (!nextStage) return null;
          return (
            <div key={stage.stage} className="text-center">
              <div className="text-xs text-muted-foreground">
                {stage.label.slice(0, 4)}→{nextStage.label.slice(0, 4)}
              </div>
              <div className="text-sm font-medium">
                {nextStage.conversionRate.toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
