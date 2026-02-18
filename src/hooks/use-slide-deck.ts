import { useState, useCallback } from 'react';
import { useEffectiveOrg } from '@/hooks/use-effective-org';
import { useBrandedConfig } from '@/hooks/useBrandedConfig';
import { supabase } from '@/integrations/supabase/client';
import { detectRisks } from '@/utils/risk-detector';
import type { BrandedReportData } from '@/utils/branded-pdf-export';
import type { BrandConfig } from '@/hooks/useBrandedConfig';
import { toast } from 'sonner';

export function useSlideDeck() {
  const { effectiveOrgId } = useEffectiveOrg();
  const { data: hookBrandConfig } = useBrandedConfig({ orgId: effectiveOrgId || '' });
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<BrandedReportData | null>(null);
  const [brandConfig, setBrandConfig] = useState<BrandConfig | null>(null);

  const loadDeck = useCallback(async () => {
    if (!effectiveOrgId) {
      toast.error('No organization selected');
      return;
    }

    setIsLoading(true);
    try {
      const { data: response, error: fnError } = await supabase.functions.invoke(
        'generate-board-report',
        { body: { org_id: effectiveOrgId } }
      );

      if (fnError) throw new Error(fnError.message || 'Failed to generate report data');
      if (!response?.data) throw new Error('Empty response from report generator');

      const serverData = response.data;
      const aiNarratives = response.aiNarratives;
      const serverBrand = response.brandConfig;

      const effectiveBrand: BrandConfig | null = serverBrand ? {
        org_id: effectiveOrgId,
        company_name: serverBrand.company_name || hookBrandConfig?.company_name || null,
        logo_url: serverBrand.logo_url || hookBrandConfig?.logo_url || null,
        brand_primary_color: serverBrand.brand_primary_color || hookBrandConfig?.brand_primary_color || null,
        brand_secondary_color: serverBrand.brand_secondary_color || hookBrandConfig?.brand_secondary_color || null,
        value_proposition: serverBrand.value_proposition || hookBrandConfig?.value_proposition || null,
        target_persona_description: hookBrandConfig?.target_persona_description || null,
        calendly_base_url: hookBrandConfig?.calendly_base_url || null,
      } : hookBrandConfig;

      const risks = await detectRisks(effectiveOrgId, {
        total_accounts: serverData.metrics.totalAccounts,
        scored_accounts: serverData.metrics.scoredAccounts,
        high_fit_accounts: serverData.metrics.highFitAccounts,
        medium_fit_accounts: serverData.metrics.mediumFitAccounts,
        low_fit_accounts: serverData.metrics.lowFitAccounts,
        campaign_ready_accounts: serverData.metrics.campaignReadyAccounts,
        data_completeness: serverData.metrics.dataCompleteness,
      }).catch(() => []);

      const rawName = effectiveBrand?.company_name || serverData.companyName || 'Organization';
      const resolvedCompanyName = rawName.toLowerCase() === 'launchpulse' ? 'LaunchPulse' : rawName;

      const data: BrandedReportData = {
        companyName: resolvedCompanyName,
        generatedAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        logoBase64: null,
        metrics: serverData.metrics,
        icpProfileCount: serverData.icpProfiles.length,
        icpProfileNames: serverData.icpProfiles.map((p: any) => p.name),
        icpProfiles: serverData.icpProfiles,
        tam: serverData.tam,
        sam: serverData.sam,
        som: serverData.som,
        industryBreakdown: serverData.industryBreakdown,
        revenueRangeBreakdown: serverData.revenueRangeBreakdown,
        sizeBreakdown: serverData.sizeBreakdown,
        geographyDistribution: serverData.geographyDistribution,
        topProspects: serverData.topProspects,
        insights: [],
        risks,
        leadStats: serverData.leadStats,
        revenueModeling: serverData.revenueModeling,
        aiNarratives: aiNarratives || undefined,
      };

      setReportData(data);
      setBrandConfig(effectiveBrand);
    } catch (err: any) {
      console.error('Slide deck load failed:', err);
      toast.error(err.message || 'Failed to load presentation data');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveOrgId, hookBrandConfig]);

  return {
    isLoading,
    reportData,
    brandConfig,
    loadDeck,
    logoUrl: brandConfig?.logo_url ?? null,
    brandColor: brandConfig?.brand_primary_color ?? undefined,
  };
}
