import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StageMetrics {
  stage: string;
  count: number;
  value: number;
  conversionRate: number;
  avgDurationHours: number;
  avgDurationDays: number;
}

interface DealAtRisk {
  id: string;
  name: string;
  amount: number;
  stage: string;
  daysInStage: number;
  daysOverdue: number;
  expectedCloseDate: string | null;
  accountName: string | null;
}

interface LossReasonBreakdown {
  reason: string;
  count: number;
  value: number;
  percentage: number;
}

interface PipelineMetrics {
  // Core metrics
  totalPipelineValue: number;
  totalOpenDeals: number;
  avgDealSize: number;
  
  // Win/Loss metrics
  wonDealsCount: number;
  wonDealsValue: number;
  lostDealsCount: number;
  lostDealsValue: number;
  winRate: number;
  
  // Velocity metrics
  avgSalesCycleDays: number;
  salesVelocity: number; // (Pipeline Value × Win Rate) / Sales Cycle Length
  
  // Slippage metrics
  slippageRate: number; // % of deals past expected close date
  dealsAtRisk: DealAtRisk[];
  
  // Stage breakdown
  stages: StageMetrics[];
  
  // Loss reasons
  lossReasons: LossReasonBreakdown[];
  
  // Trends (vs previous period)
  pipelineGrowthRate: number;
  winRateChange: number;
  velocityChange: number;
  
  // Period info
  periodStart: string;
  periodEnd: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orgId, startDate, endDate, stages: stageFilter } = await req.json();

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'orgId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[pipeline-metrics] Computing metrics for org: ${orgId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Set date range (default: last 90 days)
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

    // Previous period for comparison
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

    // Fetch all deals for the org
    const { data: allDeals, error: dealsError } = await supabase
      .from('deals')
      .select('*')
      .eq('org_id', orgId);

    if (dealsError) {
      console.error('[pipeline-metrics] Error fetching deals:', dealsError);
      throw new Error(dealsError.message);
    }

    const deals = allDeals || [];
    
    // Fetch stage history for duration calculations
    const { data: stageHistory, error: historyError } = await supabase
      .from('deal_stage_history')
      .select('*')
      .eq('org_id', orgId);

    if (historyError) {
      console.error('[pipeline-metrics] Error fetching stage history:', historyError);
    }

    const history = stageHistory || [];

    // Calculate current period metrics
    const openDeals = deals.filter(d => d.status === 'open');
    const wonDeals = deals.filter(d => 
      d.status === 'won' && 
      d.closed_date && 
      new Date(d.closed_date) >= start && 
      new Date(d.closed_date) <= end
    );
    const lostDeals = deals.filter(d => 
      d.status === 'lost' && 
      d.closed_date && 
      new Date(d.closed_date) >= start && 
      new Date(d.closed_date) <= end
    );

    // Core metrics
    const totalPipelineValue = openDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const totalOpenDeals = openDeals.length;
    const avgDealSize = totalOpenDeals > 0 ? totalPipelineValue / totalOpenDeals : 0;

    // Win/Loss metrics
    const wonDealsCount = wonDeals.length;
    const wonDealsValue = wonDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const lostDealsCount = lostDeals.length;
    const lostDealsValue = lostDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const closedDealsCount = wonDealsCount + lostDealsCount;
    const winRate = closedDealsCount > 0 ? (wonDealsCount / closedDealsCount) * 100 : 0;

    // Sales cycle calculation (average days from creation to close for won deals)
    const salesCycles = wonDeals
      .filter(d => d.created_at && d.closed_date)
      .map(d => {
        const created = new Date(d.created_at);
        const closed = new Date(d.closed_date);
        return (closed.getTime() - created.getTime()) / (24 * 60 * 60 * 1000);
      });
    const avgSalesCycleDays = salesCycles.length > 0 
      ? salesCycles.reduce((a, b) => a + b, 0) / salesCycles.length 
      : 30; // Default to 30 days if no data

    // Sales Velocity = (Pipeline Value × Win Rate) / Sales Cycle Length
    const salesVelocity = avgSalesCycleDays > 0 
      ? (totalPipelineValue * (winRate / 100)) / avgSalesCycleDays 
      : 0;

    // Slippage metrics
    const today = new Date();
    const overdueDeals = openDeals.filter(d => 
      d.expected_close_date && new Date(d.expected_close_date) < today
    );
    const slippageRate = totalOpenDeals > 0 
      ? (overdueDeals.length / totalOpenDeals) * 100 
      : 0;

    // Stage breakdown with conversion rates
    const stageOrder = ['discovery', 'qualification', 'demo', 'proposal', 'negotiation', 'closing'];
    const stageCounts: Record<string, { count: number; value: number; durations: number[] }> = {};
    
    // Initialize stages
    stageOrder.forEach(s => {
      stageCounts[s] = { count: 0, value: 0, durations: [] };
    });

    // Count open deals by stage
    openDeals.forEach(d => {
      const stage = d.stage?.toLowerCase() || 'unknown';
      if (!stageCounts[stage]) {
        stageCounts[stage] = { count: 0, value: 0, durations: [] };
      }
      stageCounts[stage].count++;
      stageCounts[stage].value += Number(d.amount) || 0;
    });

    // Calculate stage durations from history
    history.forEach(h => {
      const stage = h.stage?.toLowerCase();
      if (stageCounts[stage]) {
        const entered = new Date(h.entered_at);
        const exited = h.exited_at ? new Date(h.exited_at) : new Date();
        const durationHours = (exited.getTime() - entered.getTime()) / (1000 * 60 * 60);
        stageCounts[stage].durations.push(durationHours);
      }
    });

    // Build stage metrics with conversion rates
    const stageMetrics: StageMetrics[] = stageOrder.map((stage, idx) => {
      const data = stageCounts[stage] || { count: 0, value: 0, durations: [] };
      const prevStageCount = idx > 0 ? (stageCounts[stageOrder[idx - 1]]?.count || 0) : data.count;
      const conversionRate = prevStageCount > 0 ? (data.count / prevStageCount) * 100 : (idx === 0 ? 100 : 0);
      const avgDurationHours = data.durations.length > 0 
        ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length 
        : 0;

      return {
        stage,
        count: data.count,
        value: data.value,
        conversionRate: idx === 0 ? 100 : conversionRate,
        avgDurationHours,
        avgDurationDays: avgDurationHours / 24,
      };
    });

    // Deals at risk (overdue or long time in stage)
    const avgStageDuration = stageMetrics.reduce((sum, s) => sum + s.avgDurationHours, 0) / stageMetrics.length || 168; // Default 1 week
    
    const dealsAtRisk: DealAtRisk[] = openDeals
      .map(d => {
        // Calculate days in current stage
        const stageEntry = history.find(h => h.deal_id === d.id && !h.exited_at);
        const daysInStage = stageEntry 
          ? (today.getTime() - new Date(stageEntry.entered_at).getTime()) / (24 * 60 * 60 * 1000)
          : 0;
        
        // Calculate days overdue
        const daysOverdue = d.expected_close_date 
          ? Math.max(0, (today.getTime() - new Date(d.expected_close_date).getTime()) / (24 * 60 * 60 * 1000))
          : 0;

        return {
          id: d.id,
          name: d.name,
          amount: Number(d.amount) || 0,
          stage: d.stage,
          daysInStage: Math.round(daysInStage),
          daysOverdue: Math.round(daysOverdue),
          expectedCloseDate: d.expected_close_date,
          accountName: null, // Would join with accounts if needed
          isAtRisk: daysOverdue > 0 || daysInStage > (avgStageDuration / 24) * 1.5,
        };
      })
      .filter(d => d.isAtRisk)
      .sort((a, b) => b.daysOverdue - a.daysOverdue || b.amount - a.amount)
      .slice(0, 10)
      .map(({ isAtRisk, ...rest }) => rest);

    // Loss reasons breakdown
    const lossReasonCounts: Record<string, { count: number; value: number }> = {};
    lostDeals.forEach(d => {
      const reason = d.loss_reason || 'Unknown';
      if (!lossReasonCounts[reason]) {
        lossReasonCounts[reason] = { count: 0, value: 0 };
      }
      lossReasonCounts[reason].count++;
      lossReasonCounts[reason].value += Number(d.amount) || 0;
    });

    const lossReasons: LossReasonBreakdown[] = Object.entries(lossReasonCounts)
      .map(([reason, data]) => ({
        reason,
        count: data.count,
        value: data.value,
        percentage: lostDealsCount > 0 ? (data.count / lostDealsCount) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Previous period metrics for comparison
    const prevWonDeals = deals.filter(d => 
      d.status === 'won' && 
      d.closed_date && 
      new Date(d.closed_date) >= prevStart && 
      new Date(d.closed_date) <= prevEnd
    );
    const prevLostDeals = deals.filter(d => 
      d.status === 'lost' && 
      d.closed_date && 
      new Date(d.closed_date) >= prevStart && 
      new Date(d.closed_date) <= prevEnd
    );
    const prevClosedCount = prevWonDeals.length + prevLostDeals.length;
    const prevWinRate = prevClosedCount > 0 ? (prevWonDeals.length / prevClosedCount) * 100 : 0;
    
    const prevOpenDeals = deals.filter(d => 
      d.status === 'open' && 
      new Date(d.created_at) <= prevEnd
    );
    const prevPipelineValue = prevOpenDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    
    const pipelineGrowthRate = prevPipelineValue > 0 
      ? ((totalPipelineValue - prevPipelineValue) / prevPipelineValue) * 100 
      : 0;
    const winRateChange = winRate - prevWinRate;

    // Previous velocity
    const prevSalesCycles = prevWonDeals
      .filter(d => d.created_at && d.closed_date)
      .map(d => {
        const created = new Date(d.created_at);
        const closed = new Date(d.closed_date);
        return (closed.getTime() - created.getTime()) / (24 * 60 * 60 * 1000);
      });
    const prevAvgCycle = prevSalesCycles.length > 0 
      ? prevSalesCycles.reduce((a, b) => a + b, 0) / prevSalesCycles.length 
      : avgSalesCycleDays;
    const prevVelocity = prevAvgCycle > 0 
      ? (prevPipelineValue * (prevWinRate / 100)) / prevAvgCycle 
      : 0;
    const velocityChange = prevVelocity > 0 
      ? ((salesVelocity - prevVelocity) / prevVelocity) * 100 
      : 0;

    const metrics: PipelineMetrics = {
      totalPipelineValue,
      totalOpenDeals,
      avgDealSize,
      wonDealsCount,
      wonDealsValue,
      lostDealsCount,
      lostDealsValue,
      winRate,
      avgSalesCycleDays,
      salesVelocity,
      slippageRate,
      dealsAtRisk,
      stages: stageMetrics,
      lossReasons,
      pipelineGrowthRate,
      winRateChange,
      velocityChange,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    };

    console.log(`[pipeline-metrics] Computed: ${totalOpenDeals} open deals, $${totalPipelineValue.toLocaleString()} pipeline, ${winRate.toFixed(1)}% win rate, $${salesVelocity.toFixed(0)}/day velocity`);

    return new Response(
      JSON.stringify(metrics),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[pipeline-metrics] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
