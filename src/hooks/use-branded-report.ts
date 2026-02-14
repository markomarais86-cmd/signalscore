import { useState, useCallback } from 'react';
import { useEffectiveOrg } from '@/hooks/use-effective-org';
import { useBrandedConfig } from '@/hooks/useBrandedConfig';
import { supabase } from '@/integrations/supabase/client';
import { generateBrandedPDF, BrandedReportData } from '@/utils/branded-pdf-export';
import { detectRisks } from '@/utils/risk-detector';
import { ICPInsight } from '@/hooks/use-icp-insights';
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

/** Aggregate industry breakdown from real accounts */
async function fetchIndustryBreakdown(orgId: string) {
  const { data } = await supabase
    .from('accounts')
    .select('industry_norm')
    .eq('org_id', orgId)
    .not('industry_norm', 'is', null);

  if (!data || data.length === 0) return [];

  const counts = new Map<string, number>();
  data.forEach((a: any) => {
    const ind = a.industry_norm || 'Unknown';
    counts.set(ind, (counts.get(ind) || 0) + 1);
  });

  const total = data.length;
  return Array.from(counts.entries())
    .map(([name, accounts]) => ({ name, accounts, percentage: (accounts / total) * 100 }))
    .sort((a, b) => b.accounts - a.accounts)
    .slice(0, 10);
}

/** Aggregate company size breakdown from real accounts */
async function fetchSizeBreakdown(orgId: string) {
  const { data } = await supabase
    .from('accounts')
    .select('employee_count')
    .eq('org_id', orgId);

  if (!data || data.length === 0) return [];

  const buckets: Record<string, number> = {
    '1-10': 0, '11-50': 0, '51-200': 0, '201-1000': 0, '1001-5000': 0, '5000+': 0, 'Unknown': 0,
  };

  data.forEach((a: any) => {
    const bucket = categorizeEmployeeCount(a.employee_count);
    buckets[bucket] = (buckets[bucket] || 0) + 1;
  });

  const total = data.length;
  return Object.entries(buckets)
    .filter(([, count]) => count > 0)
    .map(([name, accounts]) => ({ name, accounts, percentage: (accounts / total) * 100 }))
    .sort((a, b) => b.accounts - a.accounts);
}

/** Compute data completeness from actual account field coverage */
async function computeDataCompleteness(orgId: string): Promise<number> {
  const { data } = await supabase
    .from('accounts')
    .select('name, industry_norm, employee_count, country, domain, revenue_range')
    .eq('org_id', orgId)
    .limit(500);

  if (!data || data.length === 0) return 0;

  const fields = ['name', 'industry_norm', 'employee_count', 'country', 'domain', 'revenue_range'] as const;
  let filled = 0;
  let total = 0;

  data.forEach((row: any) => {
    fields.forEach(f => {
      total++;
      if (row[f] != null && row[f] !== '') filled++;
    });
  });

  return total > 0 ? Math.round((filled / total) * 100) : 0;
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
      const [metricsRes, icpRes, geoRes, topAccountsRes, insightsRes, orgRes, leadsRes, industryBreakdown, sizeBreakdown, dataCompleteness] = await Promise.all([
        supabase.rpc('get_dashboard_metrics_cached' as any, { p_org_id: effectiveOrgId }),
        supabase.from('icp_profiles').select('*').eq('org_id', effectiveOrgId).eq('status', 'active'),
        // Use 'database' source filter for real accounts only
        supabase.rpc('get_geography_distribution', { p_org_id: effectiveOrgId, p_source_filter: 'database' }),
        supabase.from('scores')
          .select('account_external_id, overall, fit, intent, org_id')
          .eq('org_id', effectiveOrgId)
          .order('overall', { ascending: false })
          .limit(10),
        supabase.functions.invoke('generate-icp-insights', {
          body: { org_id: effectiveOrgId },
        }).catch(() => ({ data: null, error: null })),
        supabase.from('organizations').select('name').eq('id', effectiveOrgId).maybeSingle(),
        supabase.from('Leads').select('id', { count: 'exact', head: true }).eq('org_id', effectiveOrgId),
        // Real account data aggregations
        fetchIndustryBreakdown(effectiveOrgId),
        fetchSizeBreakdown(effectiveOrgId),
        computeDataCompleteness(effectiveOrgId),
      ]);

      const raw = Array.isArray(metricsRes.data) ? (metricsRes.data as any)?.[0] : metricsRes.data as any;
      const metrics = {
        totalAccounts: raw?.total_accounts || 0,
        scoredAccounts: raw?.scored_accounts || 0,
        highFitAccounts: raw?.high_fit_accounts || 0,
        mediumFitAccounts: raw?.medium_fit_accounts || 0,
        lowFitAccounts: raw?.low_fit_accounts || 0,
        campaignReadyAccounts: raw?.campaign_ready_accounts || 0,
        dataCompleteness: dataCompleteness || Math.round(raw?.data_completeness || 0),
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
      const tamTotal = Number(raw?.apollo_accounts_available) || metrics.totalAccounts;
      const sam = metrics.highFitAccounts + metrics.mediumFitAccounts;
      const som = metrics.campaignReadyAccounts;

      // Geography — using 'database' source filter
      const geoData = (geoRes.data || []) as any[];
      const geoTotal = geoData.reduce((s: number, g: any) => s + (g.count || 0), 0);
      const geographyDistribution = geoData.map((g: any) => ({
        country: g.country || 'Unknown',
        accounts: g.count || 0,
        percentage: geoTotal > 0 ? ((g.count || 0) / geoTotal) * 100 : 0,
      }));

      // Top 10 prospects with revenue and lead count
      const topScores = topAccountsRes.data || [];
      let topProspects: BrandedReportData['topProspects'] = [];
      if (topScores.length > 0) {
        const extIds = topScores.map((s: any) => s.account_external_id);
        const [{ data: accountDetails }, { data: leadCounts }] = await Promise.all([
          supabase
            .from('accounts')
            .select('external_id, name, industry_norm, employee_count, country, revenue_range')
            .eq('org_id', effectiveOrgId)
            .in('external_id', extIds),
          supabase
            .from('Leads')
            .select('account_external_id')
            .eq('org_id', effectiveOrgId)
            .in('account_external_id', extIds),
        ]);

        const accountMap = new Map((accountDetails || []).map((a: any) => [a.external_id, a]));
        // Count leads per account
        const leadCountMap = new Map<string, number>();
        (leadCounts || []).forEach((l: any) => {
          leadCountMap.set(l.account_external_id, (leadCountMap.get(l.account_external_id) || 0) + 1);
        });

        topProspects = topScores.map((s: any) => {
          const acct = accountMap.get(s.account_external_id) as any;
          return {
            name: acct?.name || s.account_external_id,
            industry: acct?.industry_norm || 'N/A',
            size: categorizeEmployeeCount(acct?.employee_count),
            country: acct?.country || 'N/A',
            fitScore: s.fit || 0,
            intentScore: s.intent || 0,
            overallScore: s.overall || 0,
            revenueRange: acct?.revenue_range || 'N/A',
            leadCount: leadCountMap.get(s.account_external_id) || 0,
          };
        });
      }

      // AI Insights
      const insights: ICPInsight[] = (insightsRes as any)?.data?.insights || [];

      // Risks
      const risks = await detectRisks(effectiveOrgId, raw).catch(() => []);

      // Logo
      const logoBase64 = brandConfig?.logo_url ? await logoToBase64(brandConfig.logo_url) : null;

      const rawName = brandConfig?.company_name || orgRes.data?.name || 'Organization';
      const resolvedCompanyName = rawName.toLowerCase() === 'launchpulse' ? 'LaunchPulse' : rawName;
      const totalLeads = leadsRes.count || 0;

      const reportData: BrandedReportData = {
        companyName: resolvedCompanyName,
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
        insights,
        risks,
        leadStats: {
          totalLeads,
          leadCoverage: metrics.totalAccounts > 0 ? Math.min(Math.round((totalLeads / metrics.totalAccounts) * 100), 100) : 0,
          leadsPerAccount: metrics.totalAccounts > 0 ? parseFloat((totalLeads / metrics.totalAccounts).toFixed(1)) : 0,
        },
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
