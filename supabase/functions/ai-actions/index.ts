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
        // Fetch multiple data points in parallel
        const [accountsResult, scoresResult, icpResult, leadsResult, enrichedResult] = await Promise.all([
          supabase.from("accounts").select("id, industry_norm, revenue_range, employee_count", { count: "exact" }).eq("org_id", org_id),
          supabase.from("scores").select("overall").eq("org_id", org_id),
          supabase.from("icp_profiles").select("id, name, status").eq("org_id", org_id),
          supabase.from("Leads").select("id, account_external_id", { count: "exact" }).eq("org_id", org_id),
          supabase.from("accounts").select("id").eq("org_id", org_id).not("enriched_at", "is", null),
        ]);

        const accounts = accountsResult.data || [];
        const scores = scoresResult.data || [];
        const highFit = scores.filter(s => s.overall >= 70).length;
        const medFit = scores.filter(s => s.overall >= 40 && s.overall < 70).length;
        const lowFit = scores.filter(s => s.overall < 40).length;

        // Calculate data quality metrics
        const totalAccounts = accountsResult.count || 0;
        const accountsWithIndustry = accounts.filter(a => a.industry_norm).length;
        const accountsWithRevenue = accounts.filter(a => a.revenue_range).length;
        const accountsWithSize = accounts.filter(a => a.employee_count).length;
        
        // Calculate accounts with contacts
        const accountsWithContacts = new Set((leadsResult.data || []).map(l => l.account_external_id).filter(Boolean)).size;
        
        const dataQuality = {
          completeness: totalAccounts > 0 ? Math.round(((accountsWithIndustry + accountsWithRevenue + accountsWithSize) / (totalAccounts * 3)) * 100) : 0,
          accounts_with_contacts: totalAccounts > 0 ? Math.round((accountsWithContacts / totalAccounts) * 100) : 0,
          accounts_with_industry: totalAccounts > 0 ? Math.round((accountsWithIndustry / totalAccounts) * 100) : 0,
          accounts_with_revenue: totalAccounts > 0 ? Math.round((accountsWithRevenue / totalAccounts) * 100) : 0,
        };

        // Generate smart recommendations
        const recommendations: string[] = [];
        if (dataQuality.completeness < 50) {
          recommendations.push("Data completeness is low. Consider enriching accounts to improve scoring accuracy.");
        }
        if (dataQuality.accounts_with_contacts < 30) {
          recommendations.push("Only " + dataQuality.accounts_with_contacts + "% of accounts have contacts. Run contact discovery for high-fit accounts.");
        }
        if (scores.length === 0 && totalAccounts > 0) {
          recommendations.push("No accounts are scored yet. Create an ICP and run bulk scoring.");
        }
        if (highFit > 0 && highFit < 10) {
          recommendations.push("You have " + highFit + " high-fit accounts. Consider expanding your ICP criteria for more opportunities.");
        }
        if (highFit > 100) {
          recommendations.push("You have " + highFit + " high-fit accounts ready for outreach. Prioritize by recency or intent signals.");
        }

        const result = {
          total_accounts: totalAccounts,
          total_leads: leadsResult.count || 0,
          scored_accounts: scores.length,
          high_fit: highFit,
          medium_fit: medFit,
          low_fit: lowFit,
          icps: icpResult.data || [],
          data_quality: dataQuality,
          recommendations: recommendations,
          message: `**Platform Overview:**\n\n• **${totalAccounts}** accounts • **${leadsResult.count || 0}** contacts\n• **${scores.length}** scored (${highFit} high-fit, ${medFit} medium, ${lowFit} low)\n• Data completeness: **${dataQuality.completeness}%**\n• Active ICPs: **${(icpResult.data || []).filter((i: any) => i.status === 'active').length}**${recommendations.length > 0 ? '\n\n**Recommendations:**\n' + recommendations.map(r => '• ' + r).join('\n') : ''}`,
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

      // ============================================================
      // TIER 2: ANALYTICS & INTELLIGENCE
      // ============================================================

      case "analyze_pipeline": {
        const { segment, date_range } = parameters;

        // Get score distribution
        const { data: scores, error: scoresError } = await supabase
          .from("scores")
          .select("account_external_id, overall, fit, intent")
          .eq("org_id", org_id);

        if (scoresError) throw new Error(scoresError.message);

        // Get accounts with scores for enrichment
        const { data: accounts } = await supabase
          .from("accounts")
          .select("external_id, industry_norm, country, employee_count")
          .eq("org_id", org_id);

        const accountMap = new Map((accounts || []).map(a => [a.external_id, a]));

        // Calculate distributions
        const highFit = (scores || []).filter(s => s.overall >= 70);
        const medFit = (scores || []).filter(s => s.overall >= 40 && s.overall < 70);
        const lowFit = (scores || []).filter(s => s.overall < 40);

        // Get contacts for high-fit accounts
        const highFitIds = highFit.map(s => s.account_external_id);
        const { data: contacts, count: contactCount } = await supabase
          .from("Leads")
          .select("id, account_external_id, email_verified, persona", { count: 'exact' })
          .eq("org_id", org_id)
          .in("account_external_id", highFitIds.slice(0, 100));

        const verifiedContacts = (contacts || []).filter(c => c.email_verified).length;
        const decisionMakers = (contacts || []).filter(c => 
          c.persona?.toLowerCase().includes('decision maker') || c.persona?.toLowerCase().includes('executive')
        ).length;

        // Build insights
        const insights = {
          total_scored: scores?.length || 0,
          high_fit_count: highFit.length,
          high_fit_percentage: scores?.length ? Math.round((highFit.length / scores.length) * 100) : 0,
          medium_fit_count: medFit.length,
          low_fit_count: lowFit.length,
          avg_score: scores?.length ? Math.round(scores.reduce((a, b) => a + b.overall, 0) / scores.length) : 0,
          high_fit_with_contacts: contactCount || 0,
          verified_contacts_in_high_fit: verifiedContacts,
          decision_makers_identified: decisionMakers,
          coverage_rate: highFit.length ? Math.round((new Set(contacts?.map(c => c.account_external_id)).size / highFit.length) * 100) : 0,
        };

        // Generate recommendations
        const recommendations: string[] = [];
        if (insights.coverage_rate < 50) {
          recommendations.push(`Only ${insights.coverage_rate}% of high-fit accounts have contacts. Consider enriching contacts.`);
        }
        if (verifiedContacts < decisionMakers) {
          recommendations.push(`${decisionMakers - verifiedContacts} decision makers lack verified emails. Prioritize email verification.`);
        }
        if (insights.high_fit_percentage < 20) {
          recommendations.push("Low high-fit rate. Consider refining your ICP criteria or expanding your target market.");
        }
        if (insights.high_fit_count > 0 && decisionMakers === 0) {
          recommendations.push("No decision makers identified in high-fit accounts. Run contact discovery.");
        }

        const message = `**Pipeline Analysis:**

• **${insights.total_scored}** total scored accounts
• **${insights.high_fit_count}** high-fit (${insights.high_fit_percentage}%) • ${insights.medium_fit_count} medium • ${insights.low_fit_count} low
• Average score: **${insights.avg_score}**
• High-fit accounts with contacts: **${insights.coverage_rate}%**
• Decision makers identified: **${decisionMakers}** (${verifiedContacts} with verified email)

${recommendations.length > 0 ? '\n**Recommendations:**\n' + recommendations.map(r => `• ${r}`).join('\n') : ''}`;

        const result = { insights, recommendations, message };
        
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "analyze_territory": {
        const { group_by = 'country' } = parameters;

        const { data: accounts, error } = await supabase
          .from("accounts")
          .select(`
            external_id, name, country, industry_norm, employee_count,
            scores(overall)
          `)
          .eq("org_id", org_id);

        if (error) throw new Error(error.message);

        // Group by selected dimension
        const grouped = new Map<string, { count: number; totalScore: number; highFit: number }>();
        
        for (const account of accounts || []) {
          const key = group_by === 'country' ? (account.country || 'Unknown') : (account.industry_norm || 'Unknown');
          const score = account.scores?.[0]?.overall || 0;
          
          if (!grouped.has(key)) {
            grouped.set(key, { count: 0, totalScore: 0, highFit: 0 });
          }
          const group = grouped.get(key)!;
          group.count++;
          group.totalScore += score;
          if (score >= 70) group.highFit++;
        }

        // Convert to sorted array
        const territories = Array.from(grouped.entries())
          .map(([name, data]) => ({
            name,
            count: data.count,
            avgScore: Math.round(data.totalScore / data.count),
            highFitCount: data.highFit,
            highFitRate: Math.round((data.highFit / data.count) * 100),
            opportunityScore: Math.round((data.highFit * data.avgScore) / 10), // Composite metric
          }))
          .sort((a, b) => b.opportunityScore - a.opportunityScore);

        // Identify insights
        const topTerritories = territories.slice(0, 5);
        const underserved = territories.filter(t => t.count >= 5 && t.highFitRate > 30 && t.count < 20);

        const message = `**Territory Analysis by ${group_by === 'country' ? 'Geography' : 'Industry'}:**

${topTerritories.map((t, i) => `${i + 1}. **${t.name}**: ${t.count} accounts, ${t.highFitCount} high-fit (${t.highFitRate}%), avg score: ${t.avgScore}`).join('\n')}

${underserved.length > 0 ? `\n**Underserved opportunities:**\n${underserved.slice(0, 3).map(t => `• ${t.name}: High potential (${t.highFitRate}% high-fit) but only ${t.count} accounts`).join('\n')}` : ''}`;

        const result = { territories, topTerritories, underserved, groupBy: group_by, message };
        
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "analyze_persona_coverage": {
        const { industry, country } = parameters;

        let query = supabase
          .from("Leads")
          .select(`
            id, persona, title, email_verified, account_external_id,
            accounts!inner(external_id, industry_norm, country)
          `)
          .eq("org_id", org_id)
          .not("account_external_id", "is", null);

        if (industry) {
          query = query.ilike("accounts.industry_norm", `%${industry}%`);
        }
        if (country) {
          query = query.eq("accounts.country", country);
        }

        const { data: contacts, error } = await query;
        if (error) throw new Error(error.message);

        // Get scores for these accounts
        const accountIds = [...new Set((contacts || []).map(c => c.account_external_id))];
        const { data: scores } = await supabase
          .from("scores")
          .select("account_external_id, overall")
          .eq("org_id", org_id)
          .in("account_external_id", accountIds);

        const scoreMap = new Map((scores || []).map(s => [s.account_external_id, s.overall]));
        const highFitAccounts = new Set(
          (scores || []).filter(s => s.overall >= 70).map(s => s.account_external_id)
        );

        // Analyze persona distribution
        const personaStats = new Map<string, { 
          count: number; 
          verified: number; 
          inHighFit: number; 
          accounts: Set<string>;
        }>();

        for (const contact of contacts || []) {
          const persona = contact.persona || 'Unknown';
          if (!personaStats.has(persona)) {
            personaStats.set(persona, { count: 0, verified: 0, inHighFit: 0, accounts: new Set() });
          }
          const stat = personaStats.get(persona)!;
          stat.count++;
          if (contact.email_verified) stat.verified++;
          if (highFitAccounts.has(contact.account_external_id)) stat.inHighFit++;
          stat.accounts.add(contact.account_external_id);
        }

        const personas = Array.from(personaStats.entries())
          .map(([name, data]) => ({
            name,
            count: data.count,
            verifiedCount: data.verified,
            verifiedRate: Math.round((data.verified / data.count) * 100),
            accountsCovered: data.accounts.size,
            inHighFitAccounts: data.inHighFit,
          }))
          .sort((a, b) => b.count - a.count);

        // Calculate coverage gaps
        const totalHighFit = highFitAccounts.size;
        const gaps = personas
          .filter(p => p.name !== 'Unknown')
          .map(p => ({
            persona: p.name,
            coverage: totalHighFit > 0 ? Math.round((p.inHighFitAccounts / totalHighFit) * 100) : 0,
            gap: totalHighFit - p.inHighFitAccounts,
          }))
          .filter(g => g.coverage < 50);

        const message = `**Persona Coverage Analysis:**

${personas.slice(0, 6).map(p => `• **${p.name}**: ${p.count} contacts across ${p.accountsCovered} accounts (${p.verifiedRate}% verified)`).join('\n')}

**High-fit account coverage:**
${personas.slice(0, 4).map(p => `• ${p.name}: ${p.inHighFitAccounts}/${totalHighFit} accounts (${totalHighFit > 0 ? Math.round((p.inHighFitAccounts/totalHighFit)*100) : 0}%)`).join('\n')}

${gaps.length > 0 ? `\n**Coverage gaps to address:**\n${gaps.slice(0, 3).map(g => `• ${g.persona}: Only ${g.coverage}% coverage (${g.gap} accounts missing)`).join('\n')}` : ''}`;

        const result = { personas, gaps, totalContacts: contacts?.length || 0, highFitAccounts: totalHighFit, message };
        
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_scoring_insights": {
        const { data: scores, error } = await supabase
          .from("scores")
          .select("account_external_id, overall, fit, intent, reachability, reasons")
          .eq("org_id", org_id);

        if (error) throw new Error(error.message);

        if (!scores || scores.length === 0) {
          return new Response(JSON.stringify({ 
            success: true, 
            action, 
            result: { message: "No scored accounts found. Run scoring first." } 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Score distribution histogram
        const distribution = {
          '0-20': scores.filter(s => s.overall < 20).length,
          '20-40': scores.filter(s => s.overall >= 20 && s.overall < 40).length,
          '40-60': scores.filter(s => s.overall >= 40 && s.overall < 60).length,
          '60-80': scores.filter(s => s.overall >= 60 && s.overall < 80).length,
          '80-100': scores.filter(s => s.overall >= 80).length,
        };

        // Component averages
        const avgOverall = Math.round(scores.reduce((a, b) => a + b.overall, 0) / scores.length);
        const avgFit = Math.round(scores.reduce((a, b) => a + (b.fit || 0), 0) / scores.length);
        const avgIntent = Math.round(scores.reduce((a, b) => a + (b.intent || 0), 0) / scores.length);
        const avgReachability = Math.round(scores.reduce((a, b) => a + (b.reachability || 0), 0) / scores.length);

        // Top scoring reasons (if available)
        const reasonCounts = new Map<string, number>();
        for (const score of scores) {
          if (score.reasons && typeof score.reasons === 'object') {
            for (const [key, value] of Object.entries(score.reasons as Record<string, unknown>)) {
              if (value === true) {
                reasonCounts.set(key, (reasonCounts.get(key) || 0) + 1);
              }
            }
          }
        }
        const topReasons = Array.from(reasonCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([reason, count]) => ({ reason, count, percentage: Math.round((count / scores.length) * 100) }));

        const message = `**Scoring Insights:**

**Distribution:**
${Object.entries(distribution).map(([range, count]) => `• ${range}: ${count} accounts (${Math.round((count/scores.length)*100)}%)`).join('\n')}

**Average Scores:**
• Overall: **${avgOverall}**
• Fit: ${avgFit} | Intent: ${avgIntent} | Reachability: ${avgReachability}

${topReasons.length > 0 ? `**Top scoring factors:**\n${topReasons.map(r => `• ${r.reason.replace(/_/g, ' ')}: ${r.percentage}% of accounts`).join('\n')}` : ''}`;

        const result = { 
          totalScored: scores.length, 
          distribution, 
          averages: { overall: avgOverall, fit: avgFit, intent: avgIntent, reachability: avgReachability },
          topReasons,
          message 
        };
        
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "compare_segments": {
        const { segment_a, segment_b } = parameters;

        if (!segment_a || !segment_b) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Both segment_a and segment_b are required. Example: segment_a: { industry: 'Technology' }, segment_b: { industry: 'Healthcare' }" 
          }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        async function getSegmentStats(segment: Record<string, any>) {
          let query = supabase
            .from("accounts")
            .select("external_id, name, industry_norm, country, employee_count, scores(overall)")
            .eq("org_id", org_id);

          if (segment.industry) query = query.ilike("industry_norm", `%${segment.industry}%`);
          if (segment.country) query = query.eq("country", segment.country);
          if (segment.min_employees) query = query.gte("employee_count", segment.min_employees);
          if (segment.max_employees) query = query.lte("employee_count", segment.max_employees);

          const { data, error } = await query;
          if (error) throw new Error(error.message);

          const accounts = data || [];
          const scores = accounts.map(a => a.scores?.[0]?.overall || 0);
          const highFit = scores.filter(s => s >= 70).length;

          return {
            count: accounts.length,
            avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
            highFitCount: highFit,
            highFitRate: accounts.length ? Math.round((highFit / accounts.length) * 100) : 0,
          };
        }

        const [statsA, statsB] = await Promise.all([
          getSegmentStats(segment_a),
          getSegmentStats(segment_b),
        ]);

        const labelA = segment_a.industry || segment_a.country || 'Segment A';
        const labelB = segment_b.industry || segment_b.country || 'Segment B';

        const message = `**Segment Comparison:**

| Metric | ${labelA} | ${labelB} |
|--------|----------|----------|
| Accounts | ${statsA.count} | ${statsB.count} |
| Avg Score | ${statsA.avgScore} | ${statsB.avgScore} |
| High-Fit | ${statsA.highFitCount} (${statsA.highFitRate}%) | ${statsB.highFitCount} (${statsB.highFitRate}%) |

**Insight:** ${statsA.highFitRate > statsB.highFitRate 
  ? `${labelA} has a ${statsA.highFitRate - statsB.highFitRate}% higher high-fit rate.`
  : statsB.highFitRate > statsA.highFitRate 
    ? `${labelB} has a ${statsB.highFitRate - statsA.highFitRate}% higher high-fit rate.`
    : 'Both segments have similar high-fit rates.'}`;

        const result = { 
          segment_a: { label: labelA, ...statsA },
          segment_b: { label: labelB, ...statsB },
          message 
        };
        
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ============================================================
      // TIER 3: RECOMMENDATIONS & INTELLIGENCE
      // ============================================================

      case "recommend_accounts": {
        const { count = 10, focus = 'high_fit' } = parameters;

        // Step 1: Fetch accounts separately (no nested select - no FK relationship exists)
        const { data: accounts, error: accountsError } = await supabase
          .from("accounts")
          .select("id, external_id, name, domain, industry_norm, country, employee_count, last_funding_round, last_funding_date")
          .eq("org_id", org_id);

        if (accountsError) throw new Error(accountsError.message);

        // Step 2: Fetch scores separately (join manually since no FK relationship)
        const { data: scores, error: scoresError } = await supabase
          .from("scores")
          .select("account_external_id, overall, fit, intent")
          .eq("org_id", org_id);

        if (scoresError) throw new Error(scoresError.message);

        // Step 3: Create a score lookup map
        const scoreMap = new Map<string, { overall: number; fit: number; intent: number }>();
        for (const s of scores || []) {
          scoreMap.set(s.account_external_id, { overall: s.overall || 0, fit: s.fit || 0, intent: s.intent || 0 });
        }

        // Step 4: Get contact counts per account
        const { data: contactCounts } = await supabase
          .from("Leads")
          .select("account_external_id")
          .eq("org_id", org_id)
          .not("account_external_id", "is", null);

        const contactMap = new Map<string, number>();
        for (const c of contactCounts || []) {
          contactMap.set(c.account_external_id, (contactMap.get(c.account_external_id) || 0) + 1);
        }

        // Step 5: Merge accounts with scores and rank - prioritize scored accounts first
        const scoredAccounts = (accounts || [])
          .filter(a => scoreMap.has(a.external_id))
          .map(a => {
            const score = scoreMap.get(a.external_id)!;
            const contactCount = contactMap.get(a.external_id) || 0;
            const recentFunding = a.last_funding_date && 
              new Date(a.last_funding_date) > new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
            
            let priority = score.overall;
            if (contactCount > 0) priority += 10;
            if (contactCount >= 3) priority += 10;
            if (recentFunding) priority += 15;
            if (score.intent >= 70) priority += 10;

            return {
              ...a,
              score: score.overall,
              fit: score.fit,
              intent: score.intent,
              contactCount,
              recentFunding,
              priority,
              reasoning: [
                `ICP score: ${score.overall}`,
                contactCount > 0 ? `${contactCount} contacts identified` : 'No contacts yet',
                recentFunding ? 'Recently funded' : null,
                score.intent >= 70 ? 'High intent signals' : null,
              ].filter(Boolean),
            };
          })
          .sort((a, b) => b.priority - a.priority)
          .slice(0, count);

        // Step 6: Fallback to unscored accounts if no scored accounts exist
        let rankedAccounts = scoredAccounts;
        let fallbackUsed = false;
        
        if (rankedAccounts.length === 0 && (accounts || []).length > 0) {
          fallbackUsed = true;
          rankedAccounts = (accounts || [])
            .slice(0, count)
            .map(a => ({
              ...a,
              score: 0,
              fit: 0,
              intent: 0,
              contactCount: contactMap.get(a.external_id) || 0,
              recentFunding: false,
              priority: 0,
              reasoning: ['Account not yet scored - run bulk scoring for ICP fit analysis'],
            }));
        }

        const message = rankedAccounts.length > 0
          ? `**Top ${rankedAccounts.length} Recommended Accounts:**\n\n${rankedAccounts.map((a, i) => 
              `${i + 1}. **${a.name}** (Score: ${a.score})\n   ${(a.reasoning as string[]).join(' • ')}`
            ).join('\n\n')}\n\n💡 These accounts are prioritized by ICP fit, contact availability, and buying signals.${fallbackUsed ? '\n\n⚠️ These accounts are not scored yet. Run bulk scoring for better recommendations.' : ''}`
          : `No accounts found. Please ensure accounts are imported into your organization.`;

        const result = { 
          accounts: rankedAccounts, 
          count: rankedAccounts.length, 
          message,
          totalAccounts: (accounts || []).length,
          scoredAccounts: scoreMap.size,
          fallbackUsed
        };
        
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "recommend_contacts": {
        const { count = 10, prioritize = 'decision_makers' } = parameters;

        // Get contacts with account scores
        const { data: contacts, error } = await supabase
          .from("Leads")
          .select(`
            id, name, title, persona, level, email, email_verified, linkedin_url,
            account_external_id,
            accounts!inner(name, industry_norm, scores(overall))
          `)
          .eq("org_id", org_id)
          .not("account_external_id", "is", null)
          .limit(500);

        if (error) throw new Error(error.message);

        // Score and rank contacts
        const rankedContacts = (contacts || [])
          .map(c => {
            const accountScore = c.accounts?.scores?.[0]?.overall || 0;
            const isDecisionMaker = c.persona?.toLowerCase().includes('decision maker') || 
              c.level?.toLowerCase().includes('c-level') || c.level?.toLowerCase().includes('vp');
            
            let priority = accountScore;
            if (c.email_verified) priority += 20;
            if (isDecisionMaker) priority += 25;
            if (c.linkedin_url) priority += 5;

            return {
              ...c,
              accountName: c.accounts?.name,
              accountScore,
              isDecisionMaker,
              priority,
            };
          })
          .sort((a, b) => b.priority - a.priority)
          .slice(0, count);

        const message = `**Top ${rankedContacts.length} Recommended Contacts:**

${rankedContacts.map((c, i) => `${i + 1}. **${c.name}** - ${c.title}
   At ${c.accountName} (Score: ${c.accountScore})${c.email_verified ? ' ✓ Verified' : ''}${c.isDecisionMaker ? ' 👑 DM' : ''}`).join('\n\n')}`;

        const result = { contacts: rankedContacts, count: rankedContacts.length, message };
        
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "suggest_icp_improvements": {
        // Analyze top-performing accounts to suggest ICP refinements
        const { data: topAccounts, error } = await supabase
          .from("accounts")
          .select(`
            external_id, industry_norm, country, employee_count, revenue_range, tech_stack,
            scores!inner(overall)
          `)
          .eq("org_id", org_id)
          .gte("scores.overall", 70)
          .limit(100);

        if (error) throw new Error(error.message);

        if (!topAccounts || topAccounts.length === 0) {
          return new Response(JSON.stringify({ 
            success: true, 
            action, 
            result: { message: "Not enough high-fit accounts to analyze. Score more accounts first." } 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Analyze patterns in high-fit accounts
        const industryCount = new Map<string, number>();
        const countryCount = new Map<string, number>();
        const sizeRanges = { small: 0, mid: 0, enterprise: 0 };
        const techCount = new Map<string, number>();

        for (const account of topAccounts) {
          if (account.industry_norm) {
            industryCount.set(account.industry_norm, (industryCount.get(account.industry_norm) || 0) + 1);
          }
          if (account.country) {
            countryCount.set(account.country, (countryCount.get(account.country) || 0) + 1);
          }
          if (account.employee_count) {
            if (account.employee_count < 100) sizeRanges.small++;
            else if (account.employee_count < 1000) sizeRanges.mid++;
            else sizeRanges.enterprise++;
          }
          for (const tech of account.tech_stack || []) {
            techCount.set(tech, (techCount.get(tech) || 0) + 1);
          }
        }

        const topIndustries = Array.from(industryCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const topCountries = Array.from(countryCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const topTech = Array.from(techCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

        const suggestions: string[] = [];
        
        if (topIndustries.length > 0) {
          const dominant = topIndustries[0];
          if (dominant[1] / topAccounts.length > 0.3) {
            suggestions.push(`Focus on ${dominant[0]} - ${Math.round((dominant[1]/topAccounts.length)*100)}% of your high-fit accounts are in this industry`);
          }
        }

        if (sizeRanges.mid > sizeRanges.small && sizeRanges.mid > sizeRanges.enterprise) {
          suggestions.push("Your sweet spot is mid-market companies (100-1000 employees)");
        }

        if (topTech.length > 0 && topTech[0][1] > topAccounts.length * 0.2) {
          suggestions.push(`Consider targeting companies using ${topTech.slice(0, 3).map(t => t[0]).join(', ')}`);
        }

        const message = `**ICP Improvement Suggestions** (based on ${topAccounts.length} high-fit accounts):

**Industry patterns:**
${topIndustries.map(([ind, count]) => `• ${ind}: ${count} accounts (${Math.round((count/topAccounts.length)*100)}%)`).join('\n')}

**Geography patterns:**
${topCountries.slice(0, 3).map(([country, count]) => `• ${country}: ${count} accounts`).join('\n')}

**Company size distribution:**
• Small (<100): ${sizeRanges.small} | Mid-market (100-1000): ${sizeRanges.mid} | Enterprise (1000+): ${sizeRanges.enterprise}

${topTech.length > 0 ? `**Common tech stack:**\n${topTech.map(([tech, count]) => `• ${tech}: ${count} accounts`).join('\n')}` : ''}

${suggestions.length > 0 ? `\n**💡 Recommendations:**\n${suggestions.map(s => `• ${s}`).join('\n')}` : ''}`;

        const result = { 
          analyzedAccounts: topAccounts.length,
          topIndustries,
          topCountries,
          sizeDistribution: sizeRanges,
          topTech,
          suggestions,
          message 
        };
        
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "identify_gaps": {
        const { focus = 'all' } = parameters;

        const gaps: Array<{ type: string; description: string; severity: 'high' | 'medium' | 'low'; action: string }> = [];

        // Check persona coverage
        const { data: contacts } = await supabase
          .from("Leads")
          .select("persona, email_verified, account_external_id")
          .eq("org_id", org_id);

        const { data: scores } = await supabase
          .from("scores")
          .select("account_external_id, overall")
          .eq("org_id", org_id);

        const highFitAccounts = new Set((scores || []).filter(s => s.overall >= 70).map(s => s.account_external_id));
        const accountsWithContacts = new Set((contacts || []).map(c => c.account_external_id));
        const accountsWithVerified = new Set((contacts || []).filter(c => c.email_verified).map(c => c.account_external_id));

        // Gap: High-fit accounts without contacts
        const noContactCount = [...highFitAccounts].filter(a => !accountsWithContacts.has(a)).length;
        if (noContactCount > 0) {
          gaps.push({
            type: 'contact_coverage',
            description: `${noContactCount} high-fit accounts have no contacts identified`,
            severity: noContactCount > 10 ? 'high' : 'medium',
            action: 'Run contact discovery on high-fit accounts',
          });
        }

        // Gap: Contacts without verified emails
        const noVerifiedCount = [...highFitAccounts].filter(a => accountsWithContacts.has(a) && !accountsWithVerified.has(a)).length;
        if (noVerifiedCount > 0) {
          gaps.push({
            type: 'email_verification',
            description: `${noVerifiedCount} accounts with contacts lack verified emails`,
            severity: noVerifiedCount > 20 ? 'high' : 'medium',
            action: 'Verify emails for contacts in these accounts',
          });
        }

        // Gap: No decision makers
        const dmPersonas = ['Executive', 'Technical Decision Maker', 'Financial Decision Maker'];
        const accountsWithDM = new Set((contacts || []).filter(c => 
          dmPersonas.some(p => c.persona?.includes(p))
        ).map(c => c.account_external_id));

        const noDMCount = [...highFitAccounts].filter(a => !accountsWithDM.has(a)).length;
        if (noDMCount > 0) {
          gaps.push({
            type: 'decision_maker',
            description: `${noDMCount} high-fit accounts lack identified decision makers`,
            severity: noDMCount > 5 ? 'high' : 'medium',
            action: 'Search for executive contacts at these accounts',
          });
        }

        // Gap: Unscored accounts
        const { count: totalAccounts } = await supabase
          .from("accounts")
          .select("id", { count: 'exact', head: true })
          .eq("org_id", org_id);

        const unscoredCount = (totalAccounts || 0) - (scores?.length || 0);
        if (unscoredCount > 0) {
          gaps.push({
            type: 'scoring',
            description: `${unscoredCount} accounts haven't been scored yet`,
            severity: unscoredCount > 100 ? 'high' : 'low',
            action: 'Run bulk scoring to prioritize all accounts',
          });
        }

        const message = `**Gap Analysis:**

${gaps.length === 0 ? '✅ No significant gaps identified!' : gaps.map(g => `
**${g.severity.toUpperCase()}:** ${g.description}
→ Action: ${g.action}`).join('\n')}`;

        const result = { gaps, highFitCount: highFitAccounts.size, message };
        
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "surface_opportunities": {
        const { types = ['recently_funded', 'score_increase', 'new_contacts'] } = parameters;

        const opportunities: Array<{ type: string; accounts: any[]; message: string }> = [];

        // Recently funded high-fit accounts
        if (types.includes('recently_funded')) {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 90);

          const { data: funded } = await supabase
            .from("accounts")
            .select("external_id, name, last_funding_round, last_funding_date, scores(overall)")
            .eq("org_id", org_id)
            .gte("last_funding_date", cutoff.toISOString().split('T')[0])
            .gte("scores.overall", 50)
            .limit(10);

          if (funded && funded.length > 0) {
            opportunities.push({
              type: 'recently_funded',
              accounts: funded.map(a => ({ ...a, score: a.scores?.[0]?.overall })),
              message: `${funded.length} high-fit accounts received funding in the last 90 days`,
            });
          }
        }

        // Accounts with new contacts (recently enriched)
        if (types.includes('new_contacts')) {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 30);

          const { data: newContacts } = await supabase
            .from("Leads")
            .select("account_external_id, accounts!inner(name, scores(overall))")
            .eq("org_id", org_id)
            .gte("created_at", cutoff.toISOString())
            .limit(50);

          const accountsWithNew = new Map<string, { name: string; score: number; newContacts: number }>();
          for (const c of newContacts || []) {
            const existing = accountsWithNew.get(c.account_external_id);
            if (existing) {
              existing.newContacts++;
            } else {
              accountsWithNew.set(c.account_external_id, {
                name: c.accounts?.name || 'Unknown',
                score: c.accounts?.scores?.[0]?.overall || 0,
                newContacts: 1,
              });
            }
          }

          const sorted = Array.from(accountsWithNew.entries())
            .map(([id, data]) => ({ external_id: id, ...data }))
            .filter(a => a.score >= 50)
            .sort((a, b) => b.newContacts - a.newContacts)
            .slice(0, 10);

          if (sorted.length > 0) {
            opportunities.push({
              type: 'new_contacts',
              accounts: sorted,
              message: `${sorted.length} high-fit accounts have new contacts from the last 30 days`,
            });
          }
        }

        const message = opportunities.length === 0
          ? "No new opportunities identified at this time."
          : `**🎯 Opportunities Identified:**\n\n${opportunities.map(o => `**${o.type.replace(/_/g, ' ').toUpperCase()}**\n${o.message}\n${o.accounts.slice(0, 3).map(a => `• ${a.name} (Score: ${a.score})`).join('\n')}`).join('\n\n')}`;

        const result = { opportunities, message };
        
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ============================================================
      // TIER 5: MULTI-STEP WORKFLOWS
      // ============================================================

      case "build_target_list": {
        const { industries, countries, min_score, job_titles, tech_stack, top_count, focus, limit } = parameters;

        // Start workflow via orchestrator
        const response = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-orchestrator`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: req.headers.get("Authorization") || "",
            },
            body: JSON.stringify({
              action: "start_workflow",
              workflow_type: "build_target_list",
              workflow_name: "Build Target List",
              parameters: { industries, countries, min_score, job_titles, tech_stack, top_count, focus, limit },
              org_id,
              user_id,
            }),
          }
        );

        const workflowResult = await response.json();

        await logAction(supabase, org_id, user_id, action, parameters, workflowResult, 
          workflowResult.success ? 'success' : 'failed', 
          workflowResult.error, 
          Date.now() - startTime);

        return new Response(JSON.stringify({ 
          success: workflowResult.success, 
          action, 
          result: {
            ...workflowResult,
            isWorkflow: true,
            workflowType: 'build_target_list',
          }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "audit_data_quality": {
        const response = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-orchestrator`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: req.headers.get("Authorization") || "",
            },
            body: JSON.stringify({
              action: "start_workflow",
              workflow_type: "audit_data_quality",
              workflow_name: "Data Quality Audit",
              parameters: {},
              org_id,
              user_id,
            }),
          }
        );

        const workflowResult = await response.json();

        await logAction(supabase, org_id, user_id, action, parameters, workflowResult, 
          workflowResult.success ? 'success' : 'failed', 
          workflowResult.error, 
          Date.now() - startTime);

        return new Response(JSON.stringify({ 
          success: workflowResult.success, 
          action, 
          result: {
            ...workflowResult,
            isWorkflow: true,
            workflowType: 'audit_data_quality',
          }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "prepare_campaign": {
        const { industries, countries, min_score, job_titles, personas, account_limit, contact_limit } = parameters;

        const response = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-orchestrator`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: req.headers.get("Authorization") || "",
            },
            body: JSON.stringify({
              action: "start_workflow",
              workflow_type: "prepare_campaign",
              workflow_name: "Prepare Campaign",
              parameters: { industries, countries, min_score, job_titles, personas, account_limit, contact_limit },
              org_id,
              user_id,
            }),
          }
        );

        const workflowResult = await response.json();

        await logAction(supabase, org_id, user_id, action, parameters, workflowResult, 
          workflowResult.success ? 'success' : 'failed', 
          workflowResult.error, 
          Date.now() - startTime);

        return new Response(JSON.stringify({ 
          success: workflowResult.success, 
          action, 
          result: {
            ...workflowResult,
            isWorkflow: true,
            workflowType: 'prepare_campaign',
          }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "optimize_icp": {
        const response = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-orchestrator`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: req.headers.get("Authorization") || "",
            },
            body: JSON.stringify({
              action: "start_workflow",
              workflow_type: "optimize_icp",
              workflow_name: "Optimize ICP",
              parameters: {},
              org_id,
              user_id,
            }),
          }
        );

        const workflowResult = await response.json();

        await logAction(supabase, org_id, user_id, action, parameters, workflowResult, 
          workflowResult.success ? 'success' : 'failed', 
          workflowResult.error, 
          Date.now() - startTime);

        return new Response(JSON.stringify({ 
          success: workflowResult.success, 
          action, 
          result: {
            ...workflowResult,
            isWorkflow: true,
            workflowType: 'optimize_icp',
          }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ============================================================
      // TIER 6: EXECUTION ACTIONS
      // ============================================================

      case "enrich_accounts": {
        const { 
          account_ids = [], 
          enrichment_type = 'firmographics',
          provider = 'auto',
          priority = 'normal'
        } = parameters;

        if (account_ids.length === 0) {
          throw new Error("account_ids is required");
        }

        console.log(`[AI-Actions] enrich_accounts: ${account_ids.length} accounts, type: ${enrichment_type}`);

        // Create enrichment job
        const { data: job, error: jobError } = await supabase
          .from("enrichment_jobs")
          .insert({
            org_id,
            created_by: user_id,
            job_type: enrichment_type,
            provider: provider === 'auto' ? 'hybrid' : provider,
            status: 'pending',
            total_records: account_ids.length,
            processed_records: 0,
            filter_criteria: { account_ids },
          })
          .select()
          .single();

        if (jobError) throw new Error(jobError.message);

        // Trigger the enrichment function asynchronously
        fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/enrich-accounts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: req.headers.get("Authorization") || "",
            },
            body: JSON.stringify({
              job_id: job.id,
              account_ids,
              provider: provider === 'auto' ? 'hybrid' : provider,
            }),
          }
        ).catch(err => console.error("Enrichment trigger failed:", err));

        const message = `**Enrichment Started** 🔄\n\nEnriching **${account_ids.length} account${account_ids.length > 1 ? 's' : ''}** with ${enrichment_type} data.\n\nJob ID: \`${job.id}\`\nEstimated time: ~${Math.ceil(account_ids.length / 10)} minutes`;

        const result = {
          job_id: job.id,
          accounts_queued: account_ids.length,
          enrichment_type,
          provider,
          message,
          isExecution: true,
        };

        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "enrich_contacts": {
        const { 
          account_ids = [],
          personas = [],
          max_per_account = 5,
          verified_only = false
        } = parameters;

        if (account_ids.length === 0) {
          throw new Error("account_ids is required");
        }

        console.log(`[AI-Actions] enrich_contacts: ${account_ids.length} accounts, personas: ${personas.join(', ')}`);

        // Create contact enrichment job
        const { data: job, error: jobError } = await supabase
          .from("enrichment_jobs")
          .insert({
            org_id,
            created_by: user_id,
            job_type: 'contact_discovery',
            provider: 'hybrid',
            status: 'pending',
            total_records: account_ids.length,
            processed_records: 0,
            filter_criteria: { account_ids, personas, max_per_account, verified_only },
            target_titles: personas,
          })
          .select()
          .single();

        if (jobError) throw new Error(jobError.message);

        // Trigger enrichment asynchronously
        fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/enrich-contacts-bulk`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: req.headers.get("Authorization") || "",
            },
            body: JSON.stringify({
              jobId: job.id,
              orgId: org_id,
              batchSize: 50,
            }),
          }
        ).catch(err => console.error("Contact enrichment trigger failed:", err));

        const expectedContacts = account_ids.length * max_per_account;
        const message = `**Contact Discovery Started** 👥\n\nDiscovering contacts for **${account_ids.length} account${account_ids.length > 1 ? 's' : ''}**.\n\nTarget personas: ${personas.length > 0 ? personas.join(', ') : 'All'}\nMax per account: ${max_per_account}\nEstimated contacts: ~${expectedContacts}`;

        const result = {
          job_id: job.id,
          accounts_queued: account_ids.length,
          expected_contacts: expectedContacts,
          personas,
          message,
          isExecution: true,
        };

        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "export_list": {
        const {
          type = 'accounts',
          filters = {},
          columns = [],
          format = 'csv',
          include_contacts = false
        } = parameters;

        console.log(`[AI-Actions] export_list: type=${type}, format=${format}`);

        let records: any[] = [];
        let exportColumns = columns.length > 0 ? columns : undefined;

        if (type === 'accounts') {
          let query = supabase
            .from("accounts")
            .select(`
              external_id, name, domain, industry_norm, country, employee_count, 
              revenue_range, tech_stack, icp_qualified, enriched_at,
              scores(overall, fit, intent)
            `)
            .eq("org_id", org_id);

          if (filters.min_score) {
            query = query.gte("scores.overall", filters.min_score);
          }
          if (filters.industries?.length > 0) {
            query = query.in("industry_norm", filters.industries);
          }
          if (filters.countries?.length > 0) {
            query = query.in("country", filters.countries);
          }
          if (filters.account_ids?.length > 0) {
            query = query.in("external_id", filters.account_ids);
          }

          const { data, error } = await query.limit(10000);
          if (error) throw new Error(error.message);

          records = (data || []).map(a => ({
            ...a,
            score: a.scores?.[0]?.overall || 0,
            fit_score: a.scores?.[0]?.fit || 0,
            intent_score: a.scores?.[0]?.intent || 0,
            tech_stack: a.tech_stack?.join(', ') || '',
          }));

        } else if (type === 'contacts') {
          let query = supabase
            .from("Leads")
            .select(`
              id, name, first_name, last_name, title, persona, level,
              email, email_verified, phone, linkedin_url, country,
              account_external_id, accounts(name, industry_norm)
            `)
            .eq("org_id", org_id);

          if (filters.account_ids?.length > 0) {
            query = query.in("account_external_id", filters.account_ids);
          }
          if (filters.personas?.length > 0) {
            query = query.in("persona", filters.personas);
          }
          if (filters.verified_only) {
            query = query.eq("email_verified", true);
          }

          const { data, error } = await query.limit(10000);
          if (error) throw new Error(error.message);

          records = (data || []).map(c => ({
            ...c,
            company_name: c.accounts?.name || '',
            company_industry: c.accounts?.industry_norm || '',
          }));
        }

        // For now, return the data - in production this would generate a file
        const message = `**Export Ready** 📥\n\nExported **${records.length} ${type}** to ${format.toUpperCase()}.\n\n${records.length > 0 ? `Sample: ${records.slice(0, 3).map(r => r.name).join(', ')}...` : 'No records matched filters.'}`;

        const result = {
          type,
          format,
          record_count: records.length,
          records: records.slice(0, 100), // Return preview
          message,
          isExecution: true,
        };

        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create_campaign": {
        const {
          name,
          account_ids = [],
          contact_ids = [],
          campaign_type = 'outbound',
          description = ''
        } = parameters;

        if (!name) throw new Error("Campaign name is required");

        console.log(`[AI-Actions] create_campaign: ${name}, ${account_ids.length} accounts, ${contact_ids.length} contacts`);

        // Create campaign snapshot
        const { data: snapshot, error: snapshotError } = await supabase
          .from("campaign_snapshots")
          .insert({
            org_id,
            created_by: user_id,
            icp_name: name,
            export_type: campaign_type,
            total_accounts: account_ids.length,
            total_contacts: contact_ids.length,
            campaign_ready_contacts: contact_ids.length,
            firmographic_filters: { account_ids },
          })
          .select()
          .single();

        if (snapshotError) throw new Error(snapshotError.message);

        const message = `**Campaign Created** 🎯\n\n**"${name}"**\n\n• ${account_ids.length} account${account_ids.length !== 1 ? 's' : ''}\n• ${contact_ids.length} contact${contact_ids.length !== 1 ? 's' : ''}\n• Type: ${campaign_type}\n\nCampaign ID: \`${snapshot.id}\``;

        const result = {
          campaign_id: snapshot.id,
          name,
          campaign_type,
          account_count: account_ids.length,
          contact_count: contact_ids.length,
          message,
          isExecution: true,
        };

        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "trigger_scoring": {
        const {
          filters = {},
          icp_id,
          force_rescore = false
        } = parameters;

        console.log(`[AI-Actions] trigger_scoring: icp_id=${icp_id}, filters:`, filters);

        // Get account count
        let countQuery = supabase
          .from("accounts")
          .select("external_id", { count: 'exact', head: true })
          .eq("org_id", org_id);

        if (filters.industries?.length > 0) {
          countQuery = countQuery.in("industry_norm", filters.industries);
        }
        if (filters.countries?.length > 0) {
          countQuery = countQuery.in("country", filters.countries);
        }
        if (!force_rescore) {
          countQuery = countQuery.is("propensity_score", null);
        }

        const { count: accountCount } = await countQuery;

        // Create bulk scoring job
        const { data: job, error: jobError } = await supabase
          .from("bulk_scoring_jobs")
          .insert({
            org_id,
            icp_id: icp_id || null,
            status: 'pending',
            total_accounts: accountCount || 0,
            processed_accounts: 0,
          })
          .select()
          .single();

        if (jobError) throw new Error(jobError.message);

        // Trigger scoring asynchronously
        fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/bulk-score-accounts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: req.headers.get("Authorization") || "",
            },
            body: JSON.stringify({
              job_id: job.id,
              org_id,
              filters,
              force_rescore,
            }),
          }
        ).catch(err => console.error("Scoring trigger failed:", err));

        const message = `**Scoring Started** ⚡\n\nScoring **${accountCount || 0} accounts** against ${icp_id ? 'specified ICP' : 'active ICP'}.\n\nJob ID: \`${job.id}\`\nEstimated time: ~${Math.ceil((accountCount || 0) / 50)} minutes`;

        const result = {
          job_id: job.id,
          accounts_queued: accountCount || 0,
          icp_id,
          force_rescore,
          message,
          isExecution: true,
        };

        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_icp": {
        const {
          icp_id,
          criteria_updates = {}
        } = parameters;

        if (!icp_id) throw new Error("icp_id is required");

        console.log(`[AI-Actions] update_icp: ${icp_id}`, criteria_updates);

        // Get current ICP
        const { data: currentIcp, error: fetchError } = await supabase
          .from("icp_profiles")
          .select("*")
          .eq("id", icp_id)
          .eq("org_id", org_id)
          .single();

        if (fetchError || !currentIcp) throw new Error("ICP not found");

        // Update ICP
        const { data: updatedIcp, error: updateError } = await supabase
          .from("icp_profiles")
          .update({
            ...criteria_updates,
            version: (currentIcp.version || 1) + 1,
          })
          .eq("id", icp_id)
          .eq("org_id", org_id)
          .select()
          .single();

        if (updateError) throw new Error(updateError.message);

        const changedFields = Object.keys(criteria_updates);
        const message = `**ICP Updated** ✅\n\n**"${currentIcp.name}"** (v${updatedIcp.version})\n\nUpdated fields:\n${changedFields.map(f => `• ${f}`).join('\n')}\n\n⚠️ Consider re-scoring accounts to apply new criteria.`;

        const result = {
          icp_id,
          icp_name: currentIcp.name,
          new_version: updatedIcp.version,
          changed_fields: changedFields,
          message,
          isExecution: true,
          requiresRescore: true,
        };

        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "sync_to_crm": {
        const {
          type = 'accounts',
          ids = [],
          crm_type = 'auto'
        } = parameters;

        if (ids.length === 0) throw new Error("ids is required");

        console.log(`[AI-Actions] sync_to_crm: ${ids.length} ${type} to ${crm_type}`);

        // Check for CRM integration
        const { data: integration } = await supabase
          .from("integrations")
          .select("*")
          .eq("org_id", org_id)
          .eq("integration_type", "crm")
          .eq("status", "connected")
          .maybeSingle();

        if (!integration) {
          throw new Error("No CRM connected. Please connect a CRM in Settings.");
        }

        // Queue sync job (implementation depends on CRM type)
        const syncId = crypto.randomUUID();
        
        // Log the sync attempt
        await supabase.from("audit_logs").insert({
          org_id,
          actor: user_id || 'ai',
          action: 'crm_sync_initiated',
          meta: {
            sync_id: syncId,
            type,
            record_count: ids.length,
            crm: integration.provider_name,
          },
        });

        const message = `**CRM Sync Initiated** 🔄\n\nSyncing **${ids.length} ${type}** to **${integration.provider_name}**.\n\nSync ID: \`${syncId}\`\nEstimated time: ~${Math.ceil(ids.length / 20)} minutes`;

        const result = {
          sync_id: syncId,
          type,
          record_count: ids.length,
          crm: integration.provider_name,
          message,
          isExecution: true,
        };

        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "schedule_enrichment": {
        const {
          filters = {},
          frequency = 'daily',
          enrichment_types = ['firmographics'],
          start_time = '09:00',
          enabled = true
        } = parameters;

        console.log(`[AI-Actions] schedule_enrichment: ${frequency}, types: ${enrichment_types.join(', ')}`);

        // Create or update automation setting
        const { data: setting, error: settingError } = await supabase
          .from("automation_settings")
          .upsert({
            org_id,
            setting_key: 'scheduled_enrichment',
            enabled,
            schedule_frequency: frequency,
          }, {
            onConflict: 'org_id,setting_key'
          })
          .select()
          .single();

        if (settingError) throw new Error(settingError.message);

        // Create AI agent for scheduled enrichment
        const { data: agent, error: agentError } = await supabase
          .from("ai_agents")
          .upsert({
            org_id,
            name: 'Scheduled Enrichment',
            agent_type: 'enrichment',
            schedule: frequency,
            enabled,
            parameters: { filters, enrichment_types, start_time },
            status: enabled ? 'active' : 'paused',
          }, {
            onConflict: 'org_id,name'
          })
          .select()
          .single();

        if (agentError) throw new Error(agentError.message);

        const message = `**Enrichment Scheduled** 📅\n\n• Frequency: ${frequency}\n• Types: ${enrichment_types.join(', ')}\n• Status: ${enabled ? '✅ Active' : '⏸️ Paused'}\n\nThe enrichment will run automatically at ${start_time}.`;

        const result = {
          agent_id: agent.id,
          frequency,
          enrichment_types,
          enabled,
          message,
          isExecution: true,
        };

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
