import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

// ============= Configuration =============
const MAX_EXECUTION_MS = 44000;   // Stop before edge timeout (60s)
const BATCH_SIZE = 250;           // Accounts fetched per round
const WORKER_CHUNK = 25;          // Accounts per worker
const CONCURRENT_WORKERS = 5;     // Parallel worker calls
const HIGH_FIT_THRESHOLD = 70;    // Minimum score to trigger contact discovery

function nowMs() { return Date.now(); }

interface ContactDiscoveryConfig {
  enabled: boolean;
  target_titles: string[];
  max_contacts_per_account: number;
  min_fit_score: number;
}

async function getContactDiscoveryConfig(supabase: any, orgId: string): Promise<ContactDiscoveryConfig | null> {
  try {
    const { data, error } = await supabase
      .from("automation_settings")
      .select("*")
      .eq("org_id", orgId)
      .eq("setting_key", "contact_discovery")
      .single();

    if (error || !data || !data.enabled) {
      return null;
    }

    // Get persona config for target titles
    const { data: personaData } = await supabase
      .from("persona_config")
      .select("personas")
      .eq("org_id", orgId)
      .single();

    const targetTitles = personaData?.personas?.flatMap((p: any) => p.title_patterns || []) || [
      "CEO", "CTO", "CFO", "VP Sales", "VP Marketing", "Director"
    ];

    return {
      enabled: true,
      target_titles: targetTitles,
      max_contacts_per_account: 5,
      min_fit_score: HIGH_FIT_THRESHOLD
    };
  } catch (e) {
    console.log("[enrich-free-orchestrator] No contact discovery config found");
    return null;
  }
}

async function discoverContactsForAccount(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  account: any,
  config: ContactDiscoveryConfig,
  orgId: string
): Promise<{ success: boolean; contacts_found: number }> {
  try {
    // Get existing leads for this account to avoid duplicates
    const { data: existingLeads } = await supabase
      .from("Leads")
      .select("email")
      .eq("account_external_id", account.external_id)
      .eq("org_id", orgId);

    const excludeEmails = (existingLeads || [])
      .map((l: any) => l.email)
      .filter(Boolean);

    // Call agent-discover-contacts
    const response = await fetch(`${supabaseUrl}/functions/v1/agent-discover-contacts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company_name: account.name,
        company_domain: account.domain,
        company_linkedin_url: account.linkedin_url,
        target_titles: config.target_titles,
        org_id: orgId,
        max_contacts: config.max_contacts_per_account,
        exclude_emails: excludeEmails
      }),
    });

    if (!response.ok) {
      console.error(`[enrich-free-orchestrator] Contact discovery failed for ${account.name}: ${response.status}`);
      return { success: false, contacts_found: 0 };
    }

    const result = await response.json();
    
    if (!result.success || !result.contacts?.length) {
      return { success: true, contacts_found: 0 };
    }

    // Insert discovered contacts into Leads table
    const leadsToInsert = result.contacts.map((contact: any) => ({
      org_id: orgId,
      external_id: `discovered_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      first_name: contact.first_name,
      last_name: contact.last_name,
      name: `${contact.first_name} ${contact.last_name}`,
      email: contact.email || null,
      phone: contact.phone_number || contact.direct_phone || null,
      mobile: contact.cell_phone || null,
      title: contact.current_title,
      company: account.name,
      website: account.domain,
      industry: account.industry_norm || account.industry_raw,
      country: contact.country || account.country,
      state_province: contact.state_province,
      linkedin_url: contact.linkedin_url,
      account_external_id: account.external_id,
      status: "new",
      data_source: "ai_discovered",
      enrichment_confidence: contact.confidence === "high" ? 90 : contact.confidence === "medium" ? 70 : 50,
      enriched_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from("Leads")
      .insert(leadsToInsert);

    if (insertError) {
      console.error(`[enrich-free-orchestrator] Failed to insert discovered contacts:`, insertError);
      return { success: false, contacts_found: 0 };
    }

    console.log(`[enrich-free-orchestrator] Discovered ${leadsToInsert.length} contacts for ${account.name}`);
    return { success: true, contacts_found: leadsToInsert.length };
  } catch (e) {
    console.error(`[enrich-free-orchestrator] Contact discovery error for ${account.name}:`, e);
    return { success: false, contacts_found: 0 };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = nowMs();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { job_id, org_id, create_new = false, total_records = 0 } = await req.json();
    console.log(`[enrich-free-orchestrator] Starting job=${job_id}, org=${org_id}, create_new=${create_new}`);

    // Check for contact discovery configuration
    const contactDiscoveryConfig = await getContactDiscoveryConfig(supabase, org_id);
    if (contactDiscoveryConfig) {
      console.log(`[enrich-free-orchestrator] Contact discovery enabled with ${contactDiscoveryConfig.target_titles.length} target titles`);
    }

    // 1) Create or load job
    let job: any;
    
    if (create_new) {
      // Create a new job
      const { data: newJob, error: createError } = await supabase
        .from("enrichment_jobs")
        .insert({
          org_id,
          provider: "ai_free",
          job_type: "accounts",
          status: "processing",
          total_records,
          processed_records: 0,
          enriched_records: 0,
          failed_records: 0,
          started_at: new Date().toISOString(),
          source_breakdown: { ai: { attempted: 0, enriched: 0, failed: 0 }, contact_discovery: { accounts_processed: 0, contacts_found: 0 } },
        })
        .select()
        .single();

      if (createError || !newJob) {
        throw new Error(`Failed to create job: ${createError?.message || "Unknown error"}`);
      }
      job = newJob;
      console.log(`[enrich-free-orchestrator] Created new job: ${job.id}`);
    } else {
      // Load existing job
      const { data: existingJob, error: jobErr } = await supabase
        .from("enrichment_jobs")
        .select("*")
        .eq("id", job_id)
        .single();

      if (jobErr || !existingJob) {
        return new Response(
          JSON.stringify({ error: jobErr?.message || "Job not found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      job = existingJob;
    }

    const jobId = job.id;
    const jobOrgId = job.org_id;

    // 2) Mark as running
    await supabase.from("enrichment_jobs")
      .update({ status: "processing", error_message: null })
      .eq("id", jobId);

    // Aggregate metrics across all iterations
    let totalProcessed = job.processed_records || 0;
    let totalAccountsEnriched = job.accounts_enriched || 0;
    let totalFieldsEnriched = job.fields_enriched || 0;
    let totalEnriched = job.enriched_records || 0; // Legacy - accounts enriched
    let totalFailed = job.failed_records || 0;
    let lastCursor = job.cursor;
    let iterationsCompleted = 0;
    let contactsDiscovered = 0;
    let accountsWithContactDiscovery = 0;

    // Main processing loop - continues until timeout or done
    while (nowMs() - start < MAX_EXECUTION_MS) {
      // 3) Fetch next batch of accounts (cursor-based pagination)
      let query = supabase
        .from("accounts")
        .select("id, external_id, name, domain, industry_raw, industry_norm, employee_count, revenue_range, country, linkedin_url")
        .eq("org_id", jobOrgId)
        .order("id", { ascending: true })
        .limit(BATCH_SIZE);

      if (lastCursor) {
        query = query.gt("id", lastCursor);
      }

      const { data: accounts, error: accErr } = await query;
      
      if (accErr) {
        await supabase.from("enrichment_jobs")
          .update({ status: "failed", error_message: accErr.message })
          .eq("id", jobId);
        return new Response(
          JSON.stringify({ error: accErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // No more accounts - job complete
      if (!accounts || accounts.length === 0) {
        await supabase.from("enrichment_jobs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            processed_records: totalProcessed,
            accounts_enriched: totalAccountsEnriched,
            fields_enriched: totalFieldsEnriched,
            enriched_records: totalAccountsEnriched, // Legacy compat
            failed_records: totalFailed,
            source_breakdown: {
              launch_pulse: { attempted: totalProcessed, accounts_enriched: totalAccountsEnriched, fields_enriched: totalFieldsEnriched },
              contact_discovery: { accounts_processed: accountsWithContactDiscovery, contacts_found: contactsDiscovered }
            }
          })
          .eq("id", jobId);

        console.log(`[enrich-free-orchestrator] Job ${jobId} completed: ${totalAccountsEnriched} accounts (${totalFieldsEnriched} fields), ${contactsDiscovered} contacts discovered`);
        return new Response(
          JSON.stringify({ 
            status: "completed", 
            processed: totalProcessed, 
            accounts_enriched: totalAccountsEnriched,
            fields_enriched: totalFieldsEnriched,
            enriched: totalAccountsEnriched, // Legacy
            contacts_discovered: contactsDiscovered,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 4) Split into worker chunks
      const chunks: any[][] = [];
      for (let i = 0; i < accounts.length; i += WORKER_CHUNK) {
        chunks.push(accounts.slice(i, i + WORKER_CHUNK));
      }

      // 5) Process chunks with concurrent workers
      let batchProcessed = 0;
      let batchAccountsEnriched = 0;
      let batchFieldsEnriched = 0;
      let batchFailed = 0;
      const workerErrors: string[] = [];

      for (let i = 0; i < chunks.length; i += CONCURRENT_WORKERS) {
        // Check timeout before each worker group
        if (nowMs() - start > MAX_EXECUTION_MS) break;

        const group = chunks.slice(i, i + CONCURRENT_WORKERS);

        const results = await Promise.allSettled(
          group.map((chunk) =>
            supabase.functions.invoke("enrich-free-worker", {
              body: { org_id: jobOrgId, job_id: jobId, accounts: chunk },
            })
          )
        );

        for (const r of results) {
          if (r.status === "fulfilled" && !r.value.error && r.value.data) {
            batchProcessed += r.value.data.processed || 0;
            batchAccountsEnriched += r.value.data.accounts_enriched || r.value.data.enriched || 0;
            batchFieldsEnriched += r.value.data.fields_enriched || 0;
            batchFailed += r.value.data.failed || 0;
            if (r.value.data.errors) {
              workerErrors.push(...r.value.data.errors);
            }
          } else if (r.status === "rejected") {
            workerErrors.push(r.reason?.message || "Worker failed");
          } else if (r.value?.error) {
            workerErrors.push(r.value.error);
          }
        }
      }

      // 5.5) Contact Discovery for high-fit accounts (if enabled)
      if (contactDiscoveryConfig && nowMs() - start < MAX_EXECUTION_MS - 5000) {
        // Get scores for accounts in this batch
        const accountIds = accounts.map((a: any) => a.external_id);
        const { data: scores } = await supabase
          .from("scores")
          .select("account_external_id, overall")
          .eq("org_id", jobOrgId)
          .in("account_external_id", accountIds)
          .gte("overall", contactDiscoveryConfig.min_fit_score);

        const highFitAccounts = accounts.filter((a: any) => 
          scores?.some((s: any) => s.account_external_id === a.external_id)
        );

        // Process up to 3 high-fit accounts per batch (to avoid timeout)
        const accountsToDiscover = highFitAccounts.slice(0, 3);
        
        for (const account of accountsToDiscover) {
          if (nowMs() - start > MAX_EXECUTION_MS - 3000) break;

          const result = await discoverContactsForAccount(
            supabase,
            supabaseUrl,
            serviceKey,
            account,
            contactDiscoveryConfig,
            jobOrgId
          );

          if (result.success) {
            accountsWithContactDiscovery++;
            contactsDiscovered += result.contacts_found;
          }
        }
      }

      // 6) Update cursor and progress
      lastCursor = accounts[accounts.length - 1].id;
      totalProcessed += batchProcessed;
      totalAccountsEnriched += batchAccountsEnriched;
      totalFieldsEnriched += batchFieldsEnriched;
      totalEnriched = totalAccountsEnriched; // Keep legacy field in sync
      totalFailed += batchFailed;
      iterationsCompleted++;

      // Calculate ETR
      const elapsedMs = nowMs() - start + (job.started_at ? Date.now() - new Date(job.started_at).getTime() : 0);
      const ratePerMs = totalProcessed > 0 ? totalProcessed / elapsedMs : 0.001;
      const remaining = (job.total_records || totalProcessed) - totalProcessed;
      const etrMs = remaining / ratePerMs;
      const estimatedCompletion = new Date(Date.now() + etrMs).toISOString();

      // Update source breakdown with correct metrics
      const sourceBreakdown = {
        launch_pulse: {
          attempted: totalProcessed,
          accounts_enriched: totalAccountsEnriched,
          fields_enriched: totalFieldsEnriched,
          enriched: totalAccountsEnriched, // Legacy compat
          failed: totalFailed,
        },
        contact_discovery: {
          accounts_processed: accountsWithContactDiscovery,
          contacts_found: contactsDiscovered,
        }
      };

      // Checkpoint update with new metrics
      await supabase.from("enrichment_jobs")
        .update({
          cursor: lastCursor,
          processed_records: totalProcessed,
          accounts_enriched: totalAccountsEnriched,
          fields_enriched: totalFieldsEnriched,
          enriched_records: totalAccountsEnriched, // Legacy - keep in sync
          failed_records: totalFailed,
          source_breakdown: sourceBreakdown,
          estimated_completion_at: estimatedCompletion,
          error_message: workerErrors.length > 0 ? workerErrors.slice(0, 3).join("; ") : null,
        })
        .eq("id", jobId);

      console.log(`[enrich-free-orchestrator] Iteration ${iterationsCompleted}: accounts_enriched=${batchAccountsEnriched}, fields_enriched=${batchFieldsEnriched}, contacts_discovered=${contactsDiscovered}, cursor=${lastCursor}`);
    }

    // 7) Timeout reached - pause for resumption OR auto-continue
    const timeUp = nowMs() - start >= MAX_EXECUTION_MS;
    const hasMoreRecords = totalProcessed < (job.total_records || totalProcessed + 1);
    
    if (timeUp && hasMoreRecords) {
      await supabase.from("enrichment_jobs")
        .update({
          status: "paused",
          paused_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      console.log(`[enrich-free-orchestrator] Job ${jobId} paused at cursor ${lastCursor}, processed ${totalProcessed}`);

      // AUTO-CONTINUATION: Fire-and-forget call to continue the job
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        
        fetch(`${supabaseUrl}/functions/v1/enrich-free-orchestrator`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            job_id: jobId, 
            org_id: jobOrgId, 
            create_new: false 
          }),
        }).catch(err => console.error("[enrich-free-orchestrator] Auto-continue failed:", err));
        
        console.log(`[enrich-free-orchestrator] Auto-continuation triggered for job ${jobId}`);
      } catch (continueErr) {
        console.error("[enrich-free-orchestrator] Failed to trigger auto-continue:", continueErr);
      }
    }

    return new Response(
      JSON.stringify({
        status: timeUp ? "paused" : "processing",
        job_id: jobId,
        processed: totalProcessed,
        accounts_enriched: totalAccountsEnriched,
        fields_enriched: totalFieldsEnriched,
        enriched: totalAccountsEnriched, // Legacy
        failed: totalFailed,
        contacts_discovered: contactsDiscovered,
        cursor: lastCursor,
        iterations: iterationsCompleted,
        auto_continuing: timeUp && hasMoreRecords,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[enrich-free-orchestrator] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
