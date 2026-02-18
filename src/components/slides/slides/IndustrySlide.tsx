import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import type { BrandedReportData } from '@/utils/branded-pdf-export';

interface IndustrySlideProps {
  data: BrandedReportData;
  brandColor?: string;
}

export function IndustrySlide({ data, brandColor }: IndustrySlideProps) {
  const accent = brandColor || 'hsl(var(--primary))';
  const chartData = data.industryBreakdown.slice(0, 8).map(d => ({
    name: d.name.length > 20 ? d.name.slice(0, 18) + '…' : d.name,
    accounts: d.accounts,
  }));

  return (
    <div className="w-full h-full bg-card text-card-foreground p-20 flex flex-col">
      <h2 className="text-4xl font-bold mb-4" style={{ color: accent }}>Industry Breakdown</h2>
      <p className="text-lg text-muted-foreground mb-8">Top industries by account count</p>

      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 40, top: 10, bottom: 10 }}>
            <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 18 }} />
            <YAxis
              type="category"
              dataKey="name"
              width={220}
              tick={{ fill: 'hsl(var(--foreground))', fontSize: 18 }}
            />
            <Bar dataKey="accounts" radius={[0, 6, 6, 0]} maxBarSize={40}>
              {chartData.map((_, idx) => (
                <Cell key={idx} fill={accent} fillOpacity={1 - idx * 0.08} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
