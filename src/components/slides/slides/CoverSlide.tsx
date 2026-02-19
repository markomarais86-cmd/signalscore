import type { BrandedReportData } from '@/utils/branded-pdf-export';

interface CoverSlideProps {
  data: BrandedReportData;
  logoUrl?: string | null;
  brandColor?: string;
}

export function CoverSlide({ data, logoUrl, brandColor }: CoverSlideProps) {
  const accent = brandColor || 'hsl(var(--primary))';
  const icpFitAccounts = data.metrics.highFitAccounts + data.metrics.mediumFitAccounts;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-card text-card-foreground p-20">
      {/* Decorative top bar */}
      <div className="absolute top-0 left-0 right-0 h-2" style={{ background: accent }} />

      {logoUrl && (
        <img src={logoUrl} alt="Company logo" className="h-24 mb-10 object-contain" />
      )}

      <h1 className="text-5xl font-bold text-center mb-6 text-foreground">
        Market Intelligence Report
      </h1>

      <h2 className="text-3xl font-medium text-center mb-8" style={{ color: accent }}>
        {data.companyName}
      </h2>

      <p className="text-xl text-muted-foreground">{data.generatedAt}</p>

      <div className="mt-16 flex gap-12 text-center">
        <div>
          <div className="text-4xl font-bold" style={{ color: accent }}>
            {data.metrics.totalAccounts.toLocaleString()}
          </div>
          <div className="text-base text-muted-foreground mt-1">Total Accounts</div>
        </div>
        <div>
          <div className="text-4xl font-bold" style={{ color: accent }}>
            {icpFitAccounts.toLocaleString()}
          </div>
          <div className="text-base text-muted-foreground mt-1">ICP-Fit Accounts</div>
        </div>
        <div>
          <div className="text-4xl font-bold" style={{ color: accent }}>
            {data.metrics.highFitAccounts.toLocaleString()}
          </div>
          <div className="text-base text-muted-foreground mt-1">High Fit (A+B)</div>
        </div>
        <div>
          <div className="text-4xl font-bold" style={{ color: accent }}>
            {data.icpProfileCount}
          </div>
          <div className="text-base text-muted-foreground mt-1">ICP Profiles</div>
        </div>
      </div>
    </div>
  );
}
