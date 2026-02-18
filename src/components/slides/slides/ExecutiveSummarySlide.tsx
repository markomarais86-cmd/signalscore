interface ExecutiveSummarySlideProps {
  summary?: string;
  keyFindings?: Array<{ title: string; detail: string; impact: string }>;
  brandColor?: string;
}

export function ExecutiveSummarySlide({ summary, keyFindings, brandColor }: ExecutiveSummarySlideProps) {
  const accent = brandColor || 'hsl(var(--primary))';

  return (
    <div className="w-full h-full bg-card text-card-foreground p-20 flex flex-col">
      <h2 className="text-4xl font-bold mb-8" style={{ color: accent }}>Executive Summary</h2>

      {summary && (
        <p className="text-lg leading-relaxed mb-10 text-foreground max-w-[1600px]">
          {summary}
        </p>
      )}

      {keyFindings && keyFindings.length > 0 && (
        <div className="grid grid-cols-2 gap-6 mt-auto">
          {keyFindings.slice(0, 4).map((f, i) => (
            <div key={i} className="rounded-xl border border-border p-6 bg-background">
              <h3 className="text-xl font-semibold mb-2 text-foreground">{f.title}</h3>
              <p className="text-base text-muted-foreground mb-2">{f.detail}</p>
              <span className="text-sm font-medium" style={{ color: accent }}>{f.impact}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
