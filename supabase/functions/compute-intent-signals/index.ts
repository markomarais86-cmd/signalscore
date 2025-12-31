import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IntentSignal {
  type: 'engagement_velocity' | 'multi_thread' | 'score_change' | 'coverage_gap';
  priority: 'critical' | 'high' | 'medium' | 'low';
  account_external_id: string;
  account_name: string | null;
  title: string;
  description: string;
  metadata: Record<string, any>;
  score?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[IntentSignals] Starting intent signal computation');

  try {
    const { org_id } = await req.json();

    if (!org_id) {
      return new Response(JSON.stringify({ error: 'org_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const signals: IntentSignal[] = [];

    // 1. ENGAGEMENT VELOCITY - Accounts with increasing activity
    console.log('[IntentSignals] Computing engagement velocity signals...');
    const velocitySignals = await computeEngagementVelocity(supabase, org_id);
    signals.push(...velocitySignals);

    // 2. MULTI-THREADING OPPORTUNITIES - Single-threaded high-fit accounts
    console.log('[IntentSignals] Computing multi-threading opportunities...');
    const multiThreadSignals = await computeMultiThreadingOpportunities(supabase, org_id);
    signals.push(...multiThreadSignals);

    // 3. SCORE CHANGE ALERTS - Significant ICP score changes
    console.log('[IntentSignals] Computing score change alerts...');
    const scoreChangeSignals = await computeScoreChangeAlerts(supabase, org_id);
    signals.push(...scoreChangeSignals);

    // 4. COVERAGE GAPS - High-fit accounts with no recent activity
    console.log('[IntentSignals] Computing coverage gap signals...');
    const coverageGapSignals = await computeCoverageGaps(supabase, org_id);
    signals.push(...coverageGapSignals);

    // Store signals in account_signals table
    console.log(`[IntentSignals] Storing ${signals.length} signals...`);
    
    // Clear old intent signals (older than 7 days) for this org
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('account_signals')
      .delete()
      .eq('org_id', org_id)
      .in('signal_type', ['engagement_velocity', 'multi_thread', 'score_change', 'coverage_gap'])
      .lt('created_at', sevenDaysAgo);

    // Insert new signals
    if (signals.length > 0) {
      const signalRecords = signals.map(s => ({
        org_id,
        account_external_id: s.account_external_id,
        account_name: s.account_name,
        signal_type: s.type,
        signal_priority: s.priority,
        title: s.title,
        description: s.description,
        metadata: s.metadata,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }));

      const { error: insertError } = await supabase
        .from('account_signals')
        .upsert(signalRecords, {
          onConflict: 'org_id,account_external_id,signal_type',
          ignoreDuplicates: false,
        });

      if (insertError) {
        console.error('[IntentSignals] Error inserting signals:', insertError);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[IntentSignals] Completed in ${duration}ms with ${signals.length} signals`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      signals_computed: signals.length,
      breakdown: {
        engagement_velocity: signals.filter(s => s.type === 'engagement_velocity').length,
        multi_thread: signals.filter(s => s.type === 'multi_thread').length,
        score_change: signals.filter(s => s.type === 'score_change').length,
        coverage_gap: signals.filter(s => s.type === 'coverage_gap').length,
      },
      signals,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[IntentSignals] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Compute engagement velocity - accounts with increasing activity patterns
 */
async function computeEngagementVelocity(supabase: any, orgId: string): Promise<IntentSignal[]> {
  const signals: IntentSignal[] = [];
  
  // Get activity counts per account for last 7 days vs previous 7 days
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Recent activities (last 7 days)
  const { data: recentActivities } = await supabase
    .from('activities')
    .select('account_external_id')
    .eq('org_id', orgId)
    .gte('activity_date', sevenDaysAgo.toISOString())
    .not('account_external_id', 'is', null);

  // Previous period activities (7-14 days ago)
  const { data: previousActivities } = await supabase
    .from('activities')
    .select('account_external_id')
    .eq('org_id', orgId)
    .gte('activity_date', fourteenDaysAgo.toISOString())
    .lt('activity_date', sevenDaysAgo.toISOString())
    .not('account_external_id', 'is', null);

  // Count activities per account
  const recentCounts: Record<string, number> = {};
  const previousCounts: Record<string, number> = {};

  (recentActivities || []).forEach((a: any) => {
    recentCounts[a.account_external_id] = (recentCounts[a.account_external_id] || 0) + 1;
  });

  (previousActivities || []).forEach((a: any) => {
    previousCounts[a.account_external_id] = (previousCounts[a.account_external_id] || 0) + 1;
  });

  // Find accounts with significant increase (>50% more activity)
  const acceleratingAccounts: { id: string; recent: number; previous: number; increase: number }[] = [];
  
  for (const accountId of Object.keys(recentCounts)) {
    const recent = recentCounts[accountId];
    const previous = previousCounts[accountId] || 0;
    
    if (recent >= 3 && (previous === 0 || (recent / Math.max(previous, 1)) >= 1.5)) {
      acceleratingAccounts.push({
        id: accountId,
        recent,
        previous,
        increase: previous > 0 ? Math.round(((recent - previous) / previous) * 100) : 100,
      });
    }
  }

  // Get account names for top accelerating accounts
  if (acceleratingAccounts.length > 0) {
    const { data: accounts } = await supabase
      .from('accounts')
      .select('external_id, name')
      .eq('org_id', orgId)
      .in('external_id', acceleratingAccounts.slice(0, 20).map(a => a.id));

    const accountMap = new Map((accounts || []).map((a: any) => [a.external_id, a.name]));

    for (const acc of acceleratingAccounts.slice(0, 10)) {
      const priority = acc.increase >= 200 ? 'high' : acc.increase >= 100 ? 'medium' : 'low';
      
      signals.push({
        type: 'engagement_velocity',
        priority,
        account_external_id: acc.id,
        account_name: accountMap.get(acc.id) || null,
        title: `${acc.increase}% more engagement this week`,
        description: `${acc.recent} activities this week vs ${acc.previous} last week. Momentum is building.`,
        metadata: {
          recent_count: acc.recent,
          previous_count: acc.previous,
          increase_percent: acc.increase,
        },
      });
    }
  }

  return signals;
}

/**
 * Compute multi-threading opportunities - high-fit accounts with single contact engaged
 */
async function computeMultiThreadingOpportunities(supabase: any, orgId: string): Promise<IntentSignal[]> {
  const signals: IntentSignal[] = [];

  // Get high-fit scored accounts
  const { data: highFitAccounts } = await supabase
    .from('scores')
    .select('account_external_id, fit_label')
    .eq('org_id', orgId)
    .eq('fit_label', 'high');

  if (!highFitAccounts || highFitAccounts.length === 0) return signals;

  const highFitIds = highFitAccounts.map((s: any) => s.account_external_id);

  // Get leads per account
  const { data: leads } = await supabase
    .from('Leads')
    .select('account_external_id, id')
    .eq('org_id', orgId)
    .in('account_external_id', highFitIds);

  // Count leads per account
  const leadCounts: Record<string, number> = {};
  (leads || []).forEach((l: any) => {
    if (l.account_external_id) {
      leadCounts[l.account_external_id] = (leadCounts[l.account_external_id] || 0) + 1;
    }
  });

  // Find accounts with only 1 lead (single-threaded)
  const singleThreaded = Object.entries(leadCounts)
    .filter(([_, count]) => count === 1)
    .map(([id]) => id);

  if (singleThreaded.length > 0) {
    // Get account names
    const { data: accounts } = await supabase
      .from('accounts')
      .select('external_id, name, employee_count')
      .eq('org_id', orgId)
      .in('external_id', singleThreaded.slice(0, 20));

    for (const account of (accounts || []).slice(0, 10)) {
      const priority = (account.employee_count || 0) > 500 ? 'high' : 'medium';
      
      signals.push({
        type: 'multi_thread',
        priority,
        account_external_id: account.external_id,
        account_name: account.name,
        title: 'Single-threaded high-fit account',
        description: `Only 1 contact engaged at this ${account.employee_count ? account.employee_count + ' employee' : ''} company. Add more contacts to reduce risk.`,
        metadata: {
          lead_count: 1,
          employee_count: account.employee_count,
          fit_label: 'high',
        },
      });
    }
  }

  return signals;
}

/**
 * Compute score change alerts - significant ICP score changes
 */
async function computeScoreChangeAlerts(supabase: any, orgId: string): Promise<IntentSignal[]> {
  const signals: IntentSignal[] = [];

  // Get recent score history (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: scoreHistory } = await supabase
    .from('score_history')
    .select('account_external_id, old_score, new_score, changed_at')
    .eq('org_id', orgId)
    .gte('changed_at', thirtyDaysAgo)
    .order('changed_at', { ascending: false });

  if (!scoreHistory || scoreHistory.length === 0) return signals;

  // Group by account and find significant changes
  const accountChanges: Record<string, { drop: number; gain: number; latest: any }> = {};

  for (const entry of scoreHistory) {
    const id = entry.account_external_id;
    const change = (entry.new_score || 0) - (entry.old_score || 0);
    
    if (!accountChanges[id]) {
      accountChanges[id] = { drop: 0, gain: 0, latest: entry };
    }
    
    if (change < 0) {
      accountChanges[id].drop += Math.abs(change);
    } else {
      accountChanges[id].gain += change;
    }
  }

  // Find accounts with significant drops (>20 points) or gains (>15 points)
  const significantChanges = Object.entries(accountChanges)
    .filter(([_, data]) => data.drop >= 20 || data.gain >= 15)
    .slice(0, 20);

  if (significantChanges.length > 0) {
    const { data: accounts } = await supabase
      .from('accounts')
      .select('external_id, name')
      .eq('org_id', orgId)
      .in('external_id', significantChanges.map(([id]) => id));

    const accountMap = new Map((accounts || []).map((a: any) => [a.external_id, a.name]));

    for (const [accountId, data] of significantChanges.slice(0, 10)) {
      const isDrop = data.drop > data.gain;
      const changeAmount = isDrop ? data.drop : data.gain;
      const priority = changeAmount >= 30 ? 'critical' : changeAmount >= 20 ? 'high' : 'medium';
      
      signals.push({
        type: 'score_change',
        priority,
        account_external_id: accountId,
        account_name: accountMap.get(accountId) || null,
        title: isDrop ? `Score dropped ${changeAmount} points` : `Score improved ${changeAmount} points`,
        description: isDrop 
          ? 'ICP fit has decreased. Review account data for changes.' 
          : 'ICP fit has improved. Consider prioritizing this account.',
        metadata: {
          total_drop: data.drop,
          total_gain: data.gain,
          is_drop: isDrop,
          latest_change: data.latest,
        },
      });
    }
  }

  return signals;
}

/**
 * Compute coverage gaps - high-fit accounts with no recent activity
 */
async function computeCoverageGaps(supabase: any, orgId: string): Promise<IntentSignal[]> {
  const signals: IntentSignal[] = [];

  // Get high-fit accounts
  const { data: highFitScores } = await supabase
    .from('scores')
    .select('account_external_id')
    .eq('org_id', orgId)
    .eq('fit_label', 'high');

  if (!highFitScores || highFitScores.length === 0) return signals;

  const highFitIds = highFitScores.map((s: any) => s.account_external_id);

  // Get accounts with recent activity (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentlyActiveAccounts } = await supabase
    .from('activities')
    .select('account_external_id')
    .eq('org_id', orgId)
    .gte('activity_date', thirtyDaysAgo)
    .in('account_external_id', highFitIds);

  const activeIds = new Set((recentlyActiveAccounts || []).map((a: any) => a.account_external_id));

  // Find high-fit accounts with no recent activity
  const dormantHighFit = highFitIds.filter((id: string) => !activeIds.has(id));

  if (dormantHighFit.length > 0) {
    // Get account details
    const { data: accounts } = await supabase
      .from('accounts')
      .select('external_id, name, employee_count, propensity_score')
      .eq('org_id', orgId)
      .in('external_id', dormantHighFit.slice(0, 20))
      .order('employee_count', { ascending: false, nullsFirst: false });

    for (const account of (accounts || []).slice(0, 10)) {
      const priority = (account.propensity_score || 0) >= 70 ? 'high' : 'medium';
      
      signals.push({
        type: 'coverage_gap',
        priority,
        account_external_id: account.external_id,
        account_name: account.name,
        title: 'High-fit account with no recent engagement',
        description: `No activity in 30+ days. ${account.employee_count ? `${account.employee_count} employees.` : ''} Consider outreach.`,
        metadata: {
          employee_count: account.employee_count,
          propensity_score: account.propensity_score,
          days_since_activity: 30,
        },
      });
    }
  }

  return signals;
}
