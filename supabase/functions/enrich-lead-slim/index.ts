// Slim Lead Enrichment v3 - Lightweight lead enrichment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

console.log('[enrich-lead-slim] === LOADED v3 ===');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sanitizePhone = (phone: any): string | null => {
  if (!phone || typeof phone === 'boolean') return null;
  const str = String(phone);
  const digits = str.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return str.trim();
};

const extractDomain = (email: string): string => {
  const match = email?.match(/@([^@]+)$/);
  return match ? match[1].toLowerCase() : '';
};

const extractNameFromEmail = (email: string): { firstName?: string; lastName?: string } => {
  if (!email) return {};
  const localPart = email.split('@')[0].toLowerCase();
  if (['info', 'admin', 'contact', 'support', 'sales', 'hello'].includes(localPart.split('.')[0])) return {};
  
  if (localPart.includes('.')) {
    const parts = localPart.split('.');
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    return { firstName: cap(parts[0]), lastName: cap(parts[1]) };
  }
  return {};
};

const classifyTitle = (title: string): { level: string; persona: string } => {
  const t = (title || '').toLowerCase();
  if (/\b(ceo|cfo|cto|coo|cmo|chief|president|founder)\b/.test(t)) 
    return { level: 'C-Level', persona: 'Executive' };
  if (/\b(vp|vice president)\b/.test(t)) 
    return { level: 'VP', persona: 'Senior Leadership' };
  if (/\b(director|head of)\b/.test(t)) 
    return { level: 'Director', persona: 'Decision Maker' };
  if (/\b(manager)\b/.test(t)) 
    return { level: 'Manager', persona: 'Influencer' };
  return { level: 'Individual Contributor', persona: 'End User' };
};

serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get('health') === 'true') {
    return new Response(JSON.stringify({ status: 'healthy', version: 'v3' }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    const HUNTER_API_KEY = Deno.env.get('HUNTER_API_KEY');
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

    const { leads, org_id, save_to_db = true } = await req.json();
    
    if (!leads?.length || !org_id) {
      throw new Error('leads array and org_id required');
    }

    console.log(`[enrich-lead-slim] Processing ${leads.length} leads`);
    
    const results: any[] = [];
    let totalCost = 0;
    
    for (const lead of leads) {
      const email = lead.email?.toLowerCase().trim();
      const domain = lead.domain || extractDomain(email || '');
      
      let data: any = {
        email,
        first_name: lead.first_name,
        last_name: lead.last_name,
        title: lead.title,
        mobile: sanitizePhone(lead.phone),
        linkedin_url: lead.linkedin_url,
        company: lead.company,
        domain,
      };

      // Extract name from email
      if (!data.first_name && email) {
        const extracted = extractNameFromEmail(email);
        data.first_name = extracted.firstName;
        data.last_name = data.last_name || extracted.lastName;
      }

      // Classify title
      if (data.title) {
        const { level, persona } = classifyTitle(data.title);
        data.level = level;
        data.persona = persona;
      }

      // Find matching account
      let matchedAccount: any = null;
      if (domain) {
        const { data: accounts } = await supabase
          .from('accounts')
          .select('*')
          .eq('org_id', org_id)
          .ilike('domain', `%${domain}%`)
          .limit(1);
        
        matchedAccount = accounts?.[0];
      }

      // Create account from Firecrawl if none exists
      if (!matchedAccount && domain && FIRECRAWL_API_KEY) {
        try {
          const scrapeResp = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: `https://${domain}`, formats: ['markdown'], onlyMainContent: true }),
          });
          
          if (scrapeResp.ok) {
            totalCost += 0.02;
            const scraped = await scrapeResp.json();
            const markdown = scraped.data?.markdown || '';
            
            // Extract company name from markdown
            const titleMatch = markdown.match(/^#\s+(.+)/m);
            const companyName = titleMatch?.[1] || domain.split('.')[0];
            
            // Create stub account
            const { data: newAccount } = await supabase
              .from('accounts')
              .insert({
                org_id,
                external_id: `auto_${domain.replace(/\./g, '_')}_${Date.now()}`,
                name: companyName,
                domain,
                data_source: 'firecrawl_auto',
                enriched_at: new Date().toISOString(),
              })
              .select()
              .single();
            
            matchedAccount = newAccount;
          }
        } catch (e) {
          console.error('[Firecrawl] Error:', e);
        }
      }

      // Add firmographics from account
      if (matchedAccount) {
        data.company = data.company || matchedAccount.name;
        data.industry = matchedAccount.industry_norm;
        data.employee_count = matchedAccount.employee_count;
        data.revenue_range = matchedAccount.revenue_range;
        data.hq_city = matchedAccount.hq_city || matchedAccount.city;
        data.hq_state = matchedAccount.hq_state || matchedAccount.state_province;
        data.country = matchedAccount.country;
      }

      // AI enrichment for missing data
      if (PERPLEXITY_API_KEY && email && (!data.title || !data.mobile)) {
        try {
          const personName = [data.first_name, data.last_name].filter(Boolean).join(' ');
          const aiResp = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'sonar-pro',
              messages: [{
                role: 'user',
                content: `Find for ${personName || email} at ${data.company || domain}. Return JSON only: {"title":"","phone":"","linkedin_url":""}`
              }],
              max_tokens: 150,
            }),
          });

          if (aiResp.ok) {
            totalCost += 0.01;
            const aiData = await aiResp.json();
            const content = aiData.choices?.[0]?.message?.content || '';
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.title && !data.title) {
                data.title = parsed.title;
                const { level, persona } = classifyTitle(parsed.title);
                data.level = level;
                data.persona = persona;
              }
              if (parsed.phone && !data.mobile) data.mobile = sanitizePhone(parsed.phone);
              if (parsed.linkedin_url && !data.linkedin_url) data.linkedin_url = parsed.linkedin_url;
            }
          }
        } catch (e) {
          console.error('[Perplexity] Error:', e);
        }
      }

      // Email verification
      if (HUNTER_API_KEY && email) {
        try {
          const hunterResp = await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${HUNTER_API_KEY}`);
          if (hunterResp.ok) {
            totalCost += 0.003;
            const hunterData = await hunterResp.json();
            data.email_status = hunterData.data?.status || 'unknown';
          }
        } catch (e) {
          console.error('[Hunter] Error:', e);
        }
      }

      // Save to database
      if (save_to_db && email) {
        const record = {
          org_id,
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          title: data.title,
          level: data.level,
          persona: data.persona,
          mobile: data.mobile,
          linkedin_url: data.linkedin_url,
          company: data.company,
          industry: data.industry,
          employee_count: data.employee_count,
          revenue_range: data.revenue_range,
          hq_city: data.hq_city,
          hq_state: data.hq_state,
          country: data.country,
          domain: data.domain,
          data_source: 'enrichment_wizard',
          enrichment_status: 'enriched',
          enriched_at: new Date().toISOString(),
          account_external_id: matchedAccount?.external_id,
        };

        const { data: saved } = await supabase
          .from('Leads')
          .upsert(record, { onConflict: 'email,org_id' })
          .select()
          .single();
        
        if (saved) data.id = saved.id;
      }

      results.push({
        input: lead,
        enriched_data: data,
        account_matched: !!matchedAccount,
        account_name: matchedAccount?.name,
      });
    }

    const stats = {
      total: leads.length,
      enriched: results.length,
      with_title: results.filter(r => r.enriched_data.title).length,
      with_phone: results.filter(r => r.enriched_data.mobile).length,
      with_firmographics: results.filter(r => r.account_matched).length,
    };

    console.log('[enrich-lead-slim] Done:', stats);

    return new Response(JSON.stringify({
      success: true,
      results,
      stats,
      cost_summary: {
        total_cost: totalCost,
        per_lead: leads.length > 0 ? totalCost / leads.length : 0,
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[enrich-lead-slim] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
