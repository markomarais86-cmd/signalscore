import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmbeddingRequest {
  org_id: string;
  source_type?: "account" | "lead" | "all";
  batch_size?: number;
  force_regenerate?: boolean;
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
      source_type = "all", 
      batch_size = 100,
      force_regenerate = false
    }: EmbeddingRequest = await req.json();

    if (!org_id) {
      return new Response(
        JSON.stringify({ success: false, error: "org_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[BulkEmbeddings] Starting for org: ${org_id}, type: ${source_type}, batch: ${batch_size}`);

    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalFailed = 0;

    // Process accounts
    if (source_type === "account" || source_type === "all") {
      const accountResult = await processAccounts(supabase, openaiApiKey, org_id, batch_size, force_regenerate);
      totalProcessed += accountResult.processed;
      totalSuccess += accountResult.success;
      totalFailed += accountResult.failed;
    }

    // Process leads
    if (source_type === "lead" || source_type === "all") {
      const leadResult = await processLeads(supabase, openaiApiKey, org_id, batch_size, force_regenerate);
      totalProcessed += leadResult.processed;
      totalSuccess += leadResult.success;
      totalFailed += leadResult.failed;
    }

    // Update AI provider health for OpenAI embeddings
    await supabase.rpc("update_ai_provider_health", {
      p_provider: "openai",
      p_success: totalSuccess > 0,
      p_latency_ms: null,
      p_error_message: totalFailed > 0 ? `${totalFailed} embeddings failed` : null
    });

    console.log(`[BulkEmbeddings] Complete: ${totalSuccess}/${totalProcessed} successful, ${totalFailed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        successful: totalSuccess,
        failed: totalFailed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[BulkEmbeddings] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processAccounts(
  supabase: any,
  openaiApiKey: string,
  org_id: string,
  batch_size: number,
  force_regenerate: boolean
): Promise<{ processed: number; success: number; failed: number }> {
  console.log("[BulkEmbeddings] Processing accounts...");

  // Get accounts that need embeddings
  const query = supabase
    .from("accounts")
    .select("external_id, name, domain, industry_norm, employee_count, revenue_range, city, state_province, country, business_model, tech_stack")
    .eq("org_id", org_id)
    .limit(batch_size);

  if (!force_regenerate) {
    // Get accounts that don't have embeddings yet
    const { data: existingEmbeddings } = await supabase
      .from("document_embeddings")
      .select("source_id")
      .eq("org_id", org_id)
      .eq("source_type", "account");

    const existingIds = new Set((existingEmbeddings || []).map((e: any) => e.source_id));
    
    const { data: accounts } = await query;
    const accountsToProcess = (accounts || []).filter((a: any) => !existingIds.has(a.external_id));
    
    return await generateEmbeddingsForAccounts(supabase, openaiApiKey, org_id, accountsToProcess);
  }

  const { data: accounts } = await query;
  return await generateEmbeddingsForAccounts(supabase, openaiApiKey, org_id, accounts || []);
}

async function generateEmbeddingsForAccounts(
  supabase: any,
  openaiApiKey: string,
  org_id: string,
  accounts: any[]
): Promise<{ processed: number; success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  // Process in batches of 20 for API rate limits
  const chunks = chunkArray(accounts, 20);

  for (const chunk of chunks) {
    const contents = chunk.map((account: any) => buildAccountContent(account));
    
    try {
      const embeddings = await generateEmbeddings(openaiApiKey, contents);
      
      // Insert embeddings
      const inserts = chunk.map((account: any, idx: number) => ({
        org_id,
        source_type: "account",
        source_id: account.external_id,
        content: contents[idx],
        embedding: `[${embeddings[idx].join(",")}]`,
        metadata: {
          name: account.name,
          domain: account.domain,
          industry: account.industry_norm,
        },
      }));

      // Upsert to handle duplicates
      const { error } = await supabase
        .from("document_embeddings")
        .upsert(inserts, { onConflict: "org_id,source_type,source_id" });

      if (error) {
        console.error("[BulkEmbeddings] Insert error:", error);
        failed += chunk.length;
      } else {
        success += chunk.length;
      }
    } catch (error) {
      console.error("[BulkEmbeddings] Embedding error:", error);
      failed += chunk.length;
    }

    // Rate limit delay
    await new Promise((r) => setTimeout(r, 200));
  }

  return { processed: accounts.length, success, failed };
}

async function processLeads(
  supabase: any,
  openaiApiKey: string,
  org_id: string,
  batch_size: number,
  force_regenerate: boolean
): Promise<{ processed: number; success: number; failed: number }> {
  console.log("[BulkEmbeddings] Processing leads...");

  const query = supabase
    .from("Leads")
    .select("id, first_name, last_name, name, title, company, location_city, location_region, seniority_level, department")
    .eq("org_id", org_id)
    .limit(batch_size);

  if (!force_regenerate) {
    const { data: existingEmbeddings } = await supabase
      .from("document_embeddings")
      .select("source_id")
      .eq("org_id", org_id)
      .eq("source_type", "lead");

    const existingIds = new Set((existingEmbeddings || []).map((e: any) => e.source_id));
    
    const { data: leads } = await query;
    const leadsToProcess = (leads || []).filter((l: any) => !existingIds.has(String(l.id)));
    
    return await generateEmbeddingsForLeads(supabase, openaiApiKey, org_id, leadsToProcess);
  }

  const { data: leads } = await query;
  return await generateEmbeddingsForLeads(supabase, openaiApiKey, org_id, leads || []);
}

async function generateEmbeddingsForLeads(
  supabase: any,
  openaiApiKey: string,
  org_id: string,
  leads: any[]
): Promise<{ processed: number; success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  const chunks = chunkArray(leads, 20);

  for (const chunk of chunks) {
    const contents = chunk.map((lead: any) => buildLeadContent(lead));
    
    try {
      const embeddings = await generateEmbeddings(openaiApiKey, contents);
      
      const inserts = chunk.map((lead: any, idx: number) => ({
        org_id,
        source_type: "lead",
        source_id: String(lead.id),
        content: contents[idx],
        embedding: `[${embeddings[idx].join(",")}]`,
        metadata: {
          name: lead.name || `${lead.first_name} ${lead.last_name}`.trim(),
          title: lead.title,
          company: lead.company,
        },
      }));

      const { error } = await supabase
        .from("document_embeddings")
        .upsert(inserts, { onConflict: "org_id,source_type,source_id" });

      if (error) {
        console.error("[BulkEmbeddings] Insert error:", error);
        failed += chunk.length;
      } else {
        success += chunk.length;
      }
    } catch (error) {
      console.error("[BulkEmbeddings] Embedding error:", error);
      failed += chunk.length;
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  return { processed: leads.length, success, failed };
}

function buildAccountContent(account: any): string {
  const parts = [];
  
  if (account.name) parts.push(`Company: ${account.name}`);
  if (account.domain) parts.push(`Domain: ${account.domain}`);
  if (account.industry_norm) parts.push(`Industry: ${account.industry_norm}`);
  if (account.employee_count) parts.push(`Size: ${account.employee_count} employees`);
  if (account.revenue_range) parts.push(`Revenue: ${account.revenue_range}`);
  if (account.business_model) parts.push(`Business Model: ${account.business_model}`);
  
  const location = [account.city, account.state_province, account.country].filter(Boolean).join(", ");
  if (location) parts.push(`Location: ${location}`);
  
  if (account.tech_stack && Array.isArray(account.tech_stack) && account.tech_stack.length > 0) {
    parts.push(`Tech Stack: ${account.tech_stack.join(", ")}`);
  }
  
  return parts.join("\n");
}

function buildLeadContent(lead: any): string {
  const parts = [];
  
  const name = lead.name || `${lead.first_name || ""} ${lead.last_name || ""}`.trim();
  if (name) parts.push(`Name: ${name}`);
  if (lead.title) parts.push(`Title: ${lead.title}`);
  if (lead.company) parts.push(`Company: ${lead.company}`);
  if (lead.seniority_level) parts.push(`Seniority: ${lead.seniority_level}`);
  if (lead.department) parts.push(`Department: ${lead.department}`);
  
  const location = [lead.location_city, lead.location_region].filter(Boolean).join(", ");
  if (location) parts.push(`Location: ${location}`);
  
  return parts.join("\n");
}

async function generateEmbeddings(openaiApiKey: string, contents: string[]): Promise<number[][]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: contents,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data.map((d: any) => d.embedding);
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
