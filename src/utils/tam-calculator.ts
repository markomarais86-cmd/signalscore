/**
 * TAM Calculator Utility
 * Calculates Total Addressable Market based on real account and lead data
 */

interface Account {
  id: string;
  external_id: string;
  name: string | null;
  industry_norm: string | null;
  employee_count: number | null;
  revenue_range: string | null;
  country: string | null;
}

interface Score {
  account_external_id: string;
  overall: number;
  fit: number;
  intent: number;
  reachability: number;
}

interface Lead {
  external_id: string;
  status: string;
}

interface TAMBreakdown {
  totalAccounts: number;
  highSignalAccounts: number;
  qualifiedLeads: number;
  closedWonLeads: number;
  tamValue: number;
  averageDealSize: number;
  conversionRate: number;
  industryBreakdown: Array<{
    industry: string;
    accounts: number;
    value: number;
    avgScore: number;
  }>;
  sizeBreakdown: Array<{
    size: string;
    accounts: number;
    value: number;
    avgScore: number;
  }>;
  geoBreakdown: Array<{
    country: string;
    accounts: number;
    value: number;
    avgScore: number;
  }>;
}

/**
 * Parse revenue range to get average value
 */
export function parseRevenueRange(range: string | null): number {
  if (!range) return 50000; // Default $50k per account

  const rangeMap: { [key: string]: number } = {
    '$0-$1M': 500000,
    '$1M-$5M': 3000000,
    '$5M-$10M': 7500000,
    '$10M-$25M': 17500000,
    '$25M-$50M': 37500000,
    '$50M-$100M': 75000000,
    '$100M-$500M': 300000000,
    '$500M+': 750000000,
  };

  return rangeMap[range] || 50000;
}

/**
 * Calculate comprehensive TAM from accounts, scores, and leads
 */
export function calculateTAM(
  accounts: Account[],
  scores: Score[],
  leads: Lead[],
  averageDealSize: number = 75000
): TAMBreakdown {
  // Create score lookup map
  const scoreMap = new Map(scores.map(s => [s.account_external_id, s]));

  // Calculate high-signal accounts (score >= 70)
  const accountsWithScores = accounts.map(acc => ({
    ...acc,
    score: scoreMap.get(acc.external_id),
  }));

  const highSignalAccounts = accountsWithScores.filter(
    acc => (acc.score?.overall || 0) >= 70
  );

  // Match leads to accounts
  const leadExternalIds = new Set(leads.map(l => l.external_id));
  const qualifiedLeads = highSignalAccounts.filter(acc =>
    leadExternalIds.has(acc.external_id)
  );

  const closedWonLeads = leads.filter(l => l.status === 'closed-won' || l.status === 'qualified');

  // Calculate TAM: High-signal accounts × average deal size
  const tamValue = highSignalAccounts.length * averageDealSize;

  // Conversion rate: qualified leads / high signal accounts
  const conversionRate = highSignalAccounts.length > 0
    ? (qualifiedLeads.length / highSignalAccounts.length) * 100
    : 0;

  // Industry breakdown
  const industryMap = new Map<string, { accounts: Account[]; scores: number[] }>();
  highSignalAccounts.forEach(acc => {
    const industry = acc.industry_norm || 'Other';
    if (!industryMap.has(industry)) {
      industryMap.set(industry, { accounts: [], scores: [] });
    }
    const data = industryMap.get(industry)!;
    data.accounts.push(acc);
    if (acc.score) data.scores.push(acc.score.overall);
  });

  const industryBreakdown = Array.from(industryMap.entries())
    .map(([industry, data]) => ({
      industry,
      accounts: data.accounts.length,
      value: data.accounts.length * averageDealSize,
      avgScore: data.scores.length > 0
        ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
        : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // Size breakdown (by employee count)
  const getSizeBucket = (empCount: number | null): string => {
    if (!empCount) return 'Unknown';
    if (empCount < 50) return '1-49';
    if (empCount < 200) return '50-199';
    if (empCount < 500) return '200-499';
    if (empCount < 1000) return '500-999';
    return '1000+';
  };

  const sizeMap = new Map<string, { accounts: Account[]; scores: number[] }>();
  highSignalAccounts.forEach(acc => {
    const size = getSizeBucket(acc.employee_count);
    if (!sizeMap.has(size)) {
      sizeMap.set(size, { accounts: [], scores: [] });
    }
    const data = sizeMap.get(size)!;
    data.accounts.push(acc);
    if (acc.score) data.scores.push(acc.score.overall);
  });

  const sizeBreakdown = Array.from(sizeMap.entries())
    .map(([size, data]) => ({
      size,
      accounts: data.accounts.length,
      value: data.accounts.length * averageDealSize,
      avgScore: data.scores.length > 0
        ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
        : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // Geographic breakdown
  const geoMap = new Map<string, { accounts: Account[]; scores: number[] }>();
  highSignalAccounts.forEach(acc => {
    const country = acc.country || 'Unknown';
    if (!geoMap.has(country)) {
      geoMap.set(country, { accounts: [], scores: [] });
    }
    const data = geoMap.get(country)!;
    data.accounts.push(acc);
    if (acc.score) data.scores.push(acc.score.overall);
  });

  const geoBreakdown = Array.from(geoMap.entries())
    .map(([country, data]) => ({
      country,
      accounts: data.accounts.length,
      value: data.accounts.length * averageDealSize,
      avgScore: data.scores.length > 0
        ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
        : 0,
    }))
    .sort((a, b) => b.value - a.value);

  return {
    totalAccounts: accounts.length,
    highSignalAccounts: highSignalAccounts.length,
    qualifiedLeads: qualifiedLeads.length,
    closedWonLeads: closedWonLeads.length,
    tamValue,
    averageDealSize,
    conversionRate,
    industryBreakdown,
    sizeBreakdown,
    geoBreakdown,
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number): string {
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

/**
 * Generate insights and recommendations based on TAM data
 */
export function generateTAMInsights(breakdown: TAMBreakdown): {
  insights: string[];
  recommendations: string[];
} {
  const insights: string[] = [];
  const recommendations: string[] = [];

  // TAM insights
  if (breakdown.highSignalAccounts > 0) {
    const conversionRate = breakdown.conversionRate;
    insights.push(
      `${breakdown.highSignalAccounts} high-signal accounts represent ${formatCurrency(breakdown.tamValue)} in TAM`
    );

    if (conversionRate < 20) {
      recommendations.push('Focus on converting high-signal accounts to qualified leads');
    } else if (conversionRate > 50) {
      insights.push('Strong lead conversion rate indicates effective ICP targeting');
    }
  }

  // Industry insights
  if (breakdown.industryBreakdown.length > 0) {
    const topIndustry = breakdown.industryBreakdown[0];
    insights.push(`${topIndustry.industry} represents largest TAM segment: ${formatCurrency(topIndustry.value)}`);
    
    if (breakdown.industryBreakdown.length > 3) {
      recommendations.push('Consider focusing resources on top 3 industry segments');
    }
  }

  // Geographic insights
  if (breakdown.geoBreakdown.length > 0) {
    const topGeo = breakdown.geoBreakdown[0];
    insights.push(`${topGeo.country} is the largest geographic market`);
    
    if (breakdown.geoBreakdown.length > 5) {
      recommendations.push('Prioritize expansion in top 5 geographic markets');
    }
  }

  // Size insights
  if (breakdown.sizeBreakdown.length > 0) {
    const topSize = breakdown.sizeBreakdown[0];
    insights.push(`Companies with ${topSize.size} employees show strongest fit`);
  }

  return { insights, recommendations };
}
