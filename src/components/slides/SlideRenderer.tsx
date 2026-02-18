import type { BrandedReportData } from '@/utils/branded-pdf-export';
import { SlideLayout } from './SlideLayout';
import { CoverSlide } from './slides/CoverSlide';
import { ExecutiveSummarySlide } from './slides/ExecutiveSummarySlide';
import { ICPFitSlide } from './slides/ICPFitSlide';
import { TAMSlide } from './slides/TAMSlide';
import { IndustrySlide } from './slides/IndustrySlide';
import { GeographySlide } from './slides/GeographySlide';
import { ProspectsSlide } from './slides/ProspectsSlide';
import { RisksSlide } from './slides/RisksSlide';
import { CTASlide } from './slides/CTASlide';

export type SlideType = 'cover' | 'executive' | 'icp' | 'tam' | 'industry' | 'geography' | 'prospects' | 'risks' | 'cta';

export interface SlideDefinition {
  id: string;
  type: SlideType;
  title: string;
}

export const SLIDE_ORDER: SlideDefinition[] = [
  { id: 'cover', type: 'cover', title: 'Cover' },
  { id: 'executive', type: 'executive', title: 'Executive Summary' },
  { id: 'icp', type: 'icp', title: 'ICP Fit Distribution' },
  { id: 'tam', type: 'tam', title: 'Market Opportunity' },
  { id: 'industry', type: 'industry', title: 'Industry Breakdown' },
  { id: 'geography', type: 'geography', title: 'Geography' },
  { id: 'prospects', type: 'prospects', title: 'Top Prospects' },
  { id: 'risks', type: 'risks', title: 'Risks & Mitigations' },
  { id: 'cta', type: 'cta', title: 'Next Steps' },
];

interface SlideRendererProps {
  slide: SlideDefinition;
  data: BrandedReportData;
  logoUrl?: string | null;
  brandColor?: string;
  fixedScale?: number;
  className?: string;
}

export function SlideRenderer({ slide, data, logoUrl, brandColor, fixedScale, className }: SlideRendererProps) {
  const slideContent = (() => {
    switch (slide.type) {
      case 'cover':
        return <CoverSlide data={data} logoUrl={logoUrl} brandColor={brandColor} />;
      case 'executive':
        return (
          <ExecutiveSummarySlide
            summary={data.aiNarratives?.executiveSummary}
            keyFindings={data.aiNarratives?.keyFindings}
            brandColor={brandColor}
          />
        );
      case 'icp':
        return <ICPFitSlide data={data} brandColor={brandColor} />;
      case 'tam':
        return <TAMSlide data={data} brandColor={brandColor} />;
      case 'industry':
        return <IndustrySlide data={data} brandColor={brandColor} />;
      case 'geography':
        return <GeographySlide data={data} brandColor={brandColor} />;
      case 'prospects':
        return <ProspectsSlide data={data} brandColor={brandColor} />;
      case 'risks':
        return <RisksSlide data={data} brandColor={brandColor} />;
      case 'cta':
        return <CTASlide data={data} brandColor={brandColor} />;
      default:
        return null;
    }
  })();

  return (
    <SlideLayout fixedScale={fixedScale} className={className}>
      {slideContent}
    </SlideLayout>
  );
}
