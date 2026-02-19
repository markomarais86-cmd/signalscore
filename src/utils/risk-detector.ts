import { supabase } from "@/integrations/supabase/client";
import { HIGH_FIT_THRESHOLD } from "@/lib/score-bands";

export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface RiskItem {
  id: string;
  severity: RiskSeverity;
  title: string;
  description: string;
  count: number;
  impact: string;
  filter?: Record<string, any>;
  fix?: {
    label: string;
    action: 'enrich' | 'navigate';
    target?: string;
    fields?: string[];
  };
}

export async function detectRisks(orgId: string, metrics: any): Promise<RiskItem[]> {
  const risks: RiskItem[] = [];

  // Guard against undefined metrics
  if (!metrics) {
    return risks;
  }

  try {
    // Risk 1: Unscored Database accounts
    const unscoredDbAccounts = metrics.database_accounts - Math.floor((metrics.total_scores / metrics.total_accounts) * metrics.database_accounts);
    
    if (unscoredDbAccounts > 100) {
      risks.push({
        id: 'unscored-db',
        severity: 'high',
        title: 'Unscored Database Accounts',
        description: `${unscoredDbAccounts.toLocaleString()} Database accounts lack ICP scores`,
        count: unscoredDbAccounts,
        impact: 'Cannot identify whitespace opportunities',
        filter: { data_source: 'database', scored: false },
        fix: {
          label: 'Score Accounts',
          action: 'navigate',
          target: '/accounts?action=score'
        }
      });
    }

    // Risk 2: High-fit accounts missing leads
    const { data: highFitWithoutLeads } = await supabase
      .from('scores')
      .select('account_external_id')
      .eq('org_id', orgId)
      .gte('overall', HIGH_FIT_THRESHOLD)
      .limit(10000);

    if (highFitWithoutLeads) {
      const highFitIds = highFitWithoutLeads.map(s => s.account_external_id);
      
      // Process in chunks of 500 to stay within .in() clause limits
      const CHUNK_SIZE = 500;
      const accountsWithLeadsSet = new Set<string>();
      
      for (let i = 0; i < highFitIds.length; i += CHUNK_SIZE) {
        const chunk = highFitIds.slice(i, i + CHUNK_SIZE);
        const { data: chunkResults } = await supabase
          .from('Leads')
          .select('account_external_id')
          .eq('org_id', orgId)
          .in('account_external_id', chunk);
        
        chunkResults?.forEach(c => {
          if (c.account_external_id) {
            accountsWithLeadsSet.add(c.account_external_id);
          }
        });
      }

      const missingLeads = highFitIds.filter(id => !accountsWithLeadsSet.has(id)).length;

      if (missingLeads > 50) {
        risks.push({
          id: 'high-fit-no-leads',
          severity: 'critical',
          title: 'High-Fit Accounts Missing Leads',
          description: `${missingLeads.toLocaleString()} high-fit accounts have no reachable leads`,
          count: missingLeads,
          impact: 'Campaigns underpowered, cannot execute outreach',
          filter: { highFit: true, noLeads: true },
          fix: {
            label: 'Enrich Leads',
            action: 'enrich',
            fields: ['leads']
          }
        });
      }
    }

    // Risk 3: Regional completeness gaps
    const { data: accounts } = await supabase
      .from('accounts')
      .select('country, industry_norm, employee_count, revenue_range')
      .eq('org_id', orgId)
      .limit(10000);

    if (accounts) {
      const regionCompleteness: Record<string, { total: number; complete: number }> = {};
      
      accounts.forEach(acc => {
        const region = acc.country || 'Unknown';
        if (!regionCompleteness[region]) {
          regionCompleteness[region] = { total: 0, complete: 0 };
        }
        regionCompleteness[region].total++;
        
        const fieldsComplete = [
          acc.industry_norm,
          acc.employee_count,
          acc.revenue_range,
          acc.country
        ].filter(Boolean).length;
        
        if (fieldsComplete >= 3) {
          regionCompleteness[region].complete++;
        }
      });

      // Find regions with low completeness and significant account counts
      Object.entries(regionCompleteness).forEach(([region, data]) => {
        const completeness = (data.complete / data.total) * 100;
        if (completeness < 50 && data.total > 100) {
          risks.push({
            id: `region-${region}`,
            severity: 'medium',
            title: `${region} Data Completeness Low`,
            description: `Only ${completeness.toFixed(0)}% complete across ${data.total} accounts`,
            count: data.total - data.complete,
            impact: 'Reduced scoring accuracy and targeting precision',
            filter: { country: region, incomplete: true },
            fix: {
              label: 'Enrich Data',
              action: 'enrich',
              fields: ['industry', 'size', 'revenue', 'geography']
            }
          });
        }
      });
    }

    // Risk 4: Low overall data completeness
    if (metrics.data_completeness < 60) {
      risks.push({
        id: 'low-completeness',
        severity: 'high',
        title: 'Overall Data Quality Below Target',
        description: `${metrics.data_completeness}% completeness across all accounts`,
        count: Math.floor(metrics.total_accounts * (1 - metrics.data_completeness / 100)),
        impact: 'ICP scoring accuracy degraded',
        filter: { incomplete: true },
        fix: {
          label: 'Enrich Data',
          action: 'enrich',
          fields: ['industry', 'size', 'revenue', 'geography']
        }
      });
    }

    // Risk 5: Non-standardized industries (ZoomInfo taxonomy)
    if (accounts) {
      const nonStandardCount = accounts.filter(a => !a.industry_norm).length;
      if (nonStandardCount > 200) {
        risks.push({
          id: 'non-standard-industries',
          severity: 'medium',
          title: 'Industries Not Standardized',
          description: `${nonStandardCount.toLocaleString()} accounts using non-standard industry classification`,
          count: nonStandardCount,
          impact: 'Reduced filtering accuracy and ICP match quality',
          filter: { noStandardIndustry: true },
          fix: {
            label: 'Standardize Industries',
            action: 'navigate',
            target: '/settings?tab=data-quality'
          }
        });
      }
    }

    // Risk 6: Stale account data (no enrichment in 90+ days)
    const { data: staleAccounts } = await supabase
      .from('accounts')
      .select('external_id')
      .eq('org_id', orgId)
      .or('enriched_at.is.null,enriched_at.lt.' + new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .limit(10000);

    if (staleAccounts && staleAccounts.length > 300) {
      risks.push({
        id: 'stale-data',
        severity: 'low',
        title: 'Stale Account Data',
        description: `${staleAccounts.length.toLocaleString()} accounts not enriched in 90+ days`,
        count: staleAccounts.length,
        impact: 'Data may be outdated, affecting targeting accuracy',
        filter: { stale: true },
        fix: {
          label: 'Re-enrich Accounts',
          action: 'enrich',
          fields: ['all']
        }
      });
    }

    // Sort by severity
    const severityOrder: Record<RiskSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return risks.slice(0, 6); // Top 6 risks
  } catch (error) {
    console.error('Error detecting risks:', error);
    return [];
  }
}
