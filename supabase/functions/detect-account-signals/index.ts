import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, parseJsonBody, validateRequired } from "../_shared/response-helpers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Signal {
  org_id: string;
  account_external_id: string;
  account_name: string | null;
  signal_type: string;
  signal_priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  metadata: Record<string, any>;
  expires_at: string;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await parseJsonBody<{ org_id: string }>(req);
    const validation = validateRequired(body, ['org_id']);
    
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: `Missing: ${validation.missing.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { org_id } = body!;
    console.log(`[Signal Detection] Starting for org: ${org_id}`);

    const signals: Signal[] = [];
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const expiresIn7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const expiresIn3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Get all high-fit accounts (score >= 70)
    const { data: highFitScores } = await supabase
      .from("scores")
      .select(`
        account_external_id,
        overall,
        calculated_at,
        accounts!inner(name, external_id, updated_at)
      `)
      .eq("org_id", org_id)
      .gte("overall", 70);

    if (highFitScores && highFitScores.length > 0) {
      // Get contact counts for high-fit accounts
      const accountIds = highFitScores.map(s => s.account_external_id);
      
      const { data: contacts } = await supabase
        .from("Leads")
        .select("account_external_id, updated_at")
        .eq("org_id", org_id)
        .in("account_external_id", accountIds);

      const contactCountMap: Record<string, number> = {};
      const lastContactUpdate: Record<string, string> = {};
      
      contacts?.forEach(c => {
        contactCountMap[c.account_external_id] = (contactCountMap[c.account_external_id] || 0) + 1;
        const existing = lastContactUpdate[c.account_external_id];
        if (!existing || c.updated_at > existing) {
          lastContactUpdate[c.account_external_id] = c.updated_at;
        }
      });

      // Get activities for high-fit accounts
      const { data: activities } = await supabase
        .from("activities")
        .select("account_external_id, activity_date")
        .eq("org_id", org_id)
        .in("account_external_id", accountIds)
        .gte("activity_date", fourteenDaysAgo.toISOString());

      const recentActivitySet = new Set(activities?.map(a => a.account_external_id) || []);

      for (const score of highFitScores) {
        const account = score.accounts as any;
        const contactCount = contactCountMap[score.account_external_id] || 0;
        const hasRecentActivity = recentActivitySet.has(score.account_external_id);

        // Signal: No contacts on high-fit account
        if (contactCount === 0) {
          signals.push({
            org_id,
            account_external_id: score.account_external_id,
            account_name: account?.name,
            signal_type: 'no_contacts',
            signal_priority: 'critical',
            title: 'High-fit account has no contacts',
            description: `${account?.name || 'Account'} scored ${score.overall} but has zero contacts. Find decision makers to start outreach.`,
            metadata: { score: score.overall },
            expires_at: expiresIn7Days,
          });
        }
        // Signal: Single contact (multi-threading gap)
        else if (contactCount === 1 && score.overall >= 75) {
          signals.push({
            org_id,
            account_external_id: score.account_external_id,
            account_name: account?.name,
            signal_type: 'multi_thread_gap',
            signal_priority: 'high',
            title: 'Multi-threading needed',
            description: `${account?.name || 'Account'} has only 1 contact. Add more decision makers to reduce deal risk.`,
            metadata: { score: score.overall, contact_count: 1 },
            expires_at: expiresIn7Days,
          });
        }

        // Signal: Stale engagement (no activity in 14+ days for high-fit)
        if (!hasRecentActivity && score.overall >= 75) {
          signals.push({
            org_id,
            account_external_id: score.account_external_id,
            account_name: account?.name,
            signal_type: 'stale_engagement',
            signal_priority: 'high',
            title: 'Engagement has gone cold',
            description: `No activity on ${account?.name || 'account'} in 14+ days. Re-engage before momentum is lost.`,
            metadata: { score: score.overall, days_since_activity: 14 },
            expires_at: expiresIn3Days,
          });
        }
      }
    }

    // 2. Detect score velocity changes (compare to score_history if available)
    const { data: scoreHistory } = await supabase
      .from("score_history")
      .select("account_external_id, old_score, new_score, changed_at, accounts(name)")
      .eq("org_id", org_id)
      .gte("changed_at", sevenDaysAgo.toISOString())
      .order("changed_at", { ascending: false });

    if (scoreHistory) {
      for (const change of scoreHistory) {
        const diff = (change.new_score || 0) - (change.old_score || 0);
        const account = change.accounts as any;
        
        if (diff <= -15) {
          signals.push({
            org_id,
            account_external_id: change.account_external_id,
            account_name: account?.name,
            signal_type: 'score_velocity_down',
            signal_priority: 'critical',
            title: 'Score dropped significantly',
            description: `${account?.name || 'Account'} score dropped ${Math.abs(diff)} points (${change.old_score} → ${change.new_score}). Review and investigate.`,
            metadata: { old_score: change.old_score, new_score: change.new_score, change: diff },
            expires_at: expiresIn3Days,
          });
        } else if (diff >= 15) {
          signals.push({
            org_id,
            account_external_id: change.account_external_id,
            account_name: account?.name,
            signal_type: 'score_velocity_up',
            signal_priority: 'medium',
            title: 'Score improved significantly',
            description: `${account?.name || 'Account'} score increased ${diff} points. Now scoring ${change.new_score} - consider prioritizing.`,
            metadata: { old_score: change.old_score, new_score: change.new_score, change: diff },
            expires_at: expiresIn7Days,
          });
        }
      }
    }

    // 3. Detect new high-fit accounts (scored 70+ in last 7 days for first time)
    const { data: newHighFit } = await supabase
      .from("scores")
      .select("account_external_id, overall, calculated_at, accounts(name)")
      .eq("org_id", org_id)
      .gte("overall", 70)
      .gte("calculated_at", sevenDaysAgo.toISOString());

    if (newHighFit) {
      for (const score of newHighFit) {
        const account = score.accounts as any;
        signals.push({
          org_id,
          account_external_id: score.account_external_id,
          account_name: account?.name,
          signal_type: 'new_high_fit',
          signal_priority: score.overall >= 85 ? 'high' : 'medium',
          title: 'New high-fit account detected',
          description: `${account?.name || 'Account'} just scored ${score.overall}. Matches your ideal customer profile.`,
          metadata: { score: score.overall, scored_at: score.calculated_at },
          expires_at: expiresIn7Days,
        });
      }
    }

    // 4. Stale contacts (not updated in 90+ days)
    const { data: staleContacts } = await supabase
      .from("Leads")
      .select("account_external_id, accounts(name)")
      .eq("org_id", org_id)
      .lt("updated_at", ninetyDaysAgo.toISOString())
      .limit(100);

    if (staleContacts && staleContacts.length > 20) {
      // Group by account
      const accountStaleCount: Record<string, { count: number; name: string | null }> = {};
      staleContacts.forEach(c => {
        const account = c.accounts as any;
        if (!accountStaleCount[c.account_external_id]) {
          accountStaleCount[c.account_external_id] = { count: 0, name: account?.name };
        }
        accountStaleCount[c.account_external_id].count++;
      });

      for (const [accountId, data] of Object.entries(accountStaleCount)) {
        if (data.count >= 3) {
          signals.push({
            org_id,
            account_external_id: accountId,
            account_name: data.name,
            signal_type: 'contact_stale',
            signal_priority: 'medium',
            title: 'Contact data may be outdated',
            description: `${data.count} contacts at ${data.name || 'account'} haven't been updated in 90+ days. Consider re-verifying.`,
            metadata: { stale_contact_count: data.count },
            expires_at: expiresIn7Days,
          });
        }
      }
    }

    // 5. Recently funded accounts
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const { data: fundedAccounts } = await supabase
      .from("accounts")
      .select("external_id, name, last_funding_round, last_funding_date, total_raised_usd")
      .eq("org_id", org_id)
      .gte("last_funding_date", thirtyDaysAgo.toISOString().split('T')[0])
      .limit(50);

    if (fundedAccounts) {
      for (const account of fundedAccounts) {
        signals.push({
          org_id,
          account_external_id: account.external_id,
          account_name: account.name,
          signal_type: 'funding_event',
          signal_priority: 'high',
          title: 'Recent funding detected',
          description: `${account.name || 'Account'} raised ${account.last_funding_round || 'funding'} recently. Great time to engage.`,
          metadata: { 
            funding_round: account.last_funding_round,
            funding_date: account.last_funding_date,
            total_raised: account.total_raised_usd
          },
          expires_at: expiresIn7Days,
        });
      }
    }

    console.log(`[Signal Detection] Detected ${signals.length} raw signals`);

    // Deduplicate signals by account + type (keep highest priority)
    const signalMap = new Map<string, Signal>();
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    
    for (const signal of signals) {
      const key = `${signal.account_external_id}:${signal.signal_type}`;
      const existing = signalMap.get(key);
      if (!existing || priorityOrder[signal.signal_priority] < priorityOrder[existing.signal_priority]) {
        signalMap.set(key, signal);
      }
    }

    const uniqueSignals = Array.from(signalMap.values());
    console.log(`[Signal Detection] ${uniqueSignals.length} unique signals after dedup`);

    // Clear old signals for this org (that haven't been actioned)
    await supabase
      .from("account_signals")
      .delete()
      .eq("org_id", org_id)
      .is("actioned_at", null)
      .lt("created_at", sevenDaysAgo.toISOString());

    // Insert new signals (upsert to avoid duplicates)
    if (uniqueSignals.length > 0) {
      const { error: insertError } = await supabase
        .from("account_signals")
        .insert(uniqueSignals.map(s => ({
          ...s,
          created_at: now.toISOString(),
        })));

      if (insertError) {
        console.error("[Signal Detection] Insert error:", insertError);
      }
    }

    // Get signal summary
    const signalsByType: Record<string, number> = {};
    const signalsByPriority: Record<string, number> = {};
    
    uniqueSignals.forEach(s => {
      signalsByType[s.signal_type] = (signalsByType[s.signal_type] || 0) + 1;
      signalsByPriority[s.signal_priority] = (signalsByPriority[s.signal_priority] || 0) + 1;
    });

    console.log(`[Signal Detection] Complete. By priority:`, signalsByPriority);

    return new Response(
      JSON.stringify({
        success: true,
        signals_created: uniqueSignals.length,
        by_type: signalsByType,
        by_priority: signalsByPriority,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[Signal Detection] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
