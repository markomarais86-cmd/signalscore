import type { BrandedReportData } from '@/utils/branded-pdf-export';

interface RisksSlideProps {
  data: BrandedReportData;
  brandColor?: string;
}

const severityColors: Record<string, string> = {
  high: 'hsl(var(--destructive))',
  medium: 'hsl(var(--fit-medium))',
  low: 'hsl(var(--primary))',
};

export function RisksSlide({ data, brandColor }: RisksSlideProps) {
  const accent = brandColor || 'hsl(var(--primary))';

  // Use AI risk assessment if available, fallback to detected risks
  const aiRisks = data.aiNarratives?.riskAssessment;
  const risks = aiRisks?.length
    ? aiRisks.slice(0, 6)
    : (data.risks || []).slice(0, 6).map(r => ({
        risk: r.title,
        severity: r.severity,
        mitigation: r.description,
      }));

  if (risks.length === 0) {
    return (
      <div className="w-full h-full bg-card text-card-foreground p-20 flex flex-col">
        <h2 className="text-4xl font-bold mb-4" style={{ color: accent }}>Risks & Mitigations</h2>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-2xl text-muted-foreground">No risks identified — your data quality looks good!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-card text-card-foreground p-20 flex flex-col">
      <h2 className="text-4xl font-bold mb-4" style={{ color: accent }}>Risks & Mitigations</h2>
      <p className="text-lg text-muted-foreground mb-8">Key risks identified in your market data</p>

      <div className="flex-1 grid grid-cols-2 gap-6">
        {risks.map((r, i) => (
          <div key={i} className="rounded-xl border border-border p-6 bg-background flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ background: severityColors[r.severity?.toLowerCase()] || accent }}
              />
              <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {r.severity}
              </span>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">{r.risk}</h3>
            <p className="text-base text-muted-foreground">{r.mitigation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
