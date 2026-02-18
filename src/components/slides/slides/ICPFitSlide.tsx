import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import type { BrandedReportData } from '@/utils/branded-pdf-export';

interface ICPFitSlideProps {
  data: BrandedReportData;
  brandColor?: string;
}

export function ICPFitSlide({ data, brandColor }: ICPFitSlideProps) {
  const accent = brandColor || 'hsl(var(--primary))';

  const chartData = [
    { name: 'High Fit', value: data.metrics.highFitAccounts, color: 'hsl(var(--fit-high))' },
    { name: 'Medium Fit', value: data.metrics.mediumFitAccounts, color: 'hsl(var(--fit-medium))' },
    { name: 'Low Fit', value: data.metrics.lowFitAccounts, color: 'hsl(var(--fit-low))' },
  ].filter(d => d.value > 0);

  return (
    <div className="w-full h-full bg-card text-card-foreground p-20 flex flex-col">
      <h2 className="text-4xl font-bold mb-4" style={{ color: accent }}>ICP Fit Distribution</h2>
      <p className="text-lg text-muted-foreground mb-8">
        {data.metrics.scoredAccounts.toLocaleString()} of {data.metrics.totalAccounts.toLocaleString()} accounts scored
      </p>

      <div className="flex-1 flex items-center gap-16">
        <div className="w-[500px] h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={120}
                outerRadius={220}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Legend
                verticalAlign="bottom"
                formatter={(value: string) => <span className="text-base text-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 space-y-6">
          {chartData.map((d, i) => (
            <div key={i} className="flex items-center gap-6">
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <div>
                <div className="text-2xl font-bold text-foreground">{d.value.toLocaleString()}</div>
                <div className="text-base text-muted-foreground">{d.name}</div>
              </div>
            </div>
          ))}

          {data.icpProfileNames.length > 0 && (
            <div className="mt-8 pt-6 border-t border-border">
              <div className="text-sm text-muted-foreground mb-2">Active ICP Profiles</div>
              {data.icpProfileNames.map((name, i) => (
                <div key={i} className="text-base text-foreground">{name}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
