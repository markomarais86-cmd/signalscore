import type { BrandedReportData } from '@/utils/branded-pdf-export';

interface ProspectsSlideProps {
  data: BrandedReportData;
  brandColor?: string;
}

function fmtVal(n?: number) {
  if (!n) return '—';
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export function ProspectsSlide({ data, brandColor }: ProspectsSlideProps) {
  const accent = brandColor || 'hsl(var(--primary))';
  const prospects = data.topProspects.slice(0, 10);

  return (
    <div className="w-full h-full bg-card text-card-foreground p-20 flex flex-col">
      <h2 className="text-4xl font-bold mb-4" style={{ color: accent }}>Top Prospects</h2>
      <p className="text-lg text-muted-foreground mb-8">Highest-scoring accounts by ICP fit</p>

      <div className="flex-1 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="text-left text-base font-semibold text-foreground py-3">#</th>
              <th className="text-left text-base font-semibold text-foreground py-3">Company</th>
              <th className="text-left text-base font-semibold text-foreground py-3">Industry</th>
              <th className="text-left text-base font-semibold text-foreground py-3">Country</th>
              <th className="text-right text-base font-semibold text-foreground py-3">Fit Score</th>
              <th className="text-right text-base font-semibold text-foreground py-3">Est. Value</th>
            </tr>
          </thead>
          <tbody>
            {prospects.map((p, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="text-lg text-muted-foreground py-3">{i + 1}</td>
                <td className="text-lg text-foreground py-3 font-medium">{p.name}</td>
                <td className="text-lg text-muted-foreground py-3">{p.industry}</td>
                <td className="text-lg text-muted-foreground py-3">{p.country}</td>
                <td className="text-lg text-foreground py-3 text-right font-semibold">{p.fitScore}</td>
                <td className="text-lg py-3 text-right font-semibold" style={{ color: accent }}>
                  {fmtVal(p.estimatedValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
