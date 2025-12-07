import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are LaunchPulse AI, an intelligent assistant for a B2B sales intelligence platform. You help users with:

**Core Capabilities:**
- ICP (Ideal Customer Profile) creation and optimization
- Account scoring and prioritization
- Lead qualification and enrichment
- Campaign building and contact discovery
- Data analysis and insights

**Platform Context:**
- Users have accounts, leads, and ICP profiles
- Accounts are scored 0-100 based on ICP fit, intent, and reachability
- High-fit accounts (70+) are prioritized for campaigns
- Leads can be enriched with firmographic and contact data
- Contact discovery finds decision-makers at target accounts

**Response Guidelines:**
- Be concise and actionable
- Provide specific next steps when possible
- Reference platform features by name (ICP Manager, Campaign Builder, etc.)
- When asked about data, remind users to check the relevant page
- Format responses with markdown for clarity

**Current Features:**
1. Executive Dashboard - Overview metrics and insights
2. ICP Manager - Define and score ideal customer profiles
3. Accounts - View and filter scored accounts
4. Leads - Manage contacts and personas
5. Data Upload - Import CRM and CSV data
6. AI Agents - Automated enrichment and qualification
7. Settings - Integrations and configurations`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context-aware system prompt
    let contextualPrompt = SYSTEM_PROMPT;
    if (context?.currentPage) {
      contextualPrompt += `\n\n**User's Current Page:** ${context.currentPage}`;
    }
    if (context?.accountCount) {
      contextualPrompt += `\n**Accounts in System:** ${context.accountCount}`;
    }
    if (context?.highFitCount) {
      contextualPrompt += `\n**High-Fit Accounts:** ${context.highFitCount}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: contextualPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please contact support." }), 
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable" }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
