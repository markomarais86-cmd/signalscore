import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { org_id } = await req.json();
    if (!org_id) {
      return new Response(JSON.stringify({ error: "org_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get all enabled rules for this org
    const { data: rules, error: rulesErr } = await supabase
      .from("campaign_automation_rules")
      .select("*")
      .eq("org_id", org_id)
      .eq("is_enabled", true);

    if (rulesErr) throw rulesErr;
    if (!rules?.length) {
      return new Response(JSON.stringify({ triggered: 0, message: "No active rules" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let triggeredCount = 0;
    const results: { rule: string; triggered: boolean; reason?: string }[] = [];

    for (const rule of rules) {
      // Check cooldown
      if (rule.last_triggered_at) {
        const lastTriggered = new Date(rule.last_triggered_at).getTime();
        const cooldownMs = rule.cooldown_hours * 60 * 60 * 1000;
        if (Date.now() - lastTriggered < cooldownMs) {
          results.push({ rule: rule.name, triggered: false, reason: "In cooldown" });
          continue;
        }
      }

      // 2. Count unactioned signals matching this rule
      const { data: signals, error: sigErr } = await supabase
        .from("account_signals")
        .select("id, account_external_id, account_name")
        .eq("org_id", org_id)
        .eq("signal_type", rule.signal_type)
        .is("actioned_at", null)
        .is("dismissed_at", null)
        .in("signal_priority", rule.priority_filter)
        .order("created_at", { ascending: false })
        .limit(200);

      if (sigErr) {
        console.error("Signal query error:", sigErr);
        results.push({ rule: rule.name, triggered: false, reason: sigErr.message });
        continue;
      }

      if (!signals || signals.length < rule.min_signals) {
        results.push({ rule: rule.name, triggered: false, reason: `Only ${signals?.length || 0}/${rule.min_signals} signals` });
        continue;
      }

      // Count unique accounts
      const uniqueAccounts = [...new Set(signals.map((s: { account_external_id: string }) => s.account_external_id))];
      if (uniqueAccounts.length < rule.min_accounts) {
        results.push({ rule: rule.name, triggered: false, reason: `Only ${uniqueAccounts.length}/${rule.min_accounts} accounts` });
        continue;
      }

      // 3. Thresholds met — create campaign
      const signalLabel = rule.signal_type.replace(/_/g, " ");
      const campaignName = `Auto: ${rule.name} (${new Date().toLocaleDateString()})`;
      const signalIds = signals.map((s: { id: string }) => s.id);

      const { data: campaign, error: campErr } = await supabase
        .from("campaigns")
        .insert({
          org_id,
          name: campaignName,
          campaign_type: "automated",
          fuel_line_type: rule.fuel_line_type,
          signal_source_ids: signalIds.slice(0, 100),
          account_ids: uniqueAccounts.slice(0, 100),
          total_accounts: uniqueAccounts.length,
          total_contacts: 0,
          status: "draft",
          metadata: {
            automation_rule_id: rule.id,
            signal_type: rule.signal_type,
            sequence_template: rule.sequence_template,
            triggered_at: new Date().toISOString(),
          },
        })
        .select("id")
        .single();

      if (campErr) {
        console.error("Campaign creation error:", campErr);
        results.push({ rule: rule.name, triggered: false, reason: campErr.message });
        continue;
      }

      // 4. Log the trigger
      await supabase.from("campaign_automation_log").insert({
        org_id,
        rule_id: rule.id,
        rule_name: rule.name,
        signal_type: rule.signal_type,
        fuel_line_type: rule.fuel_line_type,
        signal_count: signals.length,
        account_count: uniqueAccounts.length,
        signal_ids: signalIds.slice(0, 100),
        account_external_ids: uniqueAccounts.slice(0, 100),
        campaign_id: campaign?.id || null,
        campaign_name: campaignName,
        status: "created",
      });

      // 5. Mark signals as actioned
      await supabase
        .from("account_signals")
        .update({ actioned_at: new Date().toISOString() })
        .in("id", signalIds);

      // 6. Update rule stats
      await supabase
        .from("campaign_automation_rules")
        .update({
          last_triggered_at: new Date().toISOString(),
          trigger_count: (rule.trigger_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rule.id);

      triggeredCount++;
      results.push({ rule: rule.name, triggered: true });
    }

    return new Response(JSON.stringify({ triggered: triggeredCount, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Automation trigger error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
