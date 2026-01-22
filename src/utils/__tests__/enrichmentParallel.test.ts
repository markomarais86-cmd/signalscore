import { describe, it, expect } from 'vitest';

// Test adaptive timeout calculation
describe('Adaptive Timeout Calculator', () => {
  const BASE_TIMEOUTS: Record<string, number> = {
    perplexity: 8000,
    anthropic: 10000,
    xai: 8000,
    lovable: 6000,
    openai: 12000,
  };
  
  const MAX_TIMEOUT = 25000;
  const LATENCY_MULTIPLIER = 1.5;
  const LATENCY_BUFFER = 3000;

  function calculateAdaptiveTimeout(
    provider: string,
    avgLatency: number | null
  ): number {
    const baseTimeout = BASE_TIMEOUTS[provider] || 10000;
    
    if (!avgLatency) return baseTimeout;
    
    const adaptiveTimeout = Math.round(avgLatency * LATENCY_MULTIPLIER + LATENCY_BUFFER);
    return Math.min(Math.max(baseTimeout, adaptiveTimeout), MAX_TIMEOUT);
  }

  it('returns base timeout when no latency data', () => {
    expect(calculateAdaptiveTimeout('perplexity', null)).toBe(8000);
    expect(calculateAdaptiveTimeout('openai', null)).toBe(12000);
  });

  it('uses adaptive timeout for slow providers', () => {
    // 10s avg latency -> 10 * 1.5 + 3 = 18s
    expect(calculateAdaptiveTimeout('anthropic', 10000)).toBe(18000);
  });

  it('caps at MAX_TIMEOUT for very slow providers', () => {
    // 20s avg latency -> 20 * 1.5 + 3 = 33s, capped at 25s
    expect(calculateAdaptiveTimeout('openai', 20000)).toBe(25000);
  });

  it('uses base timeout if adaptive is lower', () => {
    // 2s avg latency -> 2 * 1.5 + 3 = 6s, but base is 8s
    expect(calculateAdaptiveTimeout('perplexity', 2000)).toBe(8000);
  });

  it('returns default base timeout for unknown provider', () => {
    expect(calculateAdaptiveTimeout('unknown_provider', null)).toBe(10000);
  });
});

// Test circuit breaker state filtering
describe('Circuit Breaker Provider Filtering', () => {
  interface ProviderCircuitState {
    provider: string;
    circuitState: 'closed' | 'open' | 'half_open';
  }

  function filterAvailableProviders(
    providers: string[],
    circuitStates: ProviderCircuitState[]
  ): string[] {
    return providers.filter(provider => {
      const circuit = circuitStates.find(c => c.provider === provider);
      return !circuit || circuit.circuitState !== 'open';
    });
  }

  it('includes all providers when circuits are closed', () => {
    const providers = ['perplexity', 'anthropic', 'xai'];
    const circuits: ProviderCircuitState[] = [
      { provider: 'perplexity', circuitState: 'closed' },
      { provider: 'anthropic', circuitState: 'closed' },
      { provider: 'xai', circuitState: 'closed' },
    ];
    
    expect(filterAvailableProviders(providers, circuits)).toEqual(providers);
  });

  it('excludes providers with open circuits', () => {
    const providers = ['perplexity', 'anthropic', 'xai'];
    const circuits: ProviderCircuitState[] = [
      { provider: 'perplexity', circuitState: 'closed' },
      { provider: 'anthropic', circuitState: 'open' },
      { provider: 'xai', circuitState: 'closed' },
    ];
    
    expect(filterAvailableProviders(providers, circuits)).toEqual(['perplexity', 'xai']);
  });

  it('includes half_open circuits (for recovery testing)', () => {
    const providers = ['perplexity', 'anthropic'];
    const circuits: ProviderCircuitState[] = [
      { provider: 'perplexity', circuitState: 'closed' },
      { provider: 'anthropic', circuitState: 'half_open' },
    ];
    
    expect(filterAvailableProviders(providers, circuits)).toEqual(providers);
  });

  it('includes providers with no circuit state entry', () => {
    const providers = ['perplexity', 'anthropic', 'xai'];
    const circuits: ProviderCircuitState[] = [
      { provider: 'perplexity', circuitState: 'closed' },
    ];
    
    expect(filterAvailableProviders(providers, circuits)).toEqual(providers);
  });

  it('handles empty circuit states array', () => {
    const providers = ['perplexity', 'anthropic'];
    const circuits: ProviderCircuitState[] = [];
    
    expect(filterAvailableProviders(providers, circuits)).toEqual(providers);
  });

  it('excludes multiple open circuits', () => {
    const providers = ['perplexity', 'anthropic', 'xai', 'lovable', 'openai'];
    const circuits: ProviderCircuitState[] = [
      { provider: 'perplexity', circuitState: 'open' },
      { provider: 'anthropic', circuitState: 'closed' },
      { provider: 'xai', circuitState: 'open' },
      { provider: 'lovable', circuitState: 'closed' },
      { provider: 'openai', circuitState: 'half_open' },
    ];
    
    expect(filterAvailableProviders(providers, circuits)).toEqual(['anthropic', 'lovable', 'openai']);
  });
});

// Test cost tracking aggregation
describe('Cost Tracking Aggregation', () => {
  interface UsageRecord {
    provider: string;
    cost_estimate: number;
    success: boolean;
    latency_ms: number;
  }

  function aggregateProviderStats(records: UsageRecord[]) {
    const stats = new Map<string, {
      totalRequests: number;
      successCount: number;
      totalCost: number;
      totalLatency: number;
    }>();

    for (const record of records) {
      const existing = stats.get(record.provider) || {
        totalRequests: 0,
        successCount: 0,
        totalCost: 0,
        totalLatency: 0,
      };

      stats.set(record.provider, {
        totalRequests: existing.totalRequests + 1,
        successCount: existing.successCount + (record.success ? 1 : 0),
        totalCost: existing.totalCost + record.cost_estimate,
        totalLatency: existing.totalLatency + record.latency_ms,
      });
    }

    return stats;
  }

  function calculateSuccessRate(stats: { successCount: number; totalRequests: number }): number {
    return stats.totalRequests > 0 ? (stats.successCount / stats.totalRequests) * 100 : 0;
  }

  function calculateAvgLatency(stats: { totalLatency: number; totalRequests: number }): number {
    return stats.totalRequests > 0 ? Math.round(stats.totalLatency / stats.totalRequests) : 0;
  }

  it('aggregates stats correctly for single provider', () => {
    const records: UsageRecord[] = [
      { provider: 'perplexity', cost_estimate: 0.01, success: true, latency_ms: 1000 },
      { provider: 'perplexity', cost_estimate: 0.02, success: true, latency_ms: 1500 },
      { provider: 'perplexity', cost_estimate: 0.01, success: false, latency_ms: 2000 },
    ];

    const stats = aggregateProviderStats(records);
    const perplexityStats = stats.get('perplexity')!;

    expect(perplexityStats.totalRequests).toBe(3);
    expect(perplexityStats.successCount).toBe(2);
    expect(perplexityStats.totalCost).toBeCloseTo(0.04);
    expect(perplexityStats.totalLatency).toBe(4500);
    expect(calculateSuccessRate(perplexityStats)).toBeCloseTo(66.67, 1);
    expect(calculateAvgLatency(perplexityStats)).toBe(1500);
  });

  it('handles multiple providers', () => {
    const records: UsageRecord[] = [
      { provider: 'perplexity', cost_estimate: 0.01, success: true, latency_ms: 1000 },
      { provider: 'anthropic', cost_estimate: 0.03, success: true, latency_ms: 2000 },
    ];

    const stats = aggregateProviderStats(records);

    expect(stats.get('perplexity')!.totalRequests).toBe(1);
    expect(stats.get('anthropic')!.totalRequests).toBe(1);
    expect(stats.get('anthropic')!.totalCost).toBeCloseTo(0.03);
  });

  it('handles empty records array', () => {
    const records: UsageRecord[] = [];
    const stats = aggregateProviderStats(records);
    
    expect(stats.size).toBe(0);
  });

  it('calculates correct success rate with all failures', () => {
    const records: UsageRecord[] = [
      { provider: 'xai', cost_estimate: 0.01, success: false, latency_ms: 5000 },
      { provider: 'xai', cost_estimate: 0.01, success: false, latency_ms: 6000 },
    ];

    const stats = aggregateProviderStats(records);
    const xaiStats = stats.get('xai')!;

    expect(calculateSuccessRate(xaiStats)).toBe(0);
    expect(xaiStats.totalRequests).toBe(2);
  });

  it('aggregates all 5 providers correctly', () => {
    const records: UsageRecord[] = [
      { provider: 'perplexity', cost_estimate: 0.01, success: true, latency_ms: 1000 },
      { provider: 'anthropic', cost_estimate: 0.02, success: true, latency_ms: 2000 },
      { provider: 'xai', cost_estimate: 0.015, success: true, latency_ms: 1500 },
      { provider: 'lovable', cost_estimate: 0.008, success: true, latency_ms: 800 },
      { provider: 'openai', cost_estimate: 0.025, success: false, latency_ms: 3000 },
    ];

    const stats = aggregateProviderStats(records);
    
    expect(stats.size).toBe(5);
    
    const totalCost = Array.from(stats.values()).reduce((sum, s) => sum + s.totalCost, 0);
    expect(totalCost).toBeCloseTo(0.078);
    
    const totalSuccessful = Array.from(stats.values()).reduce((sum, s) => sum + s.successCount, 0);
    expect(totalSuccessful).toBe(4);
  });
});

// Test budget enforcement logic
describe('Budget Enforcement', () => {
  const DAILY_BUDGET = 50; // $50/day

  function checkBudgetExceeded(dailyCost: number): boolean {
    return dailyCost >= DAILY_BUDGET;
  }

  function getBudgetUsagePercent(dailyCost: number): number {
    return Math.min((dailyCost / DAILY_BUDGET) * 100, 100);
  }

  function shouldWarnAboutBudget(dailyCost: number, warningThreshold: number = 90): boolean {
    return getBudgetUsagePercent(dailyCost) >= warningThreshold;
  }

  it('allows requests under budget', () => {
    expect(checkBudgetExceeded(25)).toBe(false);
    expect(checkBudgetExceeded(49.99)).toBe(false);
  });

  it('blocks requests at or over budget', () => {
    expect(checkBudgetExceeded(50)).toBe(true);
    expect(checkBudgetExceeded(75)).toBe(true);
  });

  it('calculates correct usage percentage', () => {
    expect(getBudgetUsagePercent(0)).toBe(0);
    expect(getBudgetUsagePercent(25)).toBe(50);
    expect(getBudgetUsagePercent(50)).toBe(100);
    expect(getBudgetUsagePercent(100)).toBe(100); // Capped at 100
  });

  it('triggers warning at 90% threshold', () => {
    expect(shouldWarnAboutBudget(44)).toBe(false);
    expect(shouldWarnAboutBudget(45)).toBe(true);
    expect(shouldWarnAboutBudget(50)).toBe(true);
  });

  it('respects custom warning threshold', () => {
    expect(shouldWarnAboutBudget(40, 80)).toBe(true);
    expect(shouldWarnAboutBudget(35, 80)).toBe(false);
  });
});
