import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { org_id, action = "process_pending" } = await req.json();

    console.log(`[ProcessFollowUp] Action: ${action}, Org: ${org_id || "all"}`);

    switch (action) {
      case "process_pending":
        return await processPendingFollowUps(supabase, org_id);
      
      case "start_sequence":
        const { sequence_id, account_external_id, lead_id, deal_id } = await req.json();
        return await startSequence(supabase, org_id, sequence_id, account_external_id, lead_id, deal_id);
      
      case "cancel_sequence":
        const { follow_up_id } = await req.json();
        return await cancelSequence(supabase, follow_up_id);
      
      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("[ProcessFollowUp] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processPendingFollowUps(supabase: any, org_id?: string) {
  const now = new Date().toISOString();

  // Get pending follow-ups that are due
  let query = supabase
    .from("scheduled_follow_ups")
    .select(`
      *,
      follow_up_sequences (*)
    `)
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (org_id) {
    query = query.eq("org_id", org_id);
  }

  const { data: pendingFollowUps, error: fetchError } = await query;

  if (fetchError) {
    throw new Error(`Failed to fetch pending follow-ups: ${fetchError.message}`);
  }

  if (!pendingFollowUps || pendingFollowUps.length === 0) {
    return new Response(
      JSON.stringify({ success: true, processed: 0, message: "No pending follow-ups" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[ProcessFollowUp] Processing ${pendingFollowUps.length} follow-ups`);

  let processed = 0;
  let errors = 0;

  for (const followUp of pendingFollowUps) {
    try {
      const sequence = followUp.follow_up_sequences;
      if (!sequence || !sequence.steps) {
        await markFollowUpFailed(supabase, followUp.id, "Sequence not found or has no steps");
        errors++;
        continue;
      }

      const steps = sequence.steps as any[];
      const currentStep = followUp.current_step;

      if (currentStep >= steps.length) {
        // Sequence complete
        await supabase
          .from("scheduled_follow_ups")
          .update({ status: "completed", completed_at: now })
          .eq("id", followUp.id);
        processed++;
        continue;
      }

      const step = steps[currentStep];

      // Execute the step action
      await executeStepAction(supabase, followUp, step);

      // Schedule next step or complete
      if (currentStep + 1 < steps.length) {
        const nextStep = steps[currentStep + 1];
        const nextScheduledAt = new Date();
        nextScheduledAt.setDate(nextScheduledAt.getDate() + (nextStep.delay_days || 1));

        await supabase
          .from("scheduled_follow_ups")
          .update({
            current_step: currentStep + 1,
            scheduled_at: nextScheduledAt.toISOString(),
            status: "pending",
          })
          .eq("id", followUp.id);
      } else {
        await supabase
          .from("scheduled_follow_ups")
          .update({ status: "completed", completed_at: now })
          .eq("id", followUp.id);
      }

      processed++;
    } catch (error) {
      console.error(`[ProcessFollowUp] Error processing follow-up ${followUp.id}:`, error);
      await markFollowUpFailed(supabase, followUp.id, error instanceof Error ? error.message : "Unknown error");
      errors++;
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      processed,
      errors,
      total: pendingFollowUps.length,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function executeStepAction(supabase: any, followUp: any, step: any) {
  const { action_type, template } = step;

  switch (action_type) {
    case "email":
      // Generate and store email draft
      await generateFollowUpEmail(supabase, followUp, template);
      break;

    case "task":
      // Create a next best action
      await createFollowUpTask(supabase, followUp, template);
      break;

    case "call":
      // Create a call task
      await createCallTask(supabase, followUp, template);
      break;

    default:
      console.log(`[ProcessFollowUp] Unknown action type: ${action_type}`);
  }
}

async function generateFollowUpEmail(supabase: any, followUp: any, template: string) {
  const draftType = mapTemplateToDraftType(template);

  // Call the email draft generator
  const response = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-email-draft`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        org_id: followUp.org_id,
        account_external_id: followUp.account_external_id,
        lead_id: followUp.lead_id,
        deal_id: followUp.deal_id,
        draft_type: draftType,
        custom_instructions: `This is an automated follow-up email as part of a sequence. Template: ${template}`,
      }),
    }
  );

  if (!response.ok) {
    console.error("[ProcessFollowUp] Failed to generate email draft");
  }
}

async function createFollowUpTask(supabase: any, followUp: any, template: string) {
  const taskDescriptions: Record<string, { action_type: string; reasoning: string }> = {
    meeting_prep: {
      action_type: "task",
      reasoning: "Prepare for upcoming meeting - review account history and prepare talking points",
    },
    call_follow_up: {
      action_type: "call",
      reasoning: "Follow up call scheduled as part of nurture sequence",
    },
    meeting_recap: {
      action_type: "email",
      reasoning: "Send meeting recap with action items and next steps",
    },
  };

  const taskInfo = taskDescriptions[template] || {
    action_type: "task",
    reasoning: `Follow-up task: ${template}`,
  };

  await supabase.from("next_best_actions").insert({
    org_id: followUp.org_id,
    account_external_id: followUp.account_external_id,
    lead_id: followUp.lead_id?.toString(),
    deal_id: followUp.deal_id,
    action_type: taskInfo.action_type,
    priority: 2,
    reasoning: taskInfo.reasoning,
    suggested_content: { template, sequence_id: followUp.sequence_id },
    due_date: new Date().toISOString(),
    status: "pending",
  });
}

async function createCallTask(supabase: any, followUp: any, template: string) {
  await supabase.from("next_best_actions").insert({
    org_id: followUp.org_id,
    account_external_id: followUp.account_external_id,
    lead_id: followUp.lead_id?.toString(),
    deal_id: followUp.deal_id,
    action_type: "call",
    priority: 2,
    reasoning: `Scheduled follow-up call: ${template}`,
    due_date: new Date().toISOString(),
    status: "pending",
  });
}

function mapTemplateToDraftType(template: string): string {
  const mapping: Record<string, string> = {
    thank_you_demo: "follow_up",
    proposal_reminder: "follow_up",
    check_in: "check_in",
    value_add: "outreach",
    break_up: "check_in",
    meeting_reminder: "meeting_request",
    meeting_recap: "follow_up",
  };
  return mapping[template] || "follow_up";
}

async function markFollowUpFailed(supabase: any, id: string, error: string) {
  await supabase
    .from("scheduled_follow_ups")
    .update({ status: "failed", last_error: error })
    .eq("id", id);
}

async function startSequence(
  supabase: any,
  org_id: string,
  sequence_id: string,
  account_external_id?: string,
  lead_id?: number,
  deal_id?: string
) {
  // Get the sequence
  const { data: sequence, error: seqError } = await supabase
    .from("follow_up_sequences")
    .select("*")
    .eq("id", sequence_id)
    .eq("org_id", org_id)
    .single();

  if (seqError || !sequence) {
    return new Response(
      JSON.stringify({ success: false, error: "Sequence not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const steps = sequence.steps as any[];
  if (!steps || steps.length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: "Sequence has no steps" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Calculate first scheduled time
  const firstStep = steps[0];
  const scheduledAt = new Date();
  scheduledAt.setDate(scheduledAt.getDate() + (firstStep.delay_days || 0));

  // Create the scheduled follow-up
  const { data: followUp, error: insertError } = await supabase
    .from("scheduled_follow_ups")
    .insert({
      org_id,
      sequence_id,
      account_external_id,
      lead_id,
      deal_id,
      current_step: 0,
      scheduled_at: scheduledAt.toISOString(),
      status: "pending",
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to create follow-up: ${insertError.message}`);
  }

  return new Response(
    JSON.stringify({
      success: true,
      follow_up: followUp,
      message: `Sequence started. First action scheduled for ${scheduledAt.toLocaleDateString()}`,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function cancelSequence(supabase: any, follow_up_id: string) {
  const { error } = await supabase
    .from("scheduled_follow_ups")
    .update({ status: "cancelled" })
    .eq("id", follow_up_id);

  if (error) {
    throw new Error(`Failed to cancel sequence: ${error.message}`);
  }

  return new Response(
    JSON.stringify({ success: true, message: "Sequence cancelled" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
