import { useState, useCallback } from 'react';
import { useEffectiveOrg } from '@/hooks/use-effective-org';
import { useBrandedConfig } from '@/hooks/useBrandedConfig';
import { supabase } from '@/integrations/supabase/client';
import { generateBrandedPDF, BrandedReportData } from '@/utils/branded-pdf-export';
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

function categorizeEmployeeCount(count: number | null): string {
  if (!count) return 'Unknown';
  if (count <= 10) return '1-10';
  if (count <= 50) return '11-50';
  if (count <= 200) return '51-200';
  if (count <= 1000) return '201-1000';
  if (count <= 5000) return '1001-5000';
  return '5000+';
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
      // Parallel data fetches
      const [metricsRes, icpRes, tamRes, geoRes, topAccountsRes] = await Promise.all([
        supabase.rpc('get_dashboard_metrics_cached' as any, { p_org_id: effectiveOrgId }),
        supabase.from('icp_profiles').select('*').eq('org_id', effectiveOrgId).eq('status', 'active'),
        supabase.from('external_data_sources')
          .select('total_accounts, industry_breakdown, company_size_breakdown')
          .eq('org_id', effectiveOrgId).eq('is_active', true)
          .order('last_synced_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.rpc('get_geography_distribution', { p_org_id: effectiveOrgId, p_source_filter: 'crm' }),
        supabase.from('scores')
          .select('account_external_id, overall_score, fit_score, intent_score, org_id')
          .eq('org_id', effectiveOrgId)
          .order('overall_score', { ascending: false })
          .limit(20),
      ]);

      const raw = Array.isArray(metricsRes.data) ? (metricsRes.data as any)?.[0] : metricsRes.data as any;
      const metrics = {
        totalAccounts: raw?.total_accounts || 0,
        scoredAccounts: raw?.scored_accounts || 0,
        highFitAccounts: raw?.high_fit_accounts || 0,
        mediumFitAccounts: raw?.medium_fit_accounts || 0,
        lowFitAccounts: raw?.low_fit_accounts || 0,
        campaignReadyAccounts: raw?.campaign_ready_accounts || 0,
        dataCompleteness: Math.round(raw?.data_completeness || 0),
      };

      // ICP profiles
      const icpProfiles = (icpRes.data || []).map((p: any) => ({
        name: p.name || 'Unnamed',
        targetIndustries: p.target_industries || [],
        companySizes: p.company_sizes || [],
        geographies: p.target_geographies || [],
        matchCount: p.match_count || 0,
        tamEstimate: p.tam_estimate || 0,
        confidence: p.confidence_score || 0,
      }));

      // TAM / SAM / SOM
      const tamTotal = Number(raw?.apollo_accounts_available) || Number(tamRes.data?.total_accounts) || 0;
      const sam = metrics.highFitAccounts + metrics.mediumFitAccounts;
      const som = metrics.campaignReadyAccounts;

      // Industry breakdown from external data
      const industryRaw = tamRes.data?.industry_breakdown as Record<string, number> | null;
      const industryBreakdown = industryRaw
        ? Object.entries(industryRaw)
            .map(([name, accounts]) => ({ name, accounts: Number(accounts), percentage: 0 }))
            .sort((a, b) => b.accounts - a.accounts)
            .slice(0, 10)
        : [];
      const indTotal = industryBreakdown.reduce((s, i) => s + i.accounts, 0);
      industryBreakdown.forEach(i => { i.percentage = indTotal > 0 ? (i.accounts / indTotal) * 100 : 0; });

      // Size breakdown
      const sizeRaw = tamRes.data?.company_size_breakdown as Record<string, number> | null;
      const sizeBreakdown = sizeRaw
        ? Object.entries(sizeRaw)
            .map(([name, accounts]) => ({ name, accounts: Number(accounts), percentage: 0 }))
            .sort((a, b) => b.accounts - a.accounts)
        : [];
      const sizeTotal = sizeBreakdown.reduce((s, i) => s + i.accounts, 0);
      sizeBreakdown.forEach(i => { i.percentage = sizeTotal > 0 ? (i.accounts / sizeTotal) * 100 : 0; });

      // Geography
      const geoData = (geoRes.data || []) as any[];
      const geoTotal = geoData.reduce((s: number, g: any) => s + (g.account_count || 0), 0);
      const geographyDistribution = geoData.map((g: any) => ({
        country: g.country || 'Unknown',
        accounts: g.account_count || 0,
        percentage: geoTotal > 0 ? ((g.account_count || 0) / geoTotal) * 100 : 0,
      }));

      // Top prospects – fetch account details for the top scored accounts
      const topScores = topAccountsRes.data || [];
      let topProspects: BrandedReportData['topProspects'] = [];
      if (topScores.length > 0) {
        const extIds = topScores.map((s: any) => s.account_external_id);
        const { data: accountDetails } = await supabase
          .from('accounts')
          .select('external_id, name, industry_norm, employee_count, country')
          .eq('org_id', effectiveOrgId)
          .in('external_id', extIds);

        const accountMap = new Map((accountDetails || []).map((a: any) => [a.external_id, a]));
        topProspects = topScores.map((s: any) => {
          const acct = accountMap.get(s.account_external_id) as any;
          return {
            name: acct?.name || s.account_external_id,
            industry: acct?.industry_norm || 'N/A',
            size: categorizeEmployeeCount(acct?.employee_count),
            country: acct?.country || 'N/A',
            fitScore: s.fit_score || 0,
            intentScore: s.intent_score || 0,
            overallScore: s.overall_score || 0,
          };
        });
      }

      // Logo
      const logoBase64 = brandConfig?.logo_url ? await logoToBase64(brandConfig.logo_url) : null;

      const reportData: BrandedReportData = {
        companyName: brandConfig?.company_name || 'Organization',
        generatedAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        logoBase64,
        metrics,
        icpProfileCount: icpProfiles.length,
        icpProfileNames: icpProfiles.map((p: any) => p.name),
        icpProfiles,
        tam: tamTotal,
        sam,
        som,
        industryBreakdown,
        sizeBreakdown,
        geographyDistribution,
        topProspects,
      };

      await generateBrandedPDF(reportData, brandConfig ?? null);
      toast.success('Report downloaded successfully');
    } catch (err: any) {
      console.error('Report generation failed:', err);
      toast.error(err.message || 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  }, [effectiveOrgId, brandConfig]);

  return { generateReport, isGenerating };
}
