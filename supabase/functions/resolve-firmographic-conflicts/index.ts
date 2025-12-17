import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIWithFallback } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Conflict {
  id: string;
  account_external_id: string;
  lead_id: number;
  field_name: string;
  account_value: string;
  lead_value: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { org_id, conflict_ids, auto_apply } = await req.json();

    if (!org_id) {
      throw new Error("org_id is required");
    }

    // Fetch pending conflicts
    let query = supabase
      .from("firmographic_conflicts")
      .select("*")
      .eq("org_id", org_id)
      .eq("status", "pending");

    if (conflict_ids && conflict_ids.length > 0) {
      query = query.in("id", conflict_ids);
    } else {
      query = query.limit(50); // Process in batches
    }

    const { data: conflicts, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    if (!conflicts || conflicts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, resolved: 0, message: "No pending conflicts" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group conflicts by account for context
    const conflictsByAccount = conflicts.reduce((acc: Record<string, Conflict[]>, c: Conflict) => {
      if (!acc[c.account_external_id]) acc[c.account_external_id] = [];
      acc[c.account_external_id].push(c);
      return acc;
    }, {});

    // Get account context for better AI decisions
    const accountIds = Object.keys(conflictsByAccount);
    const { data: accounts } = await supabase
      .from("accounts")
      .select("external_id, name, domain, data_source, enriched_at, enrichment_confidence")
      .eq("org_id", org_id)
      .in("external_id", accountIds);

    const accountMap = (accounts || []).reduce((acc: Record<string, any>, a: any) => {
      acc[a.external_id] = a;
      return acc;
    }, {});

    const resolutions: Array<{
      conflict_id: string;
      resolved_value: string;
      resolution_source: string;
      ai_confidence: number;
      ai_reasoning: string;
    }> = [];

    // Process each conflict with AI
    for (const conflict of conflicts) {
      const account = accountMap[conflict.account_external_id];
      
      const prompt = `You are a data quality expert. Analyze this firmographic data conflict and determine the most accurate value.

CONFLICT DETAILS:
- Field: ${conflict.field_name}
- Account Value: "${conflict.account_value}"
- Lead Value: "${conflict.lead_value}"

CONTEXT:
- Company: ${account?.name || 'Unknown'} (${account?.domain || 'no domain'})
- Account Data Source: ${account?.data_source || 'unknown'}
- Account Enrichment Confidence: ${account?.enrichment_confidence || 'N/A'}
- Account Last Enriched: ${account?.enriched_at || 'never'}

RULES:
1. For revenue_range and employee_count: Prefer more specific/recent values
2. For industry: Prefer standardized industry names over raw values
3. For geographic data: Account-level data is usually more authoritative
4. Consider data source reliability: enriched > crm > manual
5. If values are essentially the same (just formatted differently), choose the cleaner format

Respond with ONLY a JSON object (no markdown):
{
  "chosen_value": "the value you recommend",
  "source": "account" or "lead",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

      try {
        const aiResponse = await callAIWithFallback(supabase, {
          messages: [{ role: "user", content: prompt }],
          taskType: "analysis",
          maxTokens: 200,
          temperature: 0.1,
          orgId: org_id,
        });

        const responseText = aiResponse.content || "";
        
        // Parse JSON response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          resolutions.push({
            conflict_id: conflict.id,
            resolved_value: parsed.chosen_value,
            resolution_source: parsed.source === "account" ? "ai_account" : "ai_lead",
            ai_confidence: parsed.confidence,
            ai_reasoning: parsed.reasoning,
          });
        }
      } catch (aiError) {
        console.error(`AI error for conflict ${conflict.id}:`, aiError);
        // Fallback: prefer account value for most fields
        resolutions.push({
          conflict_id: conflict.id,
          resolved_value: conflict.account_value,
          resolution_source: "ai_account",
          ai_confidence: 0.5,
          ai_reasoning: "Defaulted to account value due to AI processing error",
        });
      }
    }

    // Update conflicts with resolutions
    let resolvedCount = 0;
    for (const resolution of resolutions) {
      const updateData: any = {
        resolved_value: resolution.resolved_value,
        resolution_source: resolution.resolution_source,
        ai_confidence: resolution.ai_confidence,
        ai_reasoning: resolution.ai_reasoning,
      };

      if (auto_apply) {
        updateData.status = "resolved";
        updateData.resolved_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("firmographic_conflicts")
        .update(updateData)
        .eq("id", resolution.conflict_id);

      if (!updateError) resolvedCount++;
    }

    // If auto_apply, also update the source records
    if (auto_apply) {
      for (const resolution of resolutions) {
        const conflict = conflicts.find((c: Conflict) => c.id === resolution.conflict_id);
        if (!conflict) continue;

        // Update account if AI chose lead value
        if (resolution.resolution_source === "ai_lead") {
          const updateField: Record<string, any> = {};
          if (conflict.field_name === "employee_count") {
            updateField.employee_count = parseInt(resolution.resolved_value) || null;
          } else {
            updateField[conflict.field_name === "industry" ? "industry_norm" : conflict.field_name] = resolution.resolved_value;
          }
          
          await supabase
            .from("accounts")
            .update(updateField)
            .eq("org_id", org_id)
            .eq("external_id", conflict.account_external_id);
        }

        // Update lead if AI chose account value
        if (resolution.resolution_source === "ai_account") {
          const updateField: Record<string, any> = {};
          if (conflict.field_name === "employee_count") {
            updateField.employee_count = parseInt(resolution.resolved_value) || null;
          } else {
            updateField[conflict.field_name] = resolution.resolved_value;
          }

          await supabase
            .from("Leads")
            .update(updateField)
            .eq("org_id", org_id)
            .eq("id", conflict.lead_id);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        resolved: resolvedCount,
        total_conflicts: conflicts.length,
        auto_applied: auto_apply || false,
        resolutions: resolutions.map(r => ({
          conflict_id: r.conflict_id,
          resolved_value: r.resolved_value,
          confidence: r.ai_confidence,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error resolving conflicts:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
