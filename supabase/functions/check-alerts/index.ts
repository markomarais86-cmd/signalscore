import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlertCheck {
  alertId: string;
  triggered: boolean;
  currentValue: number;
  thresholdValue: number;
  alertType: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orgId } = await req.json();

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'orgId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[check-alerts] Checking alerts for org ${orgId}`);

    // Fetch active alerts for the org
    const { data: alerts, error: alertsError } = await supabase
      .from('alerts')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_active', true);

    if (alertsError) {
      throw new Error(`Failed to fetch alerts: ${alertsError.message}`);
    }

    if (!alerts || alerts.length === 0) {
      return new Response(
        JSON.stringify({ checked: 0, triggered: 0, results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current metrics for comparison
    const metrics = await getCurrentMetrics(supabase, orgId);
    const results: AlertCheck[] = [];

    for (const alert of alerts) {
      const check = evaluateAlert(alert, metrics);
      results.push(check);

      // If triggered, send notification
      if (check.triggered) {
        console.log(`[check-alerts] Alert triggered: ${alert.name} (${alert.alert_type})`);
        
        // Call send-alert function
        await fetch(`${supabaseUrl}/functions/v1/send-alert`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            alertId: alert.id,
            orgId,
            payload: {
              alertId: alert.id,
              alertType: alert.alert_type,
              alertName: alert.name,
              triggerValue: check.currentValue,
              thresholdValue: check.thresholdValue,
              message: generateAlertMessage(alert, check),
              contextData: { metrics },
            },
          }),
        });
      }
    }

    const triggeredCount = results.filter(r => r.triggered).length;
    console.log(`[check-alerts] Checked ${results.length} alerts, ${triggeredCount} triggered`);

    return new Response(
      JSON.stringify({
        checked: results.length,
        triggered: triggeredCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-alerts] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function getCurrentMetrics(supabase: any, orgId: string) {
  // Fetch deals for metric calculations
  const { data: deals } = await supabase
    .from('deals')
    .select('*')
    .eq('org_id', orgId);

  const allDeals = deals || [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Current period (last 7 days)
  const currentWon = allDeals.filter((d: any) => 
    d.status === 'won' && 
    d.closed_date && 
    new Date(d.closed_date) >= sevenDaysAgo
  );
  const currentLost = allDeals.filter((d: any) => 
    d.status === 'lost' && 
    d.closed_date && 
    new Date(d.closed_date) >= sevenDaysAgo
  );
  const currentClosed = currentWon.length + currentLost.length;
  const currentWinRate = currentClosed > 0 ? (currentWon.length / currentClosed) * 100 : 0;

  // Previous period (7-14 days ago)
  const prevWon = allDeals.filter((d: any) => 
    d.status === 'won' && 
    d.closed_date && 
    new Date(d.closed_date) >= fourteenDaysAgo &&
    new Date(d.closed_date) < sevenDaysAgo
  );
  const prevLost = allDeals.filter((d: any) => 
    d.status === 'lost' && 
    d.closed_date && 
    new Date(d.closed_date) >= fourteenDaysAgo &&
    new Date(d.closed_date) < sevenDaysAgo
  );
  const prevClosed = prevWon.length + prevLost.length;
  const prevWinRate = prevClosed > 0 ? (prevWon.length / prevClosed) * 100 : 0;

  // Open deals
  const openDeals = allDeals.filter((d: any) => d.status === 'open');
  const pipelineValue = openDeals.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);

  // Slippage
  const overdueDeals = openDeals.filter((d: any) => 
    d.expected_close_date && new Date(d.expected_close_date) < now
  );
  const slippageRate = openDeals.length > 0 ? (overdueDeals.length / openDeals.length) * 100 : 0;

  // Sales velocity
  const salesCycles = currentWon
    .filter((d: any) => d.created_at && d.closed_date)
    .map((d: any) => {
      const created = new Date(d.created_at);
      const closed = new Date(d.closed_date);
      return (closed.getTime() - created.getTime()) / (24 * 60 * 60 * 1000);
    });
  const avgCycle = salesCycles.length > 0 
    ? salesCycles.reduce((a: number, b: number) => a + b, 0) / salesCycles.length 
    : 30;
  const velocity = avgCycle > 0 ? (pipelineValue * (currentWinRate / 100)) / avgCycle : 0;

  // Previous velocity
  const prevSalesCycles = prevWon
    .filter((d: any) => d.created_at && d.closed_date)
    .map((d: any) => {
      const created = new Date(d.created_at);
      const closed = new Date(d.closed_date);
      return (closed.getTime() - created.getTime()) / (24 * 60 * 60 * 1000);
    });
  const prevAvgCycle = prevSalesCycles.length > 0 
    ? prevSalesCycles.reduce((a: number, b: number) => a + b, 0) / prevSalesCycles.length 
    : avgCycle;
  const prevVelocity = prevAvgCycle > 0 ? (pipelineValue * (prevWinRate / 100)) / prevAvgCycle : 0;

  return {
    currentWinRate,
    prevWinRate,
    winRateChange: currentWinRate - prevWinRate,
    velocity,
    prevVelocity,
    velocityChange: prevVelocity > 0 ? ((velocity - prevVelocity) / prevVelocity) * 100 : 0,
    pipelineValue,
    slippageRate,
    openDealsCount: openDeals.length,
    overdueDealsCount: overdueDeals.length,
  };
}

function evaluateAlert(alert: any, metrics: any): AlertCheck {
  let currentValue = 0;
  const thresholdValue = alert.threshold_value || 0;
  const operator = alert.threshold_operator || 'lt';

  // Get the metric value based on alert type
  switch (alert.alert_type) {
    case 'velocity_drop':
      currentValue = metrics.velocityChange;
      break;
    case 'win_rate_decline':
      currentValue = metrics.winRateChange;
      break;
    case 'slippage_increase':
      currentValue = metrics.slippageRate;
      break;
    case 'pipeline_threshold':
      currentValue = metrics.pipelineValue;
      break;
    case 'deal_at_risk':
      currentValue = metrics.overdueDealsCount;
      break;
    default:
      currentValue = 0;
  }

  // Evaluate the condition
  let triggered = false;
  switch (operator) {
    case 'lt':
      triggered = currentValue < thresholdValue;
      break;
    case 'lte':
      triggered = currentValue <= thresholdValue;
      break;
    case 'gt':
      triggered = currentValue > thresholdValue;
      break;
    case 'gte':
      triggered = currentValue >= thresholdValue;
      break;
    case 'eq':
      triggered = currentValue === thresholdValue;
      break;
  }

  return {
    alertId: alert.id,
    triggered,
    currentValue,
    thresholdValue,
    alertType: alert.alert_type,
  };
}

function generateAlertMessage(alert: any, check: AlertCheck): string {
  const typeMessages: Record<string, string> = {
    velocity_drop: `Sales velocity has changed by ${check.currentValue.toFixed(1)}% (threshold: ${check.thresholdValue}%)`,
    win_rate_decline: `Win rate has changed by ${check.currentValue.toFixed(1)}% (threshold: ${check.thresholdValue}%)`,
    slippage_increase: `Pipeline slippage is at ${check.currentValue.toFixed(1)}% (threshold: ${check.thresholdValue}%)`,
    pipeline_threshold: `Pipeline value is $${check.currentValue.toLocaleString()} (threshold: $${check.thresholdValue.toLocaleString()})`,
    deal_at_risk: `${check.currentValue} deals are at risk (threshold: ${check.thresholdValue})`,
  };

  return typeMessages[alert.alert_type] || `Alert triggered: ${alert.name}`;
}
