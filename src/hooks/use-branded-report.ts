import { useState, useCallback } from 'react';
import { useEffectiveOrg } from '@/hooks/use-effective-org';
import { useBrandedConfig } from '@/hooks/useBrandedConfig';
import { supabase } from '@/integrations/supabase/client';
import { generateBrandedPDF, BrandedReportData } from '@/utils/branded-pdf-export';
import { detectRisks } from '@/utils/risk-detector';
import { toast } from 'sonner';

/** Convert a remote image URL to a base64 PNG string. Returns null on failure. */
async function logoToBase64(url: string): Promise<string | null> {
  try {
    return await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  } catch {
    return null;
  }
}

export function useBrandedReport() {
  const { effectiveOrgId } = useEffectiveOrg();
  const { data: brandConfig } = useBrandedConfig({
    orgId: effectiveOrgId || '',
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const generateReport = useCallback(async () => {
    if (!effectiveOrgId) {
      toast.error('No organization selected');
      return;
    }

    setIsGenerating(true);
    try {
      // Call edge function for server-side data + AI narratives
      const { data: response, error: fnError } = await supabase.functions.invoke(
        'generate-board-report',
        { body: { org_id: effectiveOrgId } }
      );

      if (fnError) {
        throw new Error(fnError.message || 'Failed to generate report data');
      }

      if (!response || !response.data) {
        throw new Error('Empty response from report generator');
      }

      const serverData = response.data;
      const aiNarratives = response.aiNarratives;

      // Client-side: logo conversion (needs DOM canvas)
      const logoBase64 = brandConfig?.logo_url ? await logoToBase64(brandConfig.logo_url) : null;

      // Client-side: detect risks (uses client supabase for RLS-scoped queries)
      const risks = await detectRisks(effectiveOrgId, {
        total_accounts: serverData.metrics.totalAccounts,
        scored_accounts: serverData.metrics.scoredAccounts,
        high_fit_accounts: serverData.metrics.highFitAccounts,
        medium_fit_accounts: serverData.metrics.mediumFitAccounts,
        low_fit_accounts: serverData.metrics.lowFitAccounts,
        campaign_ready_accounts: serverData.metrics.campaignReadyAccounts,
        data_completeness: serverData.metrics.dataCompleteness,
      }).catch(() => []);

      const rawName = brandConfig?.company_name || serverData.companyName || 'Organization';
      const resolvedCompanyName = rawName.toLowerCase() === 'launchpulse' ? 'LaunchPulse' : rawName;

      const reportData: BrandedReportData = {
        companyName: resolvedCompanyName,
        generatedAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        logoBase64,
        metrics: serverData.metrics,
        icpProfileCount: serverData.icpProfiles.length,
        icpProfileNames: serverData.icpProfiles.map((p: any) => p.name),
        icpProfiles: serverData.icpProfiles,
        tam: serverData.tam,
        sam: serverData.sam,
        som: serverData.som,
        industryBreakdown: serverData.industryBreakdown,
        sizeBreakdown: serverData.sizeBreakdown,
        geographyDistribution: serverData.geographyDistribution,
        topProspects: serverData.topProspects,
        insights: [], // AI narratives replace static insights
        risks,
        leadStats: serverData.leadStats,
        revenueModeling: serverData.revenueModeling,
        aiNarratives: aiNarratives || undefined,
      };

      await generateBrandedPDF(reportData, brandConfig ?? null);
      toast.success('Report downloaded successfully');
    } catch (err: any) {
      console.error('Report generation failed:', err);
      const msg = err.message || 'Failed to generate report';
      if (msg.includes('rate limit')) {
        toast.error('AI rate limit exceeded. Please try again in a moment.');
      } else if (msg.includes('credits') || msg.includes('payment')) {
        toast.error('AI credits exhausted. Please add funds to your workspace.');
      } else {
        toast.error(msg);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [effectiveOrgId, brandConfig]);

  return { generateReport, isGenerating };
}
