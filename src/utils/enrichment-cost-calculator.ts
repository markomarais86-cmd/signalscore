// Enrichment Cost Calculator Utility

export interface EnrichmentCost {
  totalCost: number;
  breakdown: Array<{
    phase: string;
    cost: number;
    accountCount: number;
  }>;
  estimatedCredits: number;
}

const COST_PER_PHASE = {
  pdl: 0.005,           // $0.005 per call
  clearbit: 0.001,      // Free tier, minimal cost
  launch_pulse: 0.01,   // $0.01 per account (Launch Pulse proprietary)
  deep_research: 0.10,  // $0.10 per account (10x more expensive)
  // Lead enrichment costs
  perplexity: 0.01,     // $0.01 per Perplexity call
  claude: 0.008,        // $0.008 per Claude call
  gemini: 0.002,        // $0.002 per Gemini call
  firecrawl: 0.02,      // $0.02 per Firecrawl scrape
  hunter: 0.003,        // $0.003 per Hunter verification
};

// Estimate cost for 1,000 leads
export function estimateLeadEnrichmentCost(leadCount: number): {
  totalCost: number;
  perLeadCost: number;
  breakdown: Array<{ provider: string; estimatedCalls: number; cost: number }>;
} {
  // Based on typical enrichment patterns:
  // - 85% need Perplexity (AI research)
  // - 15% fallback to Claude
  // - 30% new domains need Firecrawl scraping
  // - 100% get Hunter email verification
  
  const perplexityCalls = Math.round(leadCount * 0.85);
  const claudeCalls = Math.round(leadCount * 0.15);
  const firecrawlCalls = Math.round(leadCount * 0.30);
  const hunterCalls = leadCount;
  
  const breakdown = [
    { provider: 'Perplexity (AI Research)', estimatedCalls: perplexityCalls, cost: perplexityCalls * COST_PER_PHASE.perplexity },
    { provider: 'Claude (Fallback)', estimatedCalls: claudeCalls, cost: claudeCalls * COST_PER_PHASE.claude },
    { provider: 'Firecrawl (Scraping)', estimatedCalls: firecrawlCalls, cost: firecrawlCalls * COST_PER_PHASE.firecrawl },
    { provider: 'Hunter (Verification)', estimatedCalls: hunterCalls, cost: hunterCalls * COST_PER_PHASE.hunter },
  ];
  
  const totalCost = breakdown.reduce((sum, b) => sum + b.cost, 0);
  
  return {
    totalCost,
    perLeadCost: leadCount > 0 ? totalCost / leadCount : 0,
    breakdown,
  };
}

export function calculateEnrichmentCost(
  accountCount: number,
  phases: Array<'pdl' | 'clearbit' | 'launch_pulse' | 'deep_research'>
): EnrichmentCost {
  const breakdown = phases.map(phase => ({
    phase,
    cost: COST_PER_PHASE[phase] * accountCount,
    accountCount
  }));

  const totalCost = breakdown.reduce((sum, item) => sum + item.cost, 0);
  const estimatedCredits = Math.ceil(totalCost / 0.01); // Assuming 1 credit = $0.01

  return {
    totalCost,
    breakdown,
    estimatedCredits
  };
}

export function formatCost(cost: number): string {
  if (cost < 1) return `${Math.round(cost * 100)}¢`;
  return `$${cost.toFixed(2)}`;
}

export function estimatePhaseDistribution(totalAccounts: number) {
  // Based on typical enrichment patterns:
  // PDL enriches ~40% of accounts
  // Clearbit enriches ~30% of remaining accounts
  // Launch Pulse enriches ~80% of remaining accounts
  // Deep research for remaining high-value accounts
  
  const pdlEnriched = Math.round(totalAccounts * 0.4);
  const remainingAfterPDL = totalAccounts - pdlEnriched;
  
  const clearbitEnriched = Math.round(remainingAfterPDL * 0.3);
  const remainingAfterClearbit = remainingAfterPDL - clearbitEnriched;
  
  const launchPulseEnriched = Math.round(remainingAfterClearbit * 0.8);
  const deepResearchCandidates = remainingAfterClearbit - launchPulseEnriched;

  return {
    pdl: pdlEnriched,
    clearbit: clearbitEnriched,
    launch_pulse: launchPulseEnriched,
    deep_research: deepResearchCandidates
  };
}

export function calculateHybridCost(
  totalAccounts: number,
  deepResearchThreshold: number = 80, // ICP score threshold
  maxDeepResearch: number = 50 // Max deep research per job
): EnrichmentCost {
  const distribution = estimatePhaseDistribution(totalAccounts);
  
  // Limit deep research to high-value accounts
  const deepResearchCount = Math.min(distribution.deep_research, maxDeepResearch);
  
  const breakdown = [
    { phase: 'PDL', cost: distribution.pdl * COST_PER_PHASE.pdl, accountCount: distribution.pdl },
    { phase: 'Clearbit', cost: distribution.clearbit * COST_PER_PHASE.clearbit, accountCount: distribution.clearbit },
    { phase: 'Launch Pulse', cost: distribution.launch_pulse * COST_PER_PHASE.launch_pulse, accountCount: distribution.launch_pulse },
    { phase: 'Deep Research', cost: deepResearchCount * COST_PER_PHASE.deep_research, accountCount: deepResearchCount }
  ];

  const totalCost = breakdown.reduce((sum, item) => sum + item.cost, 0);
  const estimatedCredits = Math.ceil(totalCost / 0.01);

  return {
    totalCost,
    breakdown,
    estimatedCredits
  };
}

export function shouldTriggerDeepResearch(
  account: {
    propensity_score?: number;
    deep_research_requested?: boolean;
    enrichment_confidence?: number;
  }
): boolean {
  // Trigger deep research if:
  // 1. Explicitly requested
  if (account.deep_research_requested) return true;
  
  // 2. High propensity score but low confidence
  if (account.propensity_score && account.propensity_score >= 80) {
    if (!account.enrichment_confidence || account.enrichment_confidence < 0.7) {
      return true;
    }
  }
  
  return false;
}
