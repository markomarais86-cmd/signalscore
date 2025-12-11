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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's org_id
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.org_id) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orgId = profile.org_id;
    const { batch_size = 100, dry_run = false } = await req.json().catch(() => ({}));

    console.log(`[bulk-qualify-leads] Starting for org ${orgId}, batch_size: ${batch_size}, dry_run: ${dry_run}`);

    // Count open leads linked to high-fit accounts
    const { data: openLeadsCount } = await supabase
      .from('Leads')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'open')
      .not('account_external_id', 'is', null);

    const totalOpen = openLeadsCount?.length ?? 0;

    // Get leads linked to ICP-qualified accounts (score >= 70)
    const { data: leadsToProcess, error: leadsError } = await supabase
      .from('Leads')
      .select(`
        id,
        name,
        email,
        title,
        persona,
        account_external_id,
        company,
        industry,
        employee_count,
        revenue_range
      `)
      .eq('org_id', orgId)
      .eq('status', 'open')
      .not('account_external_id', 'is', null)
      .limit(batch_size);

    if (leadsError) {
      console.error('[bulk-qualify-leads] Error fetching leads:', leadsError);
      throw leadsError;
    }

    console.log(`[bulk-qualify-leads] Found ${leadsToProcess?.length || 0} open leads to process`);

    if (!leadsToProcess || leadsToProcess.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No open leads to process',
        processed: 0,
        qualified: 0,
        rejected: 0,
        total_remaining: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get scores for these leads' accounts
    const accountIds = [...new Set(leadsToProcess.map(l => l.account_external_id))];
    const { data: scores } = await supabase
      .from('scores')
      .select('account_external_id, overall, fit')
      .eq('org_id', orgId)
      .in('account_external_id', accountIds);

    const scoreMap = new Map(scores?.map(s => [s.account_external_id, s]) || []);

    // Qualify leads based on account score and lead data
    let qualified = 0;
    let rejected = 0;
    const updates: { id: number; status: string; qualification_reason?: string }[] = [];

    for (const lead of leadsToProcess) {
      const accountScore = scoreMap.get(lead.account_external_id);
      
      // Qualification logic:
      // 1. Account score >= 70 = high fit
      // 2. Lead has valid email
      // 3. Lead has persona or title
      const hasHighFitAccount = accountScore && accountScore.overall >= 70;
      const hasEmail = lead.email && lead.email.includes('@');
      const hasPersona = lead.persona && lead.persona !== 'Unknown';
      const hasTitle = lead.title && lead.title.trim() !== '';

      let newStatus: string;
      let reason: string;

      if (hasHighFitAccount && hasEmail && (hasPersona || hasTitle)) {
        newStatus = 'qualified';
        reason = `High-fit account (score: ${accountScore?.overall}), valid email, ${hasPersona ? 'persona: ' + lead.persona : 'title: ' + lead.title}`;
        qualified++;
      } else if (hasHighFitAccount && hasEmail) {
        newStatus = 'qualified';
        reason = `High-fit account (score: ${accountScore?.overall}), valid email`;
        qualified++;
      } else if (!accountScore || accountScore.overall < 50) {
        newStatus = 'rejected';
        reason = `Low-fit account (score: ${accountScore?.overall || 'unscored'})`;
        rejected++;
      } else {
        // Medium fit or missing data - keep in pipeline
        newStatus = 'qualified';
        reason = `Medium-fit account (score: ${accountScore?.overall}), needs enrichment`;
        qualified++;
      }

      updates.push({
        id: lead.id,
        status: newStatus,
        qualification_reason: reason,
      });
    }

    // Apply updates if not dry run
    if (!dry_run && updates.length > 0) {
      for (const update of updates) {
        await supabase
          .from('Leads')
          .update({
            status: update.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', update.id)
          .eq('org_id', orgId);
      }
    }

    // Get remaining count
    const { count: remaining } = await supabase
      .from('Leads')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'open')
      .not('account_external_id', 'is', null);

    console.log(`[bulk-qualify-leads] Processed ${updates.length} leads: ${qualified} qualified, ${rejected} rejected`);

    return new Response(JSON.stringify({
      success: true,
      message: dry_run 
        ? `Would process ${updates.length} leads (dry run)` 
        : `Processed ${updates.length} leads`,
      processed: updates.length,
      qualified,
      rejected,
      total_remaining: remaining || 0,
      has_more: (remaining || 0) > 0,
      sample_results: updates.slice(0, 5),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[bulk-qualify-leads] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
