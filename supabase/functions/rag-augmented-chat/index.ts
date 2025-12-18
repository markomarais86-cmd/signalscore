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

    const { org_id, user_id, message, conversation_history = [], source_types } = await req.json();

    if (!org_id || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "org_id and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[RAGAugmentedChat] Processing message for org: ${org_id}`);

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Search for relevant context using RAG
    const ragContext = await searchForContext(supabase, openaiApiKey, org_id, message, source_types);

    // Step 2: Build context-augmented prompt
    const contextText = ragContext.length > 0
      ? ragContext.map((doc: any, i: number) => 
          `[Source ${i + 1}: ${doc.source_type}]\n${doc.content.slice(0, 500)}`
        ).join("\n\n")
      : "No specific context found in your organization's data.";

    // Step 3: Get current pipeline metrics for additional context
    const pipelineContext = await getPipelineContext(supabase, org_id);

    // Step 4: Generate AI response with RAG context
    const systemPrompt = `You are an AI sales operations assistant for a revenue intelligence platform. 
You have access to the user's organization data including call transcripts, email threads, and notes.

CONTEXT FROM ORGANIZATION DATA:
${contextText}

CURRENT PIPELINE STATUS:
${pipelineContext}

Guidelines:
- Use the provided context to give specific, data-backed answers
- Reference specific documents or data points when relevant
- If you don't have enough context, say so and suggest what data would help
- Be concise but thorough
- Focus on actionable insights`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversation_history.slice(-10), // Last 10 messages for context
      { role: "user", content: message },
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.5,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate AI response");
    }

    const result = await response.json();
    const aiResponse = result.choices[0]?.message?.content || "I couldn't generate a response.";

    // Log the interaction
    if (user_id) {
      await supabase.from("ai_usage_tracking").insert({
        org_id,
        provider: "openai",
        model: "gpt-4o-mini",
        task_type: "rag_chat",
        tokens_input: result.usage?.prompt_tokens,
        tokens_output: result.usage?.completion_tokens,
        success: true,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        response: aiResponse,
        sources_used: ragContext.map((doc: any) => ({
          type: doc.source_type,
          id: doc.source_id,
          similarity: doc.similarity,
        })),
        tokens_used: result.usage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[RAGAugmentedChat] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function searchForContext(
  supabase: any, 
  openaiApiKey: string, 
  org_id: string, 
  query: string,
  source_types?: string[]
): Promise<any[]> {
  try {
    // Generate query embedding
    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: query,
      }),
    });

    if (!embeddingResponse.ok) {
      console.error("[RAGAugmentedChat] Failed to generate embedding");
      return [];
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Try RPC first, fall back to simple query
    const { data: results, error } = await supabase.rpc("search_embeddings", {
      query_embedding: `[${queryEmbedding.join(",")}]`,
      match_org_id: org_id,
      match_threshold: 0.6,
      match_count: 5,
      filter_source_types: source_types || null,
    });

    if (error || !results) {
      // Fallback: Simple keyword search
      let fallbackQuery = supabase
        .from("document_embeddings")
        .select("id, source_type, source_id, content")
        .eq("org_id", org_id)
        .limit(5);

      if (source_types && source_types.length > 0) {
        fallbackQuery = fallbackQuery.in("source_type", source_types);
      }

      const { data: fallbackResults } = await fallbackQuery;
      
      const queryTerms = query.toLowerCase().split(/\s+/);
      return (fallbackResults || [])
        .filter((doc: any) => {
          const contentLower = doc.content.toLowerCase();
          return queryTerms.some((term: string) => contentLower.includes(term));
        })
        .slice(0, 3);
    }

    return results || [];
  } catch (error) {
    console.error("[RAGAugmentedChat] Search error:", error);
    return [];
  }
}

async function getPipelineContext(supabase: any, org_id: string): Promise<string> {
  try {
    const { data: deals } = await supabase
      .from("deals")
      .select("stage, amount, status")
      .eq("org_id", org_id)
      .eq("status", "open");

    if (!deals || deals.length === 0) {
      return "No open deals in pipeline.";
    }

    const totalValue = deals.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
    const stageBreakdown: Record<string, number> = {};
    deals.forEach((d: any) => {
      stageBreakdown[d.stage] = (stageBreakdown[d.stage] || 0) + 1;
    });

    return `Open Deals: ${deals.length}, Total Pipeline: $${totalValue.toLocaleString()}
Stage Breakdown: ${Object.entries(stageBreakdown).map(([s, c]) => `${s}: ${c}`).join(", ")}`;
  } catch (error) {
    return "Pipeline data unavailable.";
  }
}
