/** Revenue modeling utilities for board reports */

export const REVENUE_MIDPOINTS: Record<string, number> = {
  '<$1M': 500_000,
  '$1M-$5M': 3_000_000,
  '$5M-$10M': 7_500_000,
  '$10M-$25M': 17_500_000,
  '$25M-$50M': 37_500_000,
  '$50M-$100M': 75_000_000,
  '$100M-$250M': 175_000_000,
  '$250M-$500M': 375_000_000,
  '$500M-$1B': 750_000_000,
  '$1B-$10B': 5_000_000_000,
  '$10B+': 15_000_000_000,
};

export const DEFAULT_ACV = 75_000;
export const DEFAULT_CONVERSION_RATE = 0.15;

export function revenueRangeToMidpoint(range: string | null): number | null {
  if (!range) return null;
  const cleaned = range.trim();
  return REVENUE_MIDPOINTS[cleaned] ?? null;
}

export function formatCurrency(value: number, compact = true): string {
  if (!compact || value < 1_000) return `$${Math.round(value).toLocaleString()}`;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}

export function deriveStageReadiness(intentScore: number): string {
  if (intentScore >= 60) return 'Ready';
  if (intentScore >= 40) return 'Warming';
  return 'Nurture';
}

export function deriveNextAction(fitScore: number, intentScore: number, leadCount: number): string {
  if (intentScore >= 60) return 'Engage Now';
  if (fitScore >= 60 && intentScore >= 40) return 'Accelerate';
  if (fitScore >= 60 && intentScore < 40) return 'Warm with Content';
  if (leadCount < 2) return 'Source Contacts';
  return 'Monitor';
}

export function deriveSegmentAction(highFitPct: number, accountCount: number, medianCount: number): string {
  if (highFitPct >= 10 && accountCount >= medianCount) return 'Focus';
  if (highFitPct >= 10 && accountCount < medianCount) return 'Expand';
  if (highFitPct >= 5) return 'Maintain';
  return 'Exit';
}

export function deriveGeoTag(sharePct: number, avgScore: number): string {
  if (sharePct > 10 && avgScore >= 50) return 'Core';
  if (sharePct <= 10 && avgScore >= 50) return 'Growth';
  if (sharePct > 10 && avgScore < 50) return 'Review';
  return 'Monitor';
}
