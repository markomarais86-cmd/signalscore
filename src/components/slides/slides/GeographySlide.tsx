import type { BrandedReportData } from '@/utils/branded-pdf-export';

interface GeographySlideProps {
  data: BrandedReportData;
  brandColor?: string;
}

export function GeographySlide({ data, brandColor }: GeographySlideProps) {
  const accent = brandColor || 'hsl(var(--primary))';
  const geos = data.geographyDistribution.slice(0, 10);

  return (
    <div className="w-full h-full bg-card text-card-foreground p-20 flex flex-col">
      <h2 className="text-4xl font-bold mb-4" style={{ color: accent }}>Geography Distribution</h2>
      <p className="text-lg text-muted-foreground mb-8">Top markets by account concentration</p>

      <div className="flex-1 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="text-left text-lg font-semibold text-foreground py-4 pr-8">Country</th>
              <th className="text-right text-lg font-semibold text-foreground py-4 px-8">Accounts</th>
              <th className="text-right text-lg font-semibold text-foreground py-4 px-8">Share</th>
              <th className="text-left text-lg font-semibold text-foreground py-4 pl-8 w-[400px]"></th>
            </tr>
          </thead>
          <tbody>
            {geos.map((g, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="text-xl text-foreground py-4 pr-8 font-medium">{g.country}</td>
                <td className="text-xl text-foreground py-4 px-8 text-right">{g.accounts.toLocaleString()}</td>
                <td className="text-xl text-muted-foreground py-4 px-8 text-right">{g.percentage.toFixed(1)}%</td>
                <td className="py-4 pl-8">
                  <div className="h-5 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${g.percentage}%`, background: accent, minWidth: 8 }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
