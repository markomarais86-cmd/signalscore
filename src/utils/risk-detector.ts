import { supabase } from "@/integrations/supabase/client";

export interface RiskItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  count: number;
  impact: string;
  filter?: Record<string, any>;
  action?: {
    label: string;
    route: string;
  };
}

export async function detectRisks(orgId: string, metrics: any): Promise<RiskItem[]> {
  const risks: RiskItem[] = [];

  try {
    // Risk 1: Unscored Database accounts
    const unscoredDbAccounts = metrics.databaseAccounts - Math.floor((metrics.totalScored / metrics.totalAccounts) * metrics.databaseAccounts);
    
    if (unscoredDbAccounts > 100) {
      risks.push({
        id: 'unscored-db',
        severity: 'critical',
        title: 'Unscored Database Accounts',
        description: `${unscoredDbAccounts.toLocaleString()} Database accounts lack ICP scores`,
        count: unscoredDbAccounts,
        impact: 'Cannot identify whitespace opportunities',
        filter: { data_source: 'database', scored: false },
        action: {
          label: 'Score Accounts',
          route: '/accounts?action=score'
        }
      });
    }

    // Risk 2: High-fit accounts missing contacts
    const { data: highFitWithoutContacts } = await supabase
      .from('scores')
      .select('account_external_id')
      .eq('org_id', orgId)
      .gte('overall', 70)
      .limit(10000);

    if (highFitWithoutContacts) {
      const highFitIds = highFitWithoutContacts.map(s => s.account_external_id);
      
      const { data: accountsWithContacts } = await supabase
        .from('contacts')
        .select('account_external_id')
        .eq('org_id', orgId)
        .in('account_external_id', highFitIds);

      const accountsWithContactsSet = new Set(accountsWithContacts?.map(c => c.account_external_id) || []);
      const missingContacts = highFitIds.filter(id => !accountsWithContactsSet.has(id)).length;

      if (missingContacts > 50) {
        risks.push({
          id: 'high-fit-no-contacts',
          severity: 'critical',
          title: 'High-Fit Accounts Missing Contacts',
          description: `${missingContacts.toLocaleString()} high-fit accounts have no reachable contacts`,
          count: missingContacts,
          impact: 'Campaigns underpowered, cannot execute outreach',
          filter: { highFit: true, noContacts: true },
          action: {
            label: 'Enrich Contacts',
            route: '/settings?tab=integrations&action=enrich'
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
            severity: 'warning',
            title: `${region} Data Completeness Low`,
            description: `Only ${completeness.toFixed(0)}% complete across ${data.total} accounts`,
            count: data.total - data.complete,
            impact: 'Reduced scoring accuracy and targeting precision',
            filter: { country: region, incomplete: true },
            action: {
              label: 'Enrich Data',
              route: '/settings?tab=integrations&action=enrich'
            }
          });
        }
      });
    }

    // Risk 4: Low overall data completeness
    if (metrics.completenessScore < 60) {
      risks.push({
        id: 'low-completeness',
        severity: 'warning',
        title: 'Overall Data Quality Below Target',
        description: `${metrics.completenessScore}% completeness across all accounts`,
        count: Math.floor(metrics.totalAccounts * (1 - metrics.completenessScore / 100)),
        impact: 'ICP scoring accuracy degraded',
        filter: { incomplete: true },
        action: {
          label: 'Enrich Data',
          route: '/settings?tab=integrations&action=enrich'
        }
      });
    }

    // Sort by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return risks.slice(0, 5); // Top 5 risks
  } catch (error) {
    console.error('Error detecting risks:', error);
    return [];
  }
}
