import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { org_id } = await req.json();

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: 'org_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Generating weekly report for org: ${org_id}`);

    // Get date range for this week
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const weekStartStr = weekStart.toISOString();

    // Fetch this week's metrics
    const [
      accountsResult,
      signalsResult,
      scoresResult,
      leadsResult,
      activitiesResult,
      lastWeekScoresResult
    ] = await Promise.all([
      // Total accounts
      supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('org_id', org_id),
      
      // Signals this week
      supabase.from('account_signals')
        .select('*')
        .eq('org_id', org_id)
        .gte('created_at', weekStartStr)
        .is('dismissed_at', null),
      
      // Scores this week
      supabase.from('scores')
        .select('account_external_id, band, total, computed_at')
        .eq('org_id', org_id)
        .gte('computed_at', weekStartStr),
      
      // Leads added this week
      supabase.from('Leads')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', org_id)
        .gte('created_at', weekStartStr),
      
      // Activities this week
      supabase.from('activities')
        .select('id, activity_type', { count: 'exact' })
        .eq('org_id', org_id)
        .gte('activity_date', weekStartStr),

      // Last week's scores for comparison
      supabase.from('scores')
        .select('band', { count: 'exact' })
        .eq('org_id', org_id)
        .lt('computed_at', weekStartStr)
        .gte('computed_at', new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
    ]);

    // Process signals by priority
    const signals = signalsResult.data || [];
    const criticalSignals = signals.filter(s => s.signal_priority === 'critical');
    const highSignals = signals.filter(s => s.signal_priority === 'high');
    const mediumSignals = signals.filter(s => s.signal_priority === 'medium');

    // Process scores this week
    const scoresThisWeek = scoresResult.data || [];
    const highFitScored = scoresThisWeek.filter(s => s.band === 'A' || s.band === 'B').length;
    const lowFitScored = scoresThisWeek.filter(s => s.band === 'C' || s.band === 'D').length;

    // Get top opportunities (highest scores this week)
    const topOpportunities = scoresThisWeek
      .sort((a, b) => (b.total || 0) - (a.total || 0))
      .slice(0, 5);

    // Get account names for top opportunities
    const topAccountIds = topOpportunities.map(s => s.account_external_id);
    const { data: topAccounts } = await supabase
      .from('accounts')
      .select('external_id, name, industry_norm, employee_count')
      .eq('org_id', org_id)
      .in('external_id', topAccountIds);

    const topOpportunitiesWithDetails = topOpportunities.map(score => {
      const account = topAccounts?.find(a => a.external_id === score.account_external_id);
      return {
        account_external_id: score.account_external_id,
        account_name: account?.name || 'Unknown',
        industry: account?.industry_norm || 'Unknown',
        employee_count: account?.employee_count,
        score: score.total,
        band: score.band
      };
    });

    // Get accounts needing attention (with critical signals)
    const accountsNeedingAttention = criticalSignals.slice(0, 5).map(signal => ({
      account_external_id: signal.account_external_id,
      account_name: signal.account_name || 'Unknown',
      reason: signal.title,
      signal_type: signal.signal_type,
      priority: signal.signal_priority
    }));

    // Calculate week-over-week changes
    const lastWeekHighFit = lastWeekScoresResult.data?.filter(s => s.band === 'A' || s.band === 'B').length || 0;
    const highFitChange = highFitScored - lastWeekHighFit;

    // Build metrics summary
    const metrics = {
      total_accounts: accountsResult.count || 0,
      accounts_scored_this_week: scoresThisWeek.length,
      high_fit_scored: highFitScored,
      low_fit_scored: lowFitScored,
      high_fit_change: highFitChange,
      new_leads_this_week: leadsResult.count || 0,
      activities_this_week: activitiesResult.count || 0,
      signals_detected: signals.length,
      critical_signals: criticalSignals.length,
      high_signals: highSignals.length,
      medium_signals: mediumSignals.length
    };

    // Generate AI summary using Lovable AI
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    let aiSummary = '';

    if (lovableApiKey) {
      try {
        const aiPrompt = `Generate a concise weekly executive summary (2-3 paragraphs) for a B2B sales intelligence dashboard. Be direct and actionable.

Weekly Metrics:
- ${metrics.accounts_scored_this_week} accounts scored this week
- ${metrics.high_fit_scored} high-fit accounts identified (${highFitChange >= 0 ? '+' : ''}${highFitChange} vs last week)
- ${metrics.critical_signals} critical signals requiring attention
- ${metrics.high_signals} high-priority opportunities detected
- ${metrics.new_leads_this_week} new leads added
- ${metrics.activities_this_week} activities logged

Top Opportunities:
${topOpportunitiesWithDetails.map(o => `- ${o.account_name} (${o.industry}, Score: ${o.score})`).join('\n')}

Critical Issues:
${accountsNeedingAttention.map(a => `- ${a.account_name}: ${a.reason}`).join('\n') || 'No critical issues this week'}

Provide:
1. A headline summary of the week's performance
2. Key wins and areas of concern
3. Top 2-3 recommended actions for next week`;

        const aiResponse = await fetch('https://api.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a B2B sales analytics assistant. Provide concise, actionable insights for executives.' },
              { role: 'user', content: aiPrompt }
            ],
            max_tokens: 600,
            temperature: 0.7
          })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiSummary = aiData.choices?.[0]?.message?.content || '';
        }
      } catch (aiError) {
        console.error('Error generating AI summary:', aiError);
      }
    }

    // If no AI summary, generate a simple one
    if (!aiSummary) {
      aiSummary = `**Weekly Performance Summary**\n\nThis week, ${metrics.accounts_scored_this_week} accounts were scored with ${metrics.high_fit_scored} identified as high-fit opportunities${highFitChange !== 0 ? ` (${highFitChange >= 0 ? '+' : ''}${highFitChange} vs last week)` : ''}.\n\n${criticalSignals.length > 0 ? `**Attention Required:** ${criticalSignals.length} critical signals detected that need immediate review.` : 'No critical issues detected this week.'}\n\n**Recommended Actions:**\n- Review the ${metrics.high_signals} high-priority opportunities\n- ${criticalSignals.length > 0 ? 'Address critical signals before they escalate' : 'Continue monitoring account engagement'}\n- Focus outreach on newly identified high-fit accounts`;
    }

    const report = {
      generated_at: now.toISOString(),
      period_start: weekStartStr,
      period_end: now.toISOString(),
      metrics,
      ai_summary: aiSummary,
      top_opportunities: topOpportunitiesWithDetails,
      accounts_needing_attention: accountsNeedingAttention,
      signal_breakdown: {
        critical: criticalSignals.length,
        high: highSignals.length,
        medium: mediumSignals.length,
        total: signals.length
      }
    };

    console.log('Weekly report generated successfully');

    return new Response(
      JSON.stringify(report),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating weekly report:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate weekly report' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});