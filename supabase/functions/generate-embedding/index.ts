import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmbeddingRequest {
  org_id: string;
  source_type: "account" | "lead" | "deal" | "note" | "call";
  source_id: string;
  content: string;
  metadata?: Record<string, any>;
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

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { org_id, source_type, source_id, content, metadata }: EmbeddingRequest = await req.json();

    if (!org_id || !source_type || !source_id || !content) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[GenerateEmbedding] Creating embedding for ${source_type}:${source_id}`);

    // Generate embedding
    const startTime = Date.now();
    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: content,
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!embeddingResponse.ok) {
      // Track provider health failure
      await supabase.rpc("update_ai_provider_health", {
        p_provider: "openai",
        p_success: false,
        p_latency_ms: latencyMs,
        p_error_message: `Embedding API error: ${embeddingResponse.status}`
      });

      throw new Error(`OpenAI API error: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    // Track provider health success
    await supabase.rpc("update_ai_provider_health", {
      p_provider: "openai",
      p_success: true,
      p_latency_ms: latencyMs
    });

    // Upsert embedding
    const { error } = await supabase
      .from("document_embeddings")
      .upsert({
        org_id,
        source_type,
        source_id,
        content,
        embedding: `[${embedding.join(",")}]`,
        metadata: metadata || {},
      }, { onConflict: "org_id,source_type,source_id" });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    console.log(`[GenerateEmbedding] Successfully created embedding (${latencyMs}ms)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        source_type,
        source_id,
        latency_ms: latencyMs 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[GenerateEmbedding] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
