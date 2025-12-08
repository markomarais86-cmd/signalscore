import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ActionRequest {
  action: string;
  parameters: Record<string, any>;
  org_id: string;
  user_id?: string;
}

// Helper to log actions
async function logAction(
  supabase: any,
  org_id: string,
  user_id: string | undefined,
  action_name: string,
  parameters: Record<string, any>,
  result: any,
  status: 'success' | 'failed',
  error_message?: string,
  execution_time_ms?: number
) {
  try {
    await supabase.from("ai_action_logs").insert({
      org_id,
      user_id,
      action_name,
      action_parameters: parameters,
      action_result: result,
      status,
      error_message,
      execution_time_ms,
    });
  } catch (e) {
    console.error("[AI-Actions] Failed to log action:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, parameters, org_id, user_id }: ActionRequest = await req.json();
    console.log(`[AI-Actions] Executing action: ${action}`, parameters);

    switch (action) {
      // ============================================================
      // TIER 1: ENHANCED SEARCH & DISCOVERY
      // ============================================================
      
      case "search_accounts": {
        const {
          // Multi-filter support
          job_titles = [],         // Array of titles to search
          personas = [],           // Array of personas (e.g., "Technical Decision Maker")
          industries = [],         // Array of industries
          countries = [],          // Array of countries
          tech_stack = [],         // Array of technologies
          // Range filters
          min_employees,
          max_employees,
          min_score,
          max_score,
          revenue_ranges = [],     // Array of revenue ranges
          // Funding filters
          funding_status = [],     // e.g., ["Series A", "Series B"]
          recently_funded_days,    // Accounts funded within X days
          // Other filters
          verified_email_only = false,
          icp_qualified_only = false,
          exclude_enriched = false,
          // Pagination
          limit = 25,
          offset = 0,
          // Legacy support
          industry,
          country,
          job_title,
        } = parameters;

        console.log(`[AI-Actions] Enhanced search_accounts:`, {
          job_titles, personas, industries, countries, tech_stack,
          min_employees, max_employees, min_score, revenue_ranges,
          funding_status, recently_funded_days, limit
        });

        // Normalize legacy params into arrays
        const normalizedTitles = job_title ? [job_title, ...job_titles] : job_titles;
        const normalizedIndustries = industry ? [industry, ...industries] : industries;
        const normalizedCountries = country ? [country, ...countries] : countries;

        let accounts: any[] = [];
        let totalCount = 0;

        // If searching by job titles or personas, query through Leads
        if (normalizedTitles.length > 0 || personas.length > 0) {
          let query = supabase
            .from("Leads")
            .select(`
              account_external_id,
              title,
              name,
              persona,
              email,
              email_verified,
              accounts!inner(
                external_id,
                name,
                domain,
                industry_norm,
                country,
                employee_count,
                revenue_range,
                tech_stack,
                last_funding_round,
                last_funding_date,
                icp_qualified,
                enriched_at
              )
            `, { count: 'exact' })
            .eq("org_id", org_id)
            .not("account_external_id", "is", null);

          // Title matching (OR across titles)
          if (normalizedTitles.length > 0) {
            const titleFilters = normalizedTitles.map(t => `title.ilike.%${t}%`).join(',');
            query = query.or(titleFilters);
          }

          // Persona matching
          if (personas.length > 0) {
            query = query.in("persona", personas);
          }

          // Industry filter on accounts
          if (normalizedIndustries.length > 0) {
            const industryFilters = normalizedIndustries.map(i => `accounts.industry_norm.ilike.%${i}%`).join(',');
            query = query.or(industryFilters);
          }

          // Country filter on accounts
          if (normalizedCountries.length > 0) {
            query = query.in("accounts.country", normalizedCountries);
          }

          // Tech stack filter
          if (tech_stack.length > 0) {
            query = query.contains("accounts.tech_stack", tech_stack);
          }

          // Employee range
          if (min_employees) {
            query = query.gte("accounts.employee_count", min_employees);
          }
          if (max_employees) {
            query = query.lte("accounts.employee_count", max_employees);
          }

          // ICP qualified filter
          if (icp_qualified_only) {
            query = query.eq("accounts.icp_qualified", true);
          }

          // Verified email filter
          if (verified_email_only) {
            query = query.eq("email_verified", true);
          }

          // Revenue ranges
          if (revenue_ranges.length > 0) {
            query = query.in("accounts.revenue_range", revenue_ranges);
          }

          // Funding status
          if (funding_status.length > 0) {
            query = query.in("accounts.last_funding_round", funding_status);
          }

          // Recently funded
          if (recently_funded_days) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - recently_funded_days);
            query = query.gte("accounts.last_funding_date", cutoffDate.toISOString().split('T')[0]);
          }

          const { data: leads, error, count } = await query.limit(limit * 3);

          if (error) {
            throw new Error(error.message);
          }

          totalCount = count || 0;

          // Dedupe and aggregate by account, then fetch scores
          const accountMap = new Map();
          for (const lead of leads || []) {
            const acct = lead.accounts;
            if (!acct) continue;

            if (!accountMap.has(acct.external_id)) {
              accountMap.set(acct.external_id, {
                external_id: acct.external_id,
                name: acct.name,
                domain: acct.domain,
                industry_norm: acct.industry_norm,
                country: acct.country,
                employee_count: acct.employee_count,
                revenue_range: acct.revenue_range,
                tech_stack: acct.tech_stack,
                last_funding_round: acct.last_funding_round,
                icp_qualified: acct.icp_qualified,
                matching_contacts: [],
              });
            }
            accountMap.get(acct.external_id).matching_contacts.push({
              name: lead.name,
              title: lead.title,
              persona: lead.persona,
              email_verified: lead.email_verified,
            });
          }

          // Get scores for matched accounts
          const accountIds = Array.from(accountMap.keys());
          if (accountIds.length > 0) {
            const { data: scores } = await supabase
              .from("scores")
              .select("account_external_id, overall, fit, intent")
              .eq("org_id", org_id)
              .in("account_external_id", accountIds);

            const scoreMap = new Map((scores || []).map(s => [s.account_external_id, s]));
            
            for (const [id, acct] of accountMap) {
              const score = scoreMap.get(id);
              acct.score = score?.overall || 0;
              acct.fit = score?.fit || 0;
              acct.intent = score?.intent || 0;
            }
          }

          // Apply score filter
          let filteredAccounts = Array.from(accountMap.values());
          if (min_score) {
            filteredAccounts = filteredAccounts.filter(a => a.score >= min_score);
          }
          if (max_score) {
            filteredAccounts = filteredAccounts.filter(a => a.score <= max_score);
          }

          // Sort by score descending
          accounts = filteredAccounts
            .sort((a, b) => b.score - a.score)
            .slice(offset, offset + limit);

        } else {
          // Standard account search without contact filters
          let query = supabase
            .from("accounts")
            .select(`
              external_id,
              name,
              domain,
              industry_norm,
              country,
              employee_count,
              revenue_range,
              tech_stack,
              last_funding_round,
              last_funding_date,
              icp_qualified,
              enriched_at,
              scores(overall, fit, intent)
            `, { count: 'exact' })
            .eq("org_id", org_id);

          // Industry filter
          if (normalizedIndustries.length > 0) {
            const industryFilters = normalizedIndustries.map(i => `industry_norm.ilike.%${i}%`).join(',');
            query = query.or(industryFilters);
          }

          // Country filter
          if (normalizedCountries.length > 0) {
            query = query.in("country", normalizedCountries);
          }

          // Tech stack filter
          if (tech_stack.length > 0) {
            query = query.contains("tech_stack", tech_stack);
          }

          // Employee range
          if (min_employees) {
            query = query.gte("employee_count", min_employees);
          }
          if (max_employees) {
            query = query.lte("employee_count", max_employees);
          }

          // Score filters
          if (min_score) {
            query = query.gte("scores.overall", min_score);
          }

          // ICP qualified
          if (icp_qualified_only) {
            query = query.eq("icp_qualified", true);
          }

          // Revenue ranges
          if (revenue_ranges.length > 0) {
            query = query.in("revenue_range", revenue_ranges);
          }

          // Funding status
          if (funding_status.length > 0) {
            query = query.in("last_funding_round", funding_status);
          }

          // Recently funded
          if (recently_funded_days) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - recently_funded_days);
            query = query.gte("last_funding_date", cutoffDate.toISOString().split('T')[0]);
          }

          // Exclude enriched
          if (exclude_enriched) {
            query = query.is("enriched_at", null);
          }

          const { data, error, count } = await query
            .order("name")
            .range(offset, offset + limit - 1);

          if (error) {
            throw new Error(error.message);
          }

          totalCount = count || 0;
          accounts = (data || []).map(a => ({
            ...a,
            score: a.scores?.[0]?.overall || 0,
            fit: a.scores?.[0]?.fit || 0,
            intent: a.scores?.[0]?.intent || 0,
          }));
        }

        // Build descriptive message
        const count = accounts.length;
        const filterParts: string[] = [];
        if (normalizedTitles.length > 0) filterParts.push(`with "${normalizedTitles.join('" or "')}" contacts`);
        if (personas.length > 0) filterParts.push(`persona: ${personas.join(", ")}`);
        if (normalizedIndustries.length > 0) filterParts.push(`in ${normalizedIndustries.join(", ")}`);
        if (normalizedCountries.length > 0) filterParts.push(`located in ${normalizedCountries.join(", ")}`);
        if (tech_stack.length > 0) filterParts.push(`using ${tech_stack.join(", ")}`);
        if (min_score) filterParts.push(`scoring ${min_score}+`);
        if (funding_status.length > 0) filterParts.push(`funding: ${funding_status.join(", ")}`);
        if (recently_funded_days) filterParts.push(`funded in last ${recently_funded_days} days`);

        const filterDesc = filterParts.length > 0 ? ` ${filterParts.join(", ")}` : "";

        let message = "";
        if (count === 0) {
          message = `No accounts found${filterDesc}.`;
        } else {
          const accountList = accounts.slice(0, 5).map(a => {
            const contacts = a.matching_contacts?.length || 0;
            const contactInfo = contacts > 0 ? ` (${contacts} matching contact${contacts > 1 ? 's' : ''})` : '';
            return `• **${a.name}** - Score: ${a.score}, ${a.industry_norm || 'Unknown industry'}${contactInfo}`;
          }).join("\n");

          message = `Found **${totalCount} account${totalCount > 1 ? 's' : ''}**${filterDesc}:\n\n${accountList}${totalCount > 5 ? `\n\n...and ${totalCount - 5} more.` : ""}`;
        }

        const result = { accounts, count, total: totalCount, message, filters_applied: filterParts };
        
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "search_contacts": {
        const {
          job_titles = [],
          personas = [],
          seniority_levels = [],
          departments = [],
          countries = [],
          verified_email_only = false,
          verified_phone_only = false,
          has_account = true,
          min_account_score,
          limit = 25,
          offset = 0,
        } = parameters;

        console.log(`[AI-Actions] search_contacts:`, { job_titles, personas, seniority_levels, limit });

        let query = supabase
          .from("Leads")
          .select(`
            id,
            name,
            first_name,
            last_name,
            title,
            persona,
            level,
            email,
            email_verified,
            phone,
            mobile,
            linkedin_url,
            country,
            account_external_id,
            accounts!left(name, industry_norm, country)
          `, { count: 'exact' })
          .eq("org_id", org_id);

        // Job title filter
        if (job_titles.length > 0) {
          const titleFilters = job_titles.map((t: string) => `title.ilike.%${t}%`).join(',');
          query = query.or(titleFilters);
        }

        // Persona filter
        if (personas.length > 0) {
          query = query.in("persona", personas);
        }

        // Seniority/level filter
        if (seniority_levels.length > 0) {
          query = query.in("level", seniority_levels);
        }

        // Country filter
        if (countries.length > 0) {
          query = query.in("country", countries);
        }

        // Verified email
        if (verified_email_only) {
          query = query.eq("email_verified", true);
        }

        // Has account
        if (has_account) {
          query = query.not("account_external_id", "is", null);
        }

        const { data: contacts, error, count } = await query
          .order("name")
          .range(offset, offset + limit - 1);

        if (error) {
          throw new Error(error.message);
        }

        // Filter by account score if needed
        let filteredContacts = contacts || [];
        if (min_account_score && filteredContacts.length > 0) {
          const accountIds = [...new Set(filteredContacts.map(c => c.account_external_id).filter(Boolean))];
          const { data: scores } = await supabase
            .from("scores")
            .select("account_external_id, overall")
            .eq("org_id", org_id)
            .in("account_external_id", accountIds)
            .gte("overall", min_account_score);

          const highScoreAccounts = new Set((scores || []).map(s => s.account_external_id));
          filteredContacts = filteredContacts.filter(c => highScoreAccounts.has(c.account_external_id));
        }

        const message = filteredContacts.length === 0
          ? "No contacts found matching your criteria."
          : `Found **${count} contact${(count || 0) > 1 ? 's' : ''}**:\n\n${filteredContacts.slice(0, 5).map(c =>
            `• **${c.name}** - ${c.title || 'No title'} at ${c.accounts?.name || 'Unknown company'}`
          ).join('\n')}${(count || 0) > 5 ? `\n\n...and ${(count || 0) - 5} more.` : ''}`;

        const result = { contacts: filteredContacts, count: filteredContacts.length, total: count, message };
        
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "find_similar_accounts": {
        const { account_id, similarity_factors = ['industry', 'size', 'location'], limit = 10 } = parameters;

        if (!account_id) {
          return new Response(JSON.stringify({ success: false, error: "account_id is required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get source account
        const { data: sourceAccount, error: sourceError } = await supabase
          .from("accounts")
          .select("*")
          .eq("org_id", org_id)
          .eq("external_id", account_id)
          .single();

        if (sourceError || !sourceAccount) {
          return new Response(JSON.stringify({ success: false, error: "Account not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Build query for similar accounts
        let query = supabase
          .from("accounts")
          .select(`
            external_id, name, domain, industry_norm, country, employee_count, revenue_range,
            scores(overall)
          `)
          .eq("org_id", org_id)
          .neq("external_id", account_id);

        if (similarity_factors.includes('industry') && sourceAccount.industry_norm) {
          query = query.eq("industry_norm", sourceAccount.industry_norm);
        }
        if (similarity_factors.includes('location') && sourceAccount.country) {
          query = query.eq("country", sourceAccount.country);
        }
        if (similarity_factors.includes('size') && sourceAccount.employee_count) {
          const minSize = Math.floor(sourceAccount.employee_count * 0.5);
          const maxSize = Math.ceil(sourceAccount.employee_count * 2);
          query = query.gte("employee_count", minSize).lte("employee_count", maxSize);
        }

        const { data: similarAccounts, error } = await query.limit(limit);

        if (error) {
          throw new Error(error.message);
        }

        const accounts = (similarAccounts || []).map(a => ({
          ...a,
          score: a.scores?.[0]?.overall || 0,
        }));

        const message = accounts.length === 0
          ? `No similar accounts found to ${sourceAccount.name}.`
          : `Found **${accounts.length} account${accounts.length > 1 ? 's' : ''}** similar to **${sourceAccount.name}**:\n\n${accounts.slice(0, 5).map(a =>
            `• **${a.name}** - ${a.industry_norm || 'Unknown'}, ${a.employee_count || '?'} employees, Score: ${a.score}`
          ).join('\n')}`;

        const result = { source_account: sourceAccount.name, accounts, count: accounts.length, message };
        
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "find_decision_makers": {
        const { account_id, personas = [], job_titles = [], limit = 10 } = parameters;

        if (!account_id) {
          return new Response(JSON.stringify({ success: false, error: "account_id is required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Default decision-maker titles if none specified
        const searchTitles = job_titles.length > 0 ? job_titles : 
          ['CEO', 'CTO', 'CFO', 'COO', 'CMO', 'CIO', 'CISO', 'VP', 'Director', 'Head of'];
        const searchPersonas = personas.length > 0 ? personas :
          ['Executive', 'Technical Decision Maker', 'Financial Decision Maker', 'IT Decision Maker'];

        let query = supabase
          .from("Leads")
          .select(`
            id, name, first_name, last_name, title, persona, level, email, email_verified,
            phone, linkedin_url
          `)
          .eq("org_id", org_id)
          .eq("account_external_id", account_id);

        // Title matching
        const titleFilters = searchTitles.map(t => `title.ilike.%${t}%`).join(',');
        query = query.or(titleFilters);

        const { data: contacts, error } = await query.limit(limit);

        if (error) {
          throw new Error(error.message);
        }

        const message = (contacts || []).length === 0
          ? `No decision makers found for this account.`
          : `Found **${contacts?.length} decision maker${(contacts?.length || 0) > 1 ? 's' : ''}**:\n\n${(contacts || []).map(c =>
            `• **${c.name}** - ${c.title}${c.email_verified ? ' ✓' : ''}`
          ).join('\n')}`;

        const result = { contacts, count: contacts?.length || 0, message };
        
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "search_by_tech_stack": {
        const { technologies = [], match_all = false, min_score, limit = 25 } = parameters;

        if (technologies.length === 0) {
          return new Response(JSON.stringify({ success: false, error: "At least one technology is required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let query = supabase
          .from("accounts")
          .select(`
            external_id, name, domain, industry_norm, country, employee_count, tech_stack,
            scores(overall)
          `, { count: 'exact' })
          .eq("org_id", org_id);

        if (match_all) {
          query = query.contains("tech_stack", technologies);
        } else {
          query = query.overlaps("tech_stack", technologies);
        }

        if (min_score) {
          query = query.gte("scores.overall", min_score);
        }

        const { data, error, count } = await query.limit(limit);

        if (error) {
          throw new Error(error.message);
        }

        const accounts = (data || []).map(a => ({
          ...a,
          score: a.scores?.[0]?.overall || 0,
          matched_tech: (a.tech_stack || []).filter((t: string) => 
            technologies.some((tech: string) => t.toLowerCase().includes(tech.toLowerCase()))
          ),
        }));

        const message = accounts.length === 0
          ? `No accounts found using ${technologies.join(", ")}.`
          : `Found **${count} account${(count || 0) > 1 ? 's' : ''}** using ${technologies.join(", ")}:\n\n${accounts.slice(0, 5).map(a =>
            `• **${a.name}** - Tech: ${a.matched_tech.join(', ')}, Score: ${a.score}`
          ).join('\n')}${(count || 0) > 5 ? `\n\n...and ${(count || 0) - 5} more.` : ''}`;

        const result = { accounts, count: accounts.length, total: count, technologies, message };
        
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "search_recently_funded": {
        const { days = 90, funding_rounds = [], min_amount, min_score, limit = 25 } = parameters;

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        let query = supabase
          .from("accounts")
          .select(`
            external_id, name, domain, industry_norm, country, employee_count,
            last_funding_round, last_funding_date, total_raised_usd,
            scores(overall)
          `, { count: 'exact' })
          .eq("org_id", org_id)
          .gte("last_funding_date", cutoffDate.toISOString().split('T')[0]);

        if (funding_rounds.length > 0) {
          query = query.in("last_funding_round", funding_rounds);
        }

        if (min_amount) {
          query = query.gte("total_raised_usd", min_amount);
        }

        if (min_score) {
          query = query.gte("scores.overall", min_score);
        }

        const { data, error, count } = await query
          .order("last_funding_date", { ascending: false })
          .limit(limit);

        if (error) {
          throw new Error(error.message);
        }

        const accounts = (data || []).map(a => ({
          ...a,
          score: a.scores?.[0]?.overall || 0,
        }));

        const message = accounts.length === 0
          ? `No accounts found with funding in the last ${days} days.`
          : `Found **${count} account${(count || 0) > 1 ? 's' : ''}** funded in the last ${days} days:\n\n${accounts.slice(0, 5).map(a =>
            `• **${a.name}** - ${a.last_funding_round || 'Unknown'} on ${a.last_funding_date}, Score: ${a.score}`
          ).join('\n')}${(count || 0) > 5 ? `\n\n...and ${(count || 0) - 5} more.` : ''}`;

        const result = { accounts, count: accounts.length, total: count, days, message };
        
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ============================================================
      // EXISTING ACTIONS (Enhanced)
      // ============================================================

      case "create_icp": {
        const { name, description, industries, company_sizes, revenue_ranges, geographies, persona_titles } = parameters;

        if (!name) {
          return new Response(JSON.stringify({ success: false, error: "ICP name is required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: icp, error: icpError } = await supabase
          .from("icp_profiles")
          .insert({
            org_id,
            name,
            description: description || `AI-generated ICP: ${name}`,
            industries: industries || [],
            company_sizes: company_sizes || [],
            revenue_ranges: revenue_ranges || [],
            geographies: geographies || [],
            persona_job_titles: persona_titles || [],
            status: "active",
          })
          .select()
          .single();

        if (icpError) {
          throw new Error(icpError.message);
        }

        await supabase.from("audit_logs").insert({
          org_id,
          actor: "ai-assistant",
          action: "icp_created_via_chat",
          meta: { icp_id: icp.id, icp_name: name },
        });

        const result = {
          icp_id: icp.id,
          name: icp.name,
          message: `Successfully created ICP "${name}". Navigate to ICP Manager to view and refine it.`
        };

        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "trigger_scoring": {
        const { icp_id } = parameters;

        let targetIcpId = icp_id;
        if (!targetIcpId) {
          const { data: activeIcp } = await supabase
            .from("icp_profiles")
            .select("id")
            .eq("org_id", org_id)
            .eq("status", "active")
            .limit(1)
            .single();
          targetIcpId = activeIcp?.id;
        }

        if (!targetIcpId) {
          return new Response(JSON.stringify({ success: false, error: "No active ICP found. Please create an ICP first." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: job, error: jobError } = await supabase
          .from("bulk_scoring_jobs")
          .insert({ org_id, icp_id: targetIcpId, status: "pending", total_accounts: 0 })
          .select()
          .single();

        if (jobError) {
          throw new Error(jobError.message);
        }

        const result = {
          job_id: job.id,
          message: "Bulk scoring job created. Check the Accounts page to monitor progress."
        };

        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_insights": {
        const [accountsResult, scoresResult, icpResult, leadsResult] = await Promise.all([
          supabase.from("accounts").select("id", { count: "exact", head: true }).eq("org_id", org_id),
          supabase.from("scores").select("overall").eq("org_id", org_id),
          supabase.from("icp_profiles").select("id, name, status").eq("org_id", org_id),
          supabase.from("Leads").select("id", { count: "exact", head: true }).eq("org_id", org_id),
        ]);

        const scores = scoresResult.data || [];
        const highFit = scores.filter(s => s.overall >= 70).length;
        const medFit = scores.filter(s => s.overall >= 40 && s.overall < 70).length;
        const lowFit = scores.filter(s => s.overall < 40).length;

        const result = {
          total_accounts: accountsResult.count || 0,
          total_leads: leadsResult.count || 0,
          scored_accounts: scores.length,
          high_fit: highFit,
          medium_fit: medFit,
          low_fit: lowFit,
          icps: icpResult.data || [],
        };

        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "cleanup_jobs": {
        const { data, error } = await supabase.rpc("cleanup_stuck_enrichment_jobs");

        if (error) {
          throw new Error(error.message);
        }

        const result = { cleaned_up: data || 0, message: `Cleaned up ${data || 0} stuck jobs.` };

        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        await logAction(supabase, org_id, user_id, action, parameters, null, 'failed', `Unknown action: ${action}`, Date.now() - startTime);
        
        return new Response(JSON.stringify({ success: false, error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("[AI-Actions] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
