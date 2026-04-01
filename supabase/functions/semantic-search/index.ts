import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchRequest {
  org_id: string;
  query: string;
  source_types?: string[];
  limit?: number;
  threshold?: number;
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

    const { 
      org_id, 
      query, 
      source_types,
      limit = 10,
      threshold = 0.5
    }: SearchRequest = await req.json();

    if (!org_id || !query) {
      return new Response(
        JSON.stringify({ success: false, error: "org_id and query are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[SemanticSearch] Query: "${query}" for org: ${org_id}`);

    const startTime = Date.now();

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
      throw new Error(`OpenAI embedding error: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Search using vector similarity
    const { data: results, error } = await supabase.rpc("search_embeddings", {
      query_embedding: `[${queryEmbedding.join(",")}]`,
      match_org_id: org_id,
      match_threshold: threshold,
      match_count: limit,
      filter_source_types: source_types || null,
    });

    const latencyMs = Date.now() - startTime;

    if (error) {
      console.error("[SemanticSearch] RPC error:", error);
      
      // Fallback to keyword search
      let fallbackQuery = supabase
        .from("document_embeddings")
        .select("id, source_type, source_id, content, metadata")
        .eq("org_id", org_id)
        .limit(limit);

      if (source_types && source_types.length > 0) {
        fallbackQuery = fallbackQuery.in("source_type", source_types);
      }

      const { data: fallbackResults } = await fallbackQuery;
      
      const queryTerms = query.toLowerCase().split(/\s+/);
      const filteredResults = (fallbackResults || [])
        .filter((doc: any) => {
          const contentLower = doc.content.toLowerCase();
          return queryTerms.some((term: string) => contentLower.includes(term));
        })
        .slice(0, limit);

      return new Response(
        JSON.stringify({
          success: true,
          results: filteredResults.map((r: any) => ({
            ...r,
            similarity: 0.5, // Estimated for keyword match
          })),
          total: filteredResults.length,
          latency_ms: latencyMs,
          search_type: "keyword_fallback",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enrich results with actual record data
    const enrichedResults = await enrichSearchResults(supabase, org_id, results || []);

    // Track provider health
    await supabase.rpc("update_ai_provider_health", {
      p_provider: "openai",
      p_success: true,
      p_latency_ms: latencyMs
    });

    console.log(`[SemanticSearch] Found ${enrichedResults.length} results in ${latencyMs}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        results: enrichedResults,
        total: enrichedResults.length,
        latency_ms: latencyMs,
        search_type: "semantic",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SemanticSearch] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function enrichSearchResults(
  supabase: any,
  org_id: string,
  results: any[]
): Promise<any[]> {
  const enriched = [];

  for (const result of results) {
    const enrichedData = { ...result };

    if (result.source_type === "account") {
      const { data: account } = await supabase
        .from("accounts")
        .select("name, domain, industry_norm, employee_count, city, country")
        .eq("external_id", result.source_id)
        .eq("org_id", org_id)
        .single();

      if (account) {
        enrichedData.record = account;
      }
    } else if (result.source_type === "lead") {
      const { data: lead } = await supabase
        .from("Leads")
        .select("name, first_name, last_name, title, company, email")
        .eq("id", parseInt(result.source_id))
        .eq("org_id", org_id)
        .single();

      if (lead) {
        enrichedData.record = {
          ...lead,
          name: lead.name || `${lead.first_name || ""} ${lead.last_name || ""}`.trim(),
        };
      }
    }

    enriched.push(enrichedData);
  }

  return enriched;
}
