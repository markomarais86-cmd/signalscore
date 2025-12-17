import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PredictionRequest {
  org_id: string;
  account_ids?: string[];
  prediction_type?: 'conversion' | 'churn' | 'deal_size' | 'time_to_close';
}

interface ConversionPrediction {
  account_id: string;
  probability: number;
  confidence: number;
  factors: PredictionFactor[];
  predicted_value?: number;
  predicted_days_to_close?: number;
}

interface PredictionFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { org_id, account_ids, prediction_type = 'conversion' }: PredictionRequest = await req.json();

    if (!org_id) {
      return new Response(JSON.stringify({ error: 'org_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Prediction] Starting ${prediction_type} predictions for org ${org_id}`);

    // Fetch historical data for training
    const { data: historicalDeals, error: dealsError } = await supabase
      .from('closed_won_deals')
      .select('account_external_id, deal_value, sales_cycle_days, close_date')
      .eq('org_id', org_id)
      .order('close_date', { ascending: false })
      .limit(500);

    if (dealsError) {
      console.error('[Prediction] Error fetching historical deals:', dealsError);
    }

    // Calculate baseline metrics from historical data
    const avgDealValue = historicalDeals?.length
      ? historicalDeals.reduce((sum, d) => sum + (d.deal_value || 0), 0) / historicalDeals.length
      : 50000;
    
    const avgSalesCycle = historicalDeals?.length
      ? historicalDeals.filter(d => d.sales_cycle_days).reduce((sum, d) => sum + d.sales_cycle_days!, 0) / 
        historicalDeals.filter(d => d.sales_cycle_days).length
      : 45;

    // Build account query
    let accountQuery = supabase
      .from('accounts')
      .select(`
        external_id,
        name,
        domain,
        employee_count,
        revenue_range,
        industry_norm,
        country,
        icp_qualified,
        enrichment_confidence,
        enrichment_overall_score,
        propensity_score
      `)
      .eq('org_id', org_id);

    if (account_ids && account_ids.length > 0) {
      accountQuery = accountQuery.in('external_id', account_ids);
    } else {
      accountQuery = accountQuery.limit(100);
    }

    const { data: accounts, error: accountsError } = await accountQuery;

    if (accountsError) {
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
    }

    // Fetch scores for these accounts
    const accountExternalIds = accounts?.map(a => a.external_id) || [];
    const { data: scores } = await supabase
      .from('scores')
      .select('account_external_id, overall, fit, intent, reachability')
      .eq('org_id', org_id)
      .in('account_external_id', accountExternalIds);

    const scoreMap = new Map(scores?.map(s => [s.account_external_id, s]));

    // Fetch pipeline stages for velocity calculation
    const { data: pipelineStages } = await supabase
      .from('pipeline_stages')
      .select('account_external_id, stage, entered_at, exited_at, duration_hours')
      .in('account_external_id', accountExternalIds)
      .order('entered_at', { ascending: true });

    const pipelineMap = new Map<string, typeof pipelineStages>();
    pipelineStages?.forEach(stage => {
      const existing = pipelineMap.get(stage.account_external_id) || [];
      existing.push(stage);
      pipelineMap.set(stage.account_external_id, existing);
    });

    // Generate predictions
    const predictions: ConversionPrediction[] = [];

    for (const account of accounts || []) {
      const score = scoreMap.get(account.external_id);
      const stages = pipelineMap.get(account.external_id) || [];
      
      const prediction = calculateConversionProbability({
        account,
        score,
        stages,
        avgDealValue,
        avgSalesCycle,
        historicalDeals: historicalDeals || [],
      });

      predictions.push(prediction);
    }

    // Sort by probability descending
    predictions.sort((a, b) => b.probability - a.probability);

    console.log(`[Prediction] Generated ${predictions.length} predictions`);

    return new Response(JSON.stringify({
      success: true,
      prediction_type,
      predictions,
      metadata: {
        total_accounts: predictions.length,
        avg_probability: predictions.reduce((sum, p) => sum + p.probability, 0) / predictions.length,
        high_probability_count: predictions.filter(p => p.probability >= 0.7).length,
        baseline_deal_value: avgDealValue,
        baseline_sales_cycle: avgSalesCycle,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Prediction] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

interface PredictionInput {
  account: {
    external_id: string;
    name: string | null;
    employee_count: number | null;
    revenue_range: string | null;
    industry_norm: string | null;
    country: string | null;
    icp_qualified: boolean | null;
    enrichment_confidence: number | null;
    enrichment_overall_score: number | null;
    propensity_score: number | null;
  };
  score: {
    overall: number | null;
    fit: number | null;
    intent: number | null;
    reachability: number | null;
  } | undefined;
  stages: {
    stage: string;
    entered_at: string;
    exited_at: string | null;
    duration_hours: number | null;
  }[];
  avgDealValue: number;
  avgSalesCycle: number;
  historicalDeals: { account_external_id: string; deal_value: number }[];
}

function calculateConversionProbability(input: PredictionInput): ConversionPrediction {
  const { account, score, stages, avgDealValue, avgSalesCycle, historicalDeals } = input;
  const factors: PredictionFactor[] = [];
  let baseScore = 0.3; // Base probability

  // Factor 1: ICP Score (0-40 points)
  if (score?.overall) {
    const icpImpact = (score.overall / 100) * 0.4;
    baseScore += icpImpact;
    factors.push({
      name: 'ICP Fit Score',
      impact: score.overall >= 70 ? 'positive' : score.overall >= 50 ? 'neutral' : 'negative',
      weight: icpImpact,
      description: `ICP score of ${score.overall}/100 ${score.overall >= 70 ? 'indicates strong fit' : 'suggests moderate alignment'}`,
    });
  }

  // Factor 2: ICP Qualified (0-10 points)
  if (account.icp_qualified === true) {
    baseScore += 0.1;
    factors.push({
      name: 'ICP Qualified',
      impact: 'positive',
      weight: 0.1,
      description: 'Account meets ICP qualification criteria',
    });
  } else if (account.icp_qualified === false) {
    baseScore -= 0.05;
    factors.push({
      name: 'Not ICP Qualified',
      impact: 'negative',
      weight: -0.05,
      description: 'Account does not meet ICP qualification criteria',
    });
  }

  // Factor 3: Pipeline Velocity (0-15 points)
  if (stages.length > 0) {
    const recentStage = stages[stages.length - 1];
    const stageWeights: Record<string, number> = {
      'lead': 0.02,
      'qualified': 0.05,
      'meeting': 0.08,
      'proposal': 0.12,
      'negotiation': 0.15,
    };
    
    const velocityBonus = stageWeights[recentStage.stage] || 0;
    baseScore += velocityBonus;
    
    factors.push({
      name: 'Pipeline Stage',
      impact: velocityBonus >= 0.1 ? 'positive' : velocityBonus >= 0.05 ? 'neutral' : 'negative',
      weight: velocityBonus,
      description: `Currently in ${recentStage.stage} stage`,
    });
  }

  // Factor 4: Intent Signal (from score)
  if (score?.intent) {
    const intentImpact = (score.intent / 100) * 0.1;
    baseScore += intentImpact;
    factors.push({
      name: 'Intent Signal',
      impact: score.intent >= 70 ? 'positive' : 'neutral',
      weight: intentImpact,
      description: `Intent score of ${score.intent}/100`,
    });
  }

  // Factor 5: Enrichment Quality
  if (account.enrichment_confidence && account.enrichment_confidence > 0.7) {
    baseScore += 0.05;
    factors.push({
      name: 'Data Quality',
      impact: 'positive',
      weight: 0.05,
      description: 'High confidence enrichment data available',
    });
  }

  // Factor 6: Company Size (employee count)
  if (account.employee_count) {
    let sizeImpact = 0;
    if (account.employee_count >= 100 && account.employee_count <= 5000) {
      sizeImpact = 0.05;
      factors.push({
        name: 'Company Size',
        impact: 'positive',
        weight: sizeImpact,
        description: `${account.employee_count} employees - ideal mid-market size`,
      });
    } else if (account.employee_count > 5000) {
      sizeImpact = 0.03;
      factors.push({
        name: 'Company Size',
        impact: 'neutral',
        weight: sizeImpact,
        description: `Enterprise account (${account.employee_count} employees) - longer sales cycle`,
      });
    }
    baseScore += sizeImpact;
  }

  // Calculate confidence based on data availability
  let confidence = 0.5;
  if (score) confidence += 0.2;
  if (stages.length > 0) confidence += 0.15;
  if (account.employee_count) confidence += 0.05;
  if (account.revenue_range) confidence += 0.05;
  if (account.enrichment_confidence) confidence += 0.05;

  // Clamp probability between 0.05 and 0.95
  const probability = Math.min(0.95, Math.max(0.05, baseScore));

  // Estimate deal value based on company size
  let predictedValue = avgDealValue;
  if (account.employee_count) {
    if (account.employee_count > 1000) predictedValue *= 1.5;
    else if (account.employee_count > 500) predictedValue *= 1.2;
    else if (account.employee_count < 100) predictedValue *= 0.7;
  }

  // Estimate days to close
  let predictedDays = avgSalesCycle;
  if (stages.length > 0) {
    const stageIndex = ['lead', 'qualified', 'meeting', 'proposal', 'negotiation'].indexOf(
      stages[stages.length - 1].stage
    );
    if (stageIndex >= 0) {
      predictedDays = Math.round(avgSalesCycle * (1 - stageIndex * 0.15));
    }
  }

  return {
    account_id: account.external_id,
    probability: Math.round(probability * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    factors,
    predicted_value: Math.round(predictedValue),
    predicted_days_to_close: Math.max(7, predictedDays),
  };
}
