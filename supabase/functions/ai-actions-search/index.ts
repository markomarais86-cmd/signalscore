import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      org_id, user_id, action_name, action_parameters: parameters,
      action_result: result, status, error_message, execution_time_ms,
    });
  } catch (e) {
    console.error("[AI-Actions-Search] Failed to log action:", e);
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, parameters, org_id, user_id } = await req.json();
    console.log(`[AI-Actions-Search] Executing action: ${action}`, parameters);

    switch (action) {
      case "search_accounts": {
        const {
          job_titles = [], personas = [], industries = [], countries = [],
          tech_stack = [], min_employees, max_employees, min_score, max_score,
          revenue_ranges = [], funding_status = [], recently_funded_days,
          verified_email_only = false, icp_qualified_only = false,
          exclude_enriched = false, limit = 25, offset = 0,
          industry, country, job_title, // legacy params
        } = parameters;

        const normalizedTitles = job_title ? [job_title, ...job_titles] : job_titles;
        const normalizedIndustries = industry ? [industry, ...industries] : industries;
        const normalizedCountries = country ? [country, ...countries] : countries;

        let accounts: any[] = [];
        let totalCount = 0;

        if (normalizedTitles.length > 0 || personas.length > 0) {
          let query = supabase
            .from("Leads")
            .select(`account_external_id, title, name, persona, email, email_verified,
              accounts!inner(external_id, name, domain, industry_norm, country, employee_count, 
                revenue_range, tech_stack, last_funding_round, last_funding_date, icp_qualified, enriched_at)
            `, { count: 'exact' })
            .eq("org_id", org_id)
            .not("account_external_id", "is", null);

          if (normalizedTitles.length > 0) {
            const titleFilters = normalizedTitles.map((t: string) => `title.ilike.%${t}%`).join(',');
            query = query.or(titleFilters);
          }
          if (personas.length > 0) query = query.in("persona", personas);
          if (normalizedIndustries.length > 0) {
            const industryFilters = normalizedIndustries.map((i: string) => `accounts.industry_norm.ilike.%${i}%`).join(',');
            query = query.or(industryFilters);
          }
          if (normalizedCountries.length > 0) query = query.in("accounts.country", normalizedCountries);
          if (tech_stack.length > 0) query = query.contains("accounts.tech_stack", tech_stack);
          if (min_employees) query = query.gte("accounts.employee_count", min_employees);
          if (max_employees) query = query.lte("accounts.employee_count", max_employees);
          if (icp_qualified_only) query = query.eq("accounts.icp_qualified", true);
          if (verified_email_only) query = query.eq("email_verified", true);
          if (revenue_ranges.length > 0) query = query.in("accounts.revenue_range", revenue_ranges);
          if (funding_status.length > 0) query = query.in("accounts.last_funding_round", funding_status);
          if (recently_funded_days) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - recently_funded_days);
            query = query.gte("accounts.last_funding_date", cutoff.toISOString().split('T')[0]);
          }

          const { data: leads, error, count } = await query.limit(limit * 3);
          if (error) throw new Error(error.message);

          totalCount = count || 0;

          const accountMap = new Map();
          for (const lead of leads || []) {
            const acct = lead.accounts;
            if (!acct) continue;
            if (!accountMap.has(acct.external_id)) {
              accountMap.set(acct.external_id, { ...acct, matching_contacts: [] });
            }
            accountMap.get(acct.external_id).matching_contacts.push({
              name: lead.name, title: lead.title, persona: lead.persona, email_verified: lead.email_verified,
            });
          }

          const accountIds = Array.from(accountMap.keys());
          if (accountIds.length > 0) {
            const { data: scores } = await supabase
              .from("scores").select("account_external_id, overall, fit, intent")
              .eq("org_id", org_id).in("account_external_id", accountIds);
            const scoreMap = new Map((scores || []).map((s: any) => [s.account_external_id, s]));
            for (const [id, acct] of accountMap) {
              const score = scoreMap.get(id);
              acct.score = score?.overall || 0;
              acct.fit = score?.fit || 0;
              acct.intent = score?.intent || 0;
            }
          }

          let filtered = Array.from(accountMap.values());
          if (min_score) filtered = filtered.filter((a: any) => a.score >= min_score);
          if (max_score) filtered = filtered.filter((a: any) => a.score <= max_score);
          accounts = filtered.sort((a: any, b: any) => b.score - a.score).slice(offset, offset + limit);

        } else {
          let query = supabase
            .from("accounts")
            .select(`external_id, name, domain, industry_norm, country, employee_count, 
              revenue_range, tech_stack, last_funding_round, last_funding_date, icp_qualified, enriched_at,
              scores(overall, fit, intent)
            `, { count: 'exact' })
            .eq("org_id", org_id);

          if (normalizedIndustries.length > 0) {
            const industryFilters = normalizedIndustries.map((i: string) => `industry_norm.ilike.%${i}%`).join(',');
            query = query.or(industryFilters);
          }
          if (normalizedCountries.length > 0) query = query.in("country", normalizedCountries);
          if (tech_stack.length > 0) query = query.contains("tech_stack", tech_stack);
          if (min_employees) query = query.gte("employee_count", min_employees);
          if (max_employees) query = query.lte("employee_count", max_employees);
          if (min_score) query = query.gte("scores.overall", min_score);
          if (icp_qualified_only) query = query.eq("icp_qualified", true);
          if (revenue_ranges.length > 0) query = query.in("revenue_range", revenue_ranges);
          if (funding_status.length > 0) query = query.in("last_funding_round", funding_status);
          if (recently_funded_days) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - recently_funded_days);
            query = query.gte("last_funding_date", cutoff.toISOString().split('T')[0]);
          }
          if (exclude_enriched) query = query.is("enriched_at", null);

          const { data, error, count } = await query.order("name").range(offset, offset + limit - 1);
          if (error) throw new Error(error.message);

          totalCount = count || 0;
          accounts = (data || []).map((a: any) => ({
            ...a, score: a.scores?.[0]?.overall || 0, fit: a.scores?.[0]?.fit || 0, intent: a.scores?.[0]?.intent || 0,
          }));
        }

        const filterParts: string[] = [];
        if (normalizedTitles.length > 0) filterParts.push(`with "${normalizedTitles.join('" or "')}" contacts`);
        if (personas.length > 0) filterParts.push(`persona: ${personas.join(", ")}`);
        if (normalizedIndustries.length > 0) filterParts.push(`in ${normalizedIndustries.join(", ")}`);
        if (min_score) filterParts.push(`scoring ${min_score}+`);

        const filterDesc = filterParts.length > 0 ? ` ${filterParts.join(", ")}` : "";
        const message = accounts.length === 0
          ? `No accounts found${filterDesc}.`
          : `Found **${totalCount} account${totalCount > 1 ? 's' : ''}**${filterDesc}:\n\n${accounts.slice(0, 5).map((a: any) => {
              const contacts = a.matching_contacts?.length || 0;
              return `• **${a.name}** - Score: ${a.score}, ${a.industry_norm || 'Unknown'}${contacts > 0 ? ` (${contacts} contacts)` : ''}`;
            }).join("\n")}${totalCount > 5 ? `\n\n...and ${totalCount - 5} more.` : ""}`;

        const result = { accounts, count: accounts.length, total: totalCount, message, filters_applied: filterParts };
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "search_contacts": {
        const {
          job_titles = [], personas = [], seniority_levels = [], countries = [],
          verified_email_only = false, has_account = true, min_account_score, limit = 25, offset = 0,
        } = parameters;

        let query = supabase
          .from("Leads")
          .select(`id, name, first_name, last_name, title, persona, level, email, email_verified,
            phone, mobile, linkedin_url, country, account_external_id, accounts!left(name, industry_norm, country)
          `, { count: 'exact' })
          .eq("org_id", org_id);

        if (job_titles.length > 0) {
          const titleFilters = job_titles.map((t: string) => `title.ilike.%${t}%`).join(',');
          query = query.or(titleFilters);
        }
        if (personas.length > 0) query = query.in("persona", personas);
        if (seniority_levels.length > 0) query = query.in("level", seniority_levels);
        if (countries.length > 0) query = query.in("country", countries);
        if (verified_email_only) query = query.eq("email_verified", true);
        if (has_account) query = query.not("account_external_id", "is", null);

        const { data: contacts, error, count } = await query.order("name").range(offset, offset + limit - 1);
        if (error) throw new Error(error.message);

        let filteredContacts = contacts || [];
        if (min_account_score && filteredContacts.length > 0) {
          const accountIds = [...new Set(filteredContacts.map((c: any) => c.account_external_id).filter(Boolean))];
          const { data: scores } = await supabase
            .from("scores").select("account_external_id, overall")
            .eq("org_id", org_id).in("account_external_id", accountIds).gte("overall", min_account_score);
          const highScoreAccounts = new Set((scores || []).map((s: any) => s.account_external_id));
          filteredContacts = filteredContacts.filter((c: any) => highScoreAccounts.has(c.account_external_id));
        }

        const message = filteredContacts.length === 0
          ? "No contacts found matching your criteria."
          : `Found **${count} contact${(count || 0) > 1 ? 's' : ''}**:\n\n${filteredContacts.slice(0, 5).map((c: any) =>
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

        const { data: sourceAccount, error: srcErr } = await supabase
          .from("accounts").select("*").eq("org_id", org_id).eq("external_id", account_id).single();
        if (srcErr || !sourceAccount) {
          return new Response(JSON.stringify({ success: false, error: "Account not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let query = supabase
          .from("accounts")
          .select(`external_id, name, domain, industry_norm, country, employee_count, revenue_range, scores(overall)`)
          .eq("org_id", org_id).neq("external_id", account_id);

        if (similarity_factors.includes('industry') && sourceAccount.industry_norm) {
          query = query.eq("industry_norm", sourceAccount.industry_norm);
        }
        if (similarity_factors.includes('location') && sourceAccount.country) {
          query = query.eq("country", sourceAccount.country);
        }
        if (similarity_factors.includes('size') && sourceAccount.employee_count) {
          query = query.gte("employee_count", Math.floor(sourceAccount.employee_count * 0.5))
            .lte("employee_count", Math.ceil(sourceAccount.employee_count * 2));
        }

        const { data: similar, error } = await query.limit(limit);
        if (error) throw new Error(error.message);

        const accounts = (similar || []).map((a: any) => ({ ...a, score: a.scores?.[0]?.overall || 0 }));
        const message = accounts.length === 0
          ? `No similar accounts found to ${sourceAccount.name}.`
          : `Found **${accounts.length}** accounts similar to **${sourceAccount.name}**:\n\n${accounts.slice(0, 5).map((a: any) =>
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

        const searchTitles = job_titles.length > 0 ? job_titles : 
          ['CEO', 'CTO', 'CFO', 'COO', 'CMO', 'CIO', 'VP', 'Director', 'Head of'];

        let query = supabase
          .from("Leads")
          .select(`id, name, first_name, last_name, title, persona, level, email, email_verified, phone, linkedin_url`)
          .eq("org_id", org_id).eq("account_external_id", account_id);

        const titleFilters = searchTitles.map((t: string) => `title.ilike.%${t}%`).join(',');
        query = query.or(titleFilters);

        const { data: contacts, error } = await query.limit(limit);
        if (error) throw new Error(error.message);

        const message = (contacts || []).length === 0
          ? `No decision makers found for this account.`
          : `Found **${contacts?.length} decision maker${(contacts?.length || 0) > 1 ? 's' : ''}**:\n\n${(contacts || []).map((c: any) =>
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
          .select(`external_id, name, domain, industry_norm, country, employee_count, tech_stack, scores(overall)`, { count: 'exact' })
          .eq("org_id", org_id);

        if (match_all) {
          query = query.contains("tech_stack", technologies);
        } else {
          query = query.overlaps("tech_stack", technologies);
        }
        if (min_score) query = query.gte("scores.overall", min_score);

        const { data, error, count } = await query.limit(limit);
        if (error) throw new Error(error.message);

        const accounts = (data || []).map((a: any) => ({
          ...a, score: a.scores?.[0]?.overall || 0,
          matched_tech: (a.tech_stack || []).filter((t: string) => 
            technologies.some((tech: string) => t.toLowerCase().includes(tech.toLowerCase()))
          ),
        }));

        const message = accounts.length === 0
          ? `No accounts found using ${technologies.join(", ")}.`
          : `Found **${count}** accounts using ${technologies.join(", ")}:\n\n${accounts.slice(0, 5).map((a: any) =>
            `• **${a.name}** - Tech: ${a.matched_tech.join(', ')}, Score: ${a.score}`
          ).join('\n')}`;

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
          .select(`external_id, name, domain, industry_norm, country, employee_count, 
            last_funding_round, last_funding_date, total_raised_usd, scores(overall)`, { count: 'exact' })
          .eq("org_id", org_id)
          .gte("last_funding_date", cutoffDate.toISOString().split('T')[0]);

        if (funding_rounds.length > 0) query = query.in("last_funding_round", funding_rounds);
        if (min_amount) query = query.gte("total_raised_usd", min_amount);
        if (min_score) query = query.gte("scores.overall", min_score);

        const { data, error, count } = await query.order("last_funding_date", { ascending: false }).limit(limit);
        if (error) throw new Error(error.message);

        const accounts = (data || []).map((a: any) => ({ ...a, score: a.scores?.[0]?.overall || 0 }));
        const message = accounts.length === 0
          ? `No accounts found with funding in the last ${days} days.`
          : `Found **${count}** accounts funded in the last ${days} days:\n\n${accounts.slice(0, 5).map((a: any) =>
            `• **${a.name}** - ${a.last_funding_round || 'Unknown'} on ${a.last_funding_date}, Score: ${a.score}`
          ).join('\n')}`;

        const result = { accounts, count: accounts.length, total: count, days, message };
        await logAction(supabase, org_id, user_id, action, parameters, result, 'success', undefined, Date.now() - startTime);

        return new Response(JSON.stringify({ success: true, action, result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ success: false, error: `Unknown search action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("[AI-Actions-Search] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
