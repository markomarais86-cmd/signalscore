import type { BrandedReportData } from '@/utils/branded-pdf-export';

interface CTASlideProps {
  data: BrandedReportData;
  brandColor?: string;
}

export function CTASlide({ data, brandColor }: CTASlideProps) {
  const accent = brandColor || 'hsl(var(--primary))';
  const recs = data.aiNarratives?.strategicRecommendations?.slice(0, 4);

  return (
    <div className="w-full h-full bg-card text-card-foreground p-20 flex flex-col">
      <h2 className="text-4xl font-bold mb-4" style={{ color: accent }}>Next Steps</h2>
      <p className="text-lg text-muted-foreground mb-10">Strategic recommendations to capture market opportunity</p>

      {recs && recs.length > 0 ? (
        <div className="flex-1 grid grid-cols-2 gap-8">
          {recs.map((r, i) => (
            <div key={i} className="rounded-xl border border-border p-8 bg-background flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold"
                  style={{ background: accent, color: 'hsl(var(--primary-foreground))' }}
                >
                  {i + 1}
                </div>
                <span className="text-sm font-medium uppercase tracking-wide" style={{ color: accent }}>
                  {r.priority} priority
                </span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{r.action}</h3>
              <p className="text-base text-muted-foreground">{r.rationale}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-3xl font-bold mb-4" style={{ color: accent }}>
            Ready to accelerate your pipeline?
          </div>
          <p className="text-xl text-muted-foreground max-w-[800px]">
            With {data.metrics.highFitAccounts.toLocaleString()} high-fit accounts identified,
            prioritize outreach to maximize conversion rates and revenue impact.
          </p>
        </div>
      )}

      {/* Footer bar */}
      <div className="mt-auto pt-8 border-t border-border flex justify-between items-center">
        <span className="text-base text-muted-foreground">{data.companyName}</span>
        <span className="text-base text-muted-foreground">{data.generatedAt}</span>
      </div>
    </div>
  );
}
