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

    const { org_id, query, source_types, limit = 5, similarity_threshold = 0.7 } = await req.json();

    if (!org_id || !query) {
      return new Response(
        JSON.stringify({ success: false, error: "org_id and query are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[RAGSearch] Searching for: "${query.slice(0, 50)}..." in org: ${org_id}`);

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      throw new Error("Failed to generate query embedding");
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Search for similar documents using cosine similarity
    // Note: This uses a raw SQL query for vector similarity search
    let searchQuery = `
      SELECT 
        id,
        source_type,
        source_id,
        content,
        metadata,
        1 - (embedding <=> $1::vector) as similarity
      FROM document_embeddings
      WHERE org_id = $2
        AND 1 - (embedding <=> $1::vector) > $3
    `;

    const params: any[] = [`[${queryEmbedding.join(",")}]`, org_id, similarity_threshold];

    if (source_types && source_types.length > 0) {
      searchQuery += ` AND source_type = ANY($4)`;
      params.push(source_types);
    }

    searchQuery += ` ORDER BY similarity DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const { data: results, error: searchError } = await supabase.rpc("search_embeddings", {
      query_embedding: `[${queryEmbedding.join(",")}]`,
      match_org_id: org_id,
      match_threshold: similarity_threshold,
      match_count: limit,
      filter_source_types: source_types || null,
    });

    // Fallback: If RPC doesn't exist, try direct query
    if (searchError?.message?.includes("function") || !results) {
      // Use simple text search as fallback
      let fallbackQuery = supabase
        .from("document_embeddings")
        .select("id, source_type, source_id, content, metadata")
        .eq("org_id", org_id)
        .limit(limit);

      if (source_types && source_types.length > 0) {
        fallbackQuery = fallbackQuery.in("source_type", source_types);
      }

      const { data: fallbackResults, error: fallbackError } = await fallbackQuery;

      if (fallbackError) throw fallbackError;

      // Simple keyword matching as fallback
      const queryTerms = query.toLowerCase().split(/\s+/);
      const scoredResults = (fallbackResults || [])
        .map((doc: any) => {
          const contentLower = doc.content.toLowerCase();
          const score = queryTerms.reduce((acc: number, term: string) => 
            acc + (contentLower.includes(term) ? 1 : 0), 0
          ) / queryTerms.length;
          return { ...doc, similarity: score };
        })
        .filter((doc: any) => doc.similarity > 0)
        .sort((a: any, b: any) => b.similarity - a.similarity)
        .slice(0, limit);

      return new Response(
        JSON.stringify({
          success: true,
          results: scoredResults,
          count: scoredResults.length,
          method: "keyword_fallback",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[RAGSearch] Found ${results?.length || 0} relevant documents`);

    return new Response(
      JSON.stringify({
        success: true,
        results: results || [],
        count: results?.length || 0,
        method: "vector_similarity",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[RAGSearch] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
