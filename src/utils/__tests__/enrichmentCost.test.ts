import { describe, it, expect } from 'vitest';

// Enrichment cost calculation logic (extracted for testing)
interface CostBreakdown {
  provider: string;
  unitCost: number;
  count: number;
  total: number;
}

interface EnrichmentCostEstimate {
  totalCost: number;
  breakdown: CostBreakdown[];
  creditsRequired: number;
}

const PROVIDER_COSTS: Record<string, number> = {
  pdl: 0.10,
  clearbit: 0.15,
  ai: 0.02,
  zoominfo: 0.25,
  apollo: 0.08,
};

function calculateEnrichmentCost(
  accountCount: number,
  providers: string[],
  useWaterfall: boolean = false
): EnrichmentCostEstimate {
  if (accountCount <= 0) {
    return { totalCost: 0, breakdown: [], creditsRequired: 0 };
  }

  const breakdown: CostBreakdown[] = [];
  let totalCost = 0;

  if (useWaterfall) {
    // Waterfall: estimate 70% success rate per provider
    let remaining = accountCount;
    for (const provider of providers) {
      const unitCost = PROVIDER_COSTS[provider] || 0.10;
      const processed = Math.ceil(remaining * 0.7);
      const cost = processed * unitCost;
      breakdown.push({
        provider,
        unitCost,
        count: processed,
        total: cost,
      });
      totalCost += cost;
      remaining = remaining - processed;
      if (remaining <= 0) break;
    }
  } else {
    // Single provider or parallel
    for (const provider of providers) {
      const unitCost = PROVIDER_COSTS[provider] || 0.10;
      const cost = accountCount * unitCost;
      breakdown.push({
        provider,
        unitCost,
        count: accountCount,
        total: cost,
      });
      totalCost += cost;
    }
  }

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    breakdown,
    creditsRequired: Math.ceil(totalCost * 10), // 1 credit = $0.10
  };
}

describe('calculateEnrichmentCost', () => {
  it('returns zero cost for zero accounts', () => {
    const result = calculateEnrichmentCost(0, ['pdl']);
    expect(result.totalCost).toBe(0);
    expect(result.breakdown).toHaveLength(0);
  });

  it('calculates single provider cost correctly', () => {
    const result = calculateEnrichmentCost(100, ['pdl']);
    expect(result.totalCost).toBe(10); // 100 * $0.10
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].provider).toBe('pdl');
  });

  it('calculates multiple provider cost correctly', () => {
    const result = calculateEnrichmentCost(100, ['pdl', 'clearbit']);
    expect(result.totalCost).toBe(25); // 100 * $0.10 + 100 * $0.15
    expect(result.breakdown).toHaveLength(2);
  });

  it('calculates waterfall cost with decreasing counts', () => {
    const result = calculateEnrichmentCost(100, ['pdl', 'clearbit'], true);
    expect(result.breakdown[0].count).toBe(70); // 70% of 100
    expect(result.breakdown[1].count).toBe(21); // 70% of 30
  });

  it('uses default cost for unknown providers', () => {
    const result = calculateEnrichmentCost(10, ['unknown_provider']);
    expect(result.totalCost).toBe(1); // 10 * $0.10 default
  });

  it('calculates credits required correctly', () => {
    const result = calculateEnrichmentCost(100, ['ai']);
    expect(result.totalCost).toBe(2); // 100 * $0.02
    expect(result.creditsRequired).toBe(20); // $2 * 10
  });
});
