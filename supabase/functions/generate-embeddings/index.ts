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

    const { org_id, source_type, source_id, content, metadata = {} } = await req.json();

    if (!org_id || !source_type || !content) {
      return new Response(
        JSON.stringify({ success: false, error: "org_id, source_type, and content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[GenerateEmbeddings] Creating embedding for ${source_type}:${source_id || 'new'}`);

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate embedding using OpenAI
    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: content.slice(0, 8000), // Limit content length
      }),
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      throw new Error(`Embedding generation failed: ${error}`);
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    // Check if embedding already exists for this source
    if (source_id) {
      const { data: existing } = await supabase
        .from("document_embeddings")
        .select("id")
        .eq("org_id", org_id)
        .eq("source_type", source_type)
        .eq("source_id", source_id)
        .single();

      if (existing) {
        // Update existing embedding
        const { data: updated, error: updateError } = await supabase
          .from("document_embeddings")
          .update({
            content,
            embedding: `[${embedding.join(",")}]`,
            metadata,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (updateError) throw updateError;

        return new Response(
          JSON.stringify({ success: true, embedding_id: updated.id, action: "updated" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Insert new embedding
    const { data: newEmbedding, error: insertError } = await supabase
      .from("document_embeddings")
      .insert({
        org_id,
        source_type,
        source_id,
        content,
        embedding: `[${embedding.join(",")}]`,
        metadata,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    console.log(`[GenerateEmbeddings] Created embedding: ${newEmbedding.id}`);

    return new Response(
      JSON.stringify({ success: true, embedding_id: newEmbedding.id, action: "created" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[GenerateEmbeddings] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
