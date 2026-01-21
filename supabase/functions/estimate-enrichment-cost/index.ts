import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";
import { getCorsHeaders } from '../_shared/cors.ts';

// Updated cost per provider reflecting the 7-step waterfall from provider-waterfall.ts
const COST_PER_PROVIDER = {
  email_name: 0.0,        // Free - extract name from email
  perplexity: 0.005,      // $0.005 per Perplexity search (primary AI discovery)
  firecrawl: 0.003,       // $0.003 per page scraped (ground truth)
  claude: 0.008,          // $0.008 per Claude/AI fill-gaps call
  google_search: 0.002,   // $0.002 per Google search via Firecrawl
  pdl: 0.01,              // $0.01 per PDL lookup (fallback)
  apollo: 0.015,          // $0.015 per Apollo lookup (last resort)
  hunter: 0.005,          // $0.005 per Hunter email verification
  deep_research: 0.10,    // $0.10 per deep research (premium)
};

// Typical success rates for each provider in the waterfall
const SUCCESS_RATES = {
  email_name: 0.70,       // 70% of emails have parseable names
  perplexity: 0.60,       // Perplexity finds data for ~60%
  firecrawl: 0.75,        // Website scraping succeeds ~75%
  claude: 0.80,           // Claude fills gaps for ~80%
  google_search: 0.50,    // Google search fallback ~50%
  pdl: 0.40,              // PDL enriches ~40%
  apollo: 0.35,           // Apollo enriches ~35%
  hunter: 0.90,           // Hunter verifies ~90% of emails
  deep_research: 1.0,     // Deep research always provides data
};

interface CostBreakdown {
  provider: string;
  accountCount: number;
  costPerAccount: number;
  totalCost: number;
  estimatedSuccessRate: number;
}

interface EnrichmentCostEstimate {
  totalAccounts: number;
  totalCost: number;
  breakdown: CostBreakdown[];
  estimatedCredits: number;
  estimatedDuration: string;
  warnings: string[];
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      accountCount, 
      providers = ['pdl', 'clearbit', 'ai'],
      deepResearchCount = 0,
      orgId 
    } = await req.json();

    if (!accountCount || accountCount < 1) {
      return new Response(
        JSON.stringify({ error: 'accountCount is required and must be positive' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const warnings: string[] = [];
    const breakdown: CostBreakdown[] = [];
    let remainingAccounts = accountCount;

    // Calculate waterfall enrichment costs
    for (const provider of providers) {
      if (remainingAccounts <= 0) break;
      
      const cost = COST_PER_PROVIDER[provider as keyof typeof COST_PER_PROVIDER];
      const successRate = SUCCESS_RATES[provider as keyof typeof SUCCESS_RATES];
      
      if (!cost || !successRate) {
        warnings.push(`Unknown provider: ${provider}`);
        continue;
      }

      const accountsToProcess = remainingAccounts;
      const expectedSuccess = Math.round(accountsToProcess * successRate);
      
      breakdown.push({
        provider,
        accountCount: accountsToProcess,
        costPerAccount: cost,
        totalCost: accountsToProcess * cost,
        estimatedSuccessRate: successRate * 100,
      });

      // Remaining accounts for next provider
      remainingAccounts = accountsToProcess - expectedSuccess;
    }

    // Add deep research cost if requested
    if (deepResearchCount > 0) {
      const deepCost = COST_PER_PROVIDER.deep_research;
      breakdown.push({
        provider: 'deep_research',
        accountCount: deepResearchCount,
        costPerAccount: deepCost,
        totalCost: deepResearchCount * deepCost,
        estimatedSuccessRate: 100,
      });
    }

    const totalCost = breakdown.reduce((sum, item) => sum + item.totalCost, 0);
    const estimatedCredits = Math.ceil(totalCost / 0.01); // 1 credit = $0.01

    // Estimate duration based on rate limits
    const totalCalls = breakdown.reduce((sum, item) => sum + item.accountCount, 0);
    const estimatedMinutes = Math.ceil(totalCalls / 10); // ~10 requests/second
    const estimatedDuration = estimatedMinutes < 60 
      ? `~${estimatedMinutes} minutes`
      : `~${(estimatedMinutes / 60).toFixed(1)} hours`;

    // Check plan limits if orgId provided
    if (orgId) {
      const { data: limitCheck } = await supabase.rpc('check_plan_limit', {
        p_org_id: orgId,
        p_limit_type: 'enrichment_credits',
        p_requested_amount: estimatedCredits
      });

      if (limitCheck && !limitCheck.allowed) {
        warnings.push(`Plan limit exceeded: ${limitCheck.remaining} credits remaining, ${estimatedCredits} required`);
      }
    }

    // Add warnings for expensive operations
    if (totalCost > 50) {
      warnings.push('This enrichment will cost more than $50. Consider reducing scope.');
    }
    if (deepResearchCount > 100) {
      warnings.push('Deep research for 100+ accounts is expensive. Consider prioritizing high-value accounts.');
    }

    const estimate: EnrichmentCostEstimate = {
      totalAccounts: accountCount,
      totalCost: Math.round(totalCost * 100) / 100,
      breakdown,
      estimatedCredits,
      estimatedDuration,
      warnings,
    };

    console.log(`[estimate-enrichment-cost] ${accountCount} accounts: $${totalCost.toFixed(2)}, ${estimatedCredits} credits`);

    return new Response(
      JSON.stringify(estimate),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[estimate-enrichment-cost] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
