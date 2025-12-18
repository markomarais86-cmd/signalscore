import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailDraftRequest {
  org_id: string;
  account_external_id?: string;
  lead_id?: number;
  deal_id?: string;
  draft_type: "outreach" | "follow_up" | "proposal" | "check_in" | "meeting_request" | "custom";
  custom_instructions?: string;
  tone?: "professional" | "friendly" | "urgent" | "casual";
  include_case_study?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const request: EmailDraftRequest = await req.json();
    const { org_id, account_external_id, lead_id, deal_id, draft_type, custom_instructions, tone = "professional", include_case_study = false } = request;

    if (!org_id) {
      return new Response(
        JSON.stringify({ success: false, error: "org_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[GenerateEmailDraft] Creating ${draft_type} email draft`);

    // Gather context
    const context = await gatherEmailContext(supabase, org_id, account_external_id, lead_id, deal_id);

    // Generate email using AI
    const draft = await generateEmailWithAI(context, draft_type, custom_instructions, tone, include_case_study);

    // Store the draft
    const { data: storedDraft, error: storeError } = await supabase
      .from("email_drafts")
      .insert({
        org_id,
        account_external_id,
        lead_id,
        deal_id,
        subject: draft.subject,
        body: draft.body,
        draft_type,
        context_used: context,
        ai_model: "gpt-4o-mini",
      })
      .select()
      .single();

    if (storeError) {
      console.error("[GenerateEmailDraft] Failed to store draft:", storeError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        draft: storedDraft || {
          subject: draft.subject,
          body: draft.body,
          draft_type,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[GenerateEmailDraft] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function gatherEmailContext(
  supabase: any,
  org_id: string,
  account_external_id?: string,
  lead_id?: number,
  deal_id?: string
): Promise<any> {
  const context: any = { org_id };

  // Get account info
  if (account_external_id) {
    const { data: account } = await supabase
      .from("accounts")
      .select("*")
      .eq("external_id", account_external_id)
      .eq("org_id", org_id)
      .single();
    context.account = account;
  }

  // Get lead/contact info
  if (lead_id) {
    const { data: lead } = await supabase
      .from("Leads")
      .select("*")
      .eq("id", lead_id)
      .single();
    context.lead = lead;
  }

  // Get deal info
  if (deal_id) {
    const { data: deal } = await supabase
      .from("deals")
      .select("*")
      .eq("id", deal_id)
      .single();
    context.deal = deal;
  }

  // Get recent activities
  if (account_external_id || deal_id) {
    const activityQuery = supabase
      .from("activities")
      .select("*")
      .eq("org_id", org_id)
      .order("activity_date", { ascending: false })
      .limit(5);

    if (account_external_id) {
      activityQuery.eq("account_external_id", account_external_id);
    } else if (deal_id) {
      activityQuery.eq("deal_id", deal_id);
    }

    const { data: activities } = await activityQuery;
    context.recent_activities = activities || [];
  }

  // Get recent call insights
  if (account_external_id) {
    const { data: calls } = await supabase
      .from("call_recordings")
      .select("id, call_type, recorded_at")
      .eq("org_id", org_id)
      .eq("account_external_id", account_external_id)
      .order("recorded_at", { ascending: false })
      .limit(3);

    if (calls && calls.length > 0) {
      const { data: insights } = await supabase
        .from("call_insights")
        .select("*")
        .in("call_id", calls.map((c: any) => c.id));
      context.call_insights = insights || [];
    }
  }

  // Get email thread history
  if (account_external_id) {
    const { data: threads } = await supabase
      .from("email_threads")
      .select("*")
      .eq("org_id", org_id)
      .eq("account_external_id", account_external_id)
      .order("last_message_at", { ascending: false })
      .limit(3);
    context.email_threads = threads || [];
  }

  return context;
}

async function generateEmailWithAI(
  context: any,
  draft_type: string,
  custom_instructions?: string,
  tone: string = "professional",
  include_case_study: boolean = false
): Promise<{ subject: string; body: string }> {
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

  if (!openaiApiKey) {
    return generateDefaultEmail(context, draft_type);
  }

  const contactName = context.lead?.first_name || context.lead?.["First Name"] || "there";
  const companyName = context.account?.name || context.lead?.Company || "your company";
  
  const contextSummary = buildContextSummary(context);

  const templateGuide = getTemplateGuide(draft_type);

  const prompt = `Generate a ${tone} sales email for the following context:

RECIPIENT: ${contactName} at ${companyName}
EMAIL TYPE: ${draft_type}
${custom_instructions ? `SPECIAL INSTRUCTIONS: ${custom_instructions}` : ""}

CONTEXT:
${contextSummary}

${templateGuide}

${include_case_study ? "Include a brief mention of a relevant case study or success story." : ""}

Generate a JSON response:
{
  "subject": "Email subject line (compelling, under 60 chars)",
  "body": "Email body (clear, actionable, includes greeting and signature placeholder)"
}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert sales copywriter. Write compelling, personalized sales emails. Always respond with valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 800,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      const content = result.choices[0]?.message?.content || "{}";
      try {
        return JSON.parse(content);
      } catch {
        return generateDefaultEmail(context, draft_type);
      }
    }
  } catch (error) {
    console.error("[GenerateEmailDraft] AI error:", error);
  }

  return generateDefaultEmail(context, draft_type);
}

function buildContextSummary(context: any): string {
  const parts: string[] = [];

  if (context.account) {
    parts.push(`Company: ${context.account.name}, Industry: ${context.account.industry_norm || "Unknown"}, Size: ${context.account.employee_count || "Unknown"} employees`);
  }

  if (context.deal) {
    parts.push(`Deal: ${context.deal.name}, Stage: ${context.deal.stage}, Value: $${context.deal.amount?.toLocaleString() || "TBD"}`);
  }

  if (context.call_insights && context.call_insights.length > 0) {
    const latestInsight = context.call_insights[0];
    parts.push(`Recent call: ${latestInsight.summary?.slice(0, 200) || "No summary"}`);
    if (latestInsight.next_steps) {
      parts.push(`Discussed next steps: ${latestInsight.next_steps}`);
    }
  }

  if (context.recent_activities && context.recent_activities.length > 0) {
    parts.push(`Last activity: ${context.recent_activities[0].activity_type} on ${new Date(context.recent_activities[0].activity_date).toLocaleDateString()}`);
  }

  return parts.join("\n") || "No specific context available.";
}

function getTemplateGuide(draft_type: string): string {
  const guides: Record<string, string> = {
    outreach: "This is a cold outreach email. Focus on value proposition and a soft call-to-action.",
    follow_up: "This is a follow-up to a previous conversation. Reference the prior interaction and move the conversation forward.",
    proposal: "This is a proposal-related email. Summarize key points and provide clear next steps.",
    check_in: "This is a check-in email. Be brief, show genuine interest, and offer to help.",
    meeting_request: "This is a meeting request. Be specific about the purpose and offer 2-3 time options.",
    custom: "Generate based on the provided instructions.",
  };
  return guides[draft_type] || guides.custom;
}

function generateDefaultEmail(context: any, draft_type: string): { subject: string; body: string } {
  const contactName = context.lead?.first_name || context.lead?.["First Name"] || "there";
  const companyName = context.account?.name || context.lead?.Company || "your company";

  const templates: Record<string, { subject: string; body: string }> = {
    outreach: {
      subject: `Quick question about ${companyName}`,
      body: `Hi ${contactName},

I noticed ${companyName} is doing great work in your industry. I'd love to share how we've helped similar companies achieve [specific result].

Would you be open to a brief 15-minute call to explore if there's a fit?

Best regards,
[Your Name]`,
    },
    follow_up: {
      subject: `Following up on our conversation`,
      body: `Hi ${contactName},

I wanted to follow up on our recent conversation. I hope you've had a chance to review the information I shared.

Do you have any questions I can help address? I'm happy to schedule a quick call to discuss next steps.

Best regards,
[Your Name]`,
    },
    check_in: {
      subject: `Checking in`,
      body: `Hi ${contactName},

I wanted to check in and see how things are going at ${companyName}. 

Is there anything I can help with? I'm always happy to be a resource.

Best regards,
[Your Name]`,
    },
    meeting_request: {
      subject: `Can we schedule a quick call?`,
      body: `Hi ${contactName},

I'd love to schedule a brief call to discuss how we might be able to help ${companyName}.

Would any of these times work for you?
- [Option 1]
- [Option 2]
- [Option 3]

Looking forward to connecting!

Best regards,
[Your Name]`,
    },
    proposal: {
      subject: `Proposal for ${companyName}`,
      body: `Hi ${contactName},

Thank you for your time discussing your needs. Based on our conversation, I've put together a proposal that addresses your key priorities.

Key highlights:
- [Point 1]
- [Point 2]
- [Point 3]

I'd love to walk you through the details. When would be a good time to connect?

Best regards,
[Your Name]`,
    },
  };

  return templates[draft_type] || templates.outreach;
}
