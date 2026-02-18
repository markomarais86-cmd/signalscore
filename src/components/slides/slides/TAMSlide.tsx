import type { BrandedReportData } from '@/utils/branded-pdf-export';

function fmtCurrency(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

interface TAMSlideProps {
  data: BrandedReportData;
  brandColor?: string;
}

export function TAMSlide({ data, brandColor }: TAMSlideProps) {
  const accent = brandColor || 'hsl(var(--primary))';

  const items = [
    { label: 'TAM', sublabel: 'Total Addressable Market', value: data.tam },
    { label: 'SAM', sublabel: 'Serviceable Addressable Market', value: data.sam },
    { label: 'SOM', sublabel: 'Serviceable Obtainable Market', value: data.som },
  ];

  const maxVal = Math.max(...items.map(i => i.value), 1);

  return (
    <div className="w-full h-full bg-card text-card-foreground p-20 flex flex-col">
      <h2 className="text-4xl font-bold mb-4" style={{ color: accent }}>Market Opportunity</h2>
      <p className="text-lg text-muted-foreground mb-12">Revenue opportunity funnel based on ICP scoring</p>

      <div className="flex-1 flex flex-col justify-center gap-10">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-8">
            <div className="w-32 text-right">
              <div className="text-3xl font-bold" style={{ color: accent }}>{item.label}</div>
              <div className="text-sm text-muted-foreground">{item.sublabel}</div>
            </div>
            <div className="flex-1 relative h-16 rounded-lg overflow-hidden bg-muted/30">
              <div
                className="absolute inset-y-0 left-0 rounded-lg flex items-center px-6"
                style={{
                  width: `${Math.max((item.value / maxVal) * 100, 10)}%`,
                  background: accent,
                  opacity: 1 - i * 0.2,
                }}
              >
                <span className="text-2xl font-bold text-primary-foreground">
                  {fmtCurrency(item.value)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
