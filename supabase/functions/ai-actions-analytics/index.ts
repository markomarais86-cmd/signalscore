import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function logAction(
  supabase: any, org_id: string, user_id: string | undefined, action_name: string,
  parameters: Record<string, any>, result: any, status: 'success' | 'failed',
  error_message?: string, execution_time_ms?: number
) {
  try {
    await supabase.from("ai_action_logs").insert({
      org_id, user_id, action_name, action_parameters: parameters,
      action_result: result, status, error_message, execution_time_ms,
    });
  } catch (e) {
    console.error("[AI-Actions-Analytics] Failed to log action:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, parameters, org_id, user_id } = await req.json();
    console.log(`[AI-Actions-Analytics] Executing action: ${action}`, parameters);

    switch (action) {
      case "get_insights": {
        const [accountsResult, scoresResult, icpResult, leadsResult, enrichedResult] = await Promise.all([
          supabase.from("accounts").select("id, industry_norm, revenue_range, employee_count", { count: "exact" }).eq("org_id", org_id),
          supabase.from("scores").select("overall").eq("org_id", org_id),
          supabase.from("icp_profiles").select("id, name, status").eq("org_id", org_id),
          supabase.from("Leads").select("id, account_external_id", { count: "exact" }).eq("org_id", org_id),
          supabase.from("accounts").select("id").eq("org_id", org_id).not("enriched_at", "is", null),
        ]);

        const accounts = accountsResult.data || [];
        const scores = scoresResult.data || [];
        const highFit = scores.filter((s: any) => s.overall >= 70).length;
        const medFit = scores.filter((s: any) => s.overall >= 40 && s.overall < 70).length;
        const lowFit = scores.filter((s: any) => s.overall < 40).length;

        const totalAccounts = accountsResult.count || 0;
        const accountsWithIndustry = accounts.filter((a: any) => a.industry_norm).length;
        const accountsWithRevenue = accounts.filter((a: any) => a.revenue_range).length;
        const accountsWithSize = accounts.filter((a: any) => a.employee_count).length;
        const accountsWithContacts = new Set((leadsResult.data || []).map((l: any) => l.account_external_id).filter(Boolean)).size;

        const dataQuality = {
          completeness: totalAccounts > 0 ? Math.round(((accountsWithIndustry + accountsWithRevenue + accountsWithSize) / (totalAccounts * 3)) * 100) : 0,
          accounts_with_contacts: totalAccounts > 0 ? Math.round((accountsWithContacts / totalAccounts) * 100) : 0,
        };

        const recommendations: string[] = [];
        if (dataQuality.completeness < 50) recommendations.push("Data completeness is low. Consider enriching accounts.");
        if (dataQuality.accounts_with_contacts < 30) recommendations.push(`Only ${dataQuality.accounts_with_contacts}% of accounts have contacts.`);
        if (scores.length === 0 && totalAccounts > 0) recommendations.push("No accounts are scored yet. Create an ICP and run bulk scoring.");

        const message = `**Pipeline Summary:**\n• ${totalAccounts} total accounts (${enrichedResult.data?.length || 0} enriched)\n• ${scores.length} scored: ${highFit} high-fit, ${medFit} medium, ${lowFit} low\n• ${leadsResult.count || 0} contacts across ${accountsWithContacts} accounts\n• Data completeness: ${dataQuality.completeness}%\n\n${recommendations.length > 0 ? `**Recommendations:**\n${recommendations.map(r => `• ${r}`).join('\n')}` : ''}`;

        const result = {
          total_accounts: totalAccounts, total_contacts: leadsResult.count || 0,
          scored_accounts: scores.length, high_fit: highFit, medium_fit: medFit, low_fit: lowFit,
          active_icps: (icpResult.data || []).filter((i: any) => i.status === 'active').length,
          data_quality: dataQuality, recommendations, message,
        };
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "analyze_pipeline": {
        const { data: scores, error: scoresError } = await supabase
          .from("scores").select("account_external_id, overall, fit, intent").eq("org_id", org_id);
        if (scoresError) throw new Error(scoresError.message);

        const { data: accounts } = await supabase
          .from("accounts").select("external_id, industry_norm, country, employee_count").eq("org_id", org_id);

        const highFit = (scores || []).filter((s: any) => s.overall >= 70);
        const medFit = (scores || []).filter((s: any) => s.overall >= 40 && s.overall < 70);
        const lowFit = (scores || []).filter((s: any) => s.overall < 40);

        const highFitIds = highFit.map((s: any) => s.account_external_id);
        const { data: contacts, count: contactCount } = await supabase
          .from("Leads").select("id, account_external_id, email_verified, persona", { count: 'exact' })
          .eq("org_id", org_id).in("account_external_id", highFitIds.slice(0, 100));

        const verifiedContacts = (contacts || []).filter((c: any) => c.email_verified).length;
        const decisionMakers = (contacts || []).filter((c: any) => 
          c.persona?.toLowerCase().includes('decision maker') || c.persona?.toLowerCase().includes('executive')
        ).length;

        const insights = {
          total_scored: scores?.length || 0, high_fit_count: highFit.length,
          high_fit_percentage: scores?.length ? Math.round((highFit.length / scores.length) * 100) : 0,
          medium_fit_count: medFit.length, low_fit_count: lowFit.length,
          avg_score: scores?.length ? Math.round(scores.reduce((a: number, b: any) => a + b.overall, 0) / scores.length) : 0,
          verified_contacts_in_high_fit: verifiedContacts, decision_makers_identified: decisionMakers,
          coverage_rate: highFit.length ? Math.round((new Set(contacts?.map((c: any) => c.account_external_id)).size / highFit.length) * 100) : 0,
        };

        const recommendations: string[] = [];
        if (insights.coverage_rate < 50) recommendations.push(`Only ${insights.coverage_rate}% of high-fit accounts have contacts.`);
        if (insights.high_fit_percentage < 20) recommendations.push("Low high-fit rate. Consider refining ICP criteria.");

        const message = `**Pipeline Analysis:**\n• **${insights.total_scored}** scored accounts\n• **${insights.high_fit_count}** high-fit (${insights.high_fit_percentage}%)\n• Average score: **${insights.avg_score}**\n• Decision makers: **${decisionMakers}** (${verifiedContacts} verified)`;

        const result = { insights, recommendations, message };
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "analyze_territory": {
        const { group_by = 'country' } = parameters;
        const { data: accounts, error } = await supabase
          .from("accounts").select(`external_id, name, country, industry_norm, employee_count, scores(overall)`).eq("org_id", org_id);
        if (error) throw new Error(error.message);

        const grouped = new Map<string, { count: number; totalScore: number; highFit: number }>();
        for (const account of accounts || []) {
          const key = group_by === 'country' ? (account.country || 'Unknown') : (account.industry_norm || 'Unknown');
          const score = account.scores?.[0]?.overall || 0;
          if (!grouped.has(key)) grouped.set(key, { count: 0, totalScore: 0, highFit: 0 });
          const group = grouped.get(key)!;
          group.count++; group.totalScore += score;
          if (score >= 70) group.highFit++;
        }

        const territories = Array.from(grouped.entries())
          .map(([name, data]) => ({
            name, count: data.count, avgScore: Math.round(data.totalScore / data.count),
            highFitCount: data.highFit, highFitRate: Math.round((data.highFit / data.count) * 100),
          }))
          .sort((a, b) => b.highFitCount - a.highFitCount);

        const message = `**Territory Analysis by ${group_by}:**\n\n${territories.slice(0, 5).map((t, i) => 
          `${i + 1}. **${t.name}**: ${t.count} accounts, ${t.highFitCount} high-fit (${t.highFitRate}%)`
        ).join('\n')}`;

        const result = { territories, topTerritories: territories.slice(0, 5), groupBy: group_by, message };
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_scoring_insights": {
        const { data: scores, error } = await supabase
          .from("scores").select("account_external_id, overall, fit, intent, reachability").eq("org_id", org_id);
        if (error) throw new Error(error.message);

        if (!scores || scores.length === 0) {
          return new Response(JSON.stringify({ success: true, action, result: { message: "No scored accounts found." } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const distribution = {
          '0-20': scores.filter((s: any) => s.overall < 20).length,
          '20-40': scores.filter((s: any) => s.overall >= 20 && s.overall < 40).length,
          '40-60': scores.filter((s: any) => s.overall >= 40 && s.overall < 60).length,
          '60-80': scores.filter((s: any) => s.overall >= 60 && s.overall < 80).length,
          '80-100': scores.filter((s: any) => s.overall >= 80).length,
        };

        const avgOverall = Math.round(scores.reduce((a: number, b: any) => a + b.overall, 0) / scores.length);
        const avgFit = Math.round(scores.reduce((a: number, b: any) => a + (b.fit || 0), 0) / scores.length);
        const avgIntent = Math.round(scores.reduce((a: number, b: any) => a + (b.intent || 0), 0) / scores.length);

        const message = `**Scoring Insights:**\n\n**Distribution:**\n${Object.entries(distribution).map(([range, count]) => 
          `• ${range}: ${count} (${Math.round((count/scores.length)*100)}%)`
        ).join('\n')}\n\n**Averages:** Overall: ${avgOverall}, Fit: ${avgFit}, Intent: ${avgIntent}`;

        const result = { totalScored: scores.length, distribution, averages: { overall: avgOverall, fit: avgFit, intent: avgIntent }, message };
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ success: false, error: `Unknown analytics action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("[AI-Actions-Analytics] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
