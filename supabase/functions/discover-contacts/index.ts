import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContactDiscoveryRequest {
  org_id: string;
  account_ids?: string[];
  domains?: string[];
  persona_job_titles?: string[];
  limit_per_account?: number;
  icp_id?: string;
}

interface DiscoveredContact {
  full_name: string;
  first_name: string;
  last_name: string;
  job_title: string;
  linkedin_url?: string;
  email?: string;
  confidence: number;
  account_external_id: string;
  account_name: string;
  domain: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { 
      org_id, 
      account_ids, 
      domains, 
      persona_job_titles = ['CEO', 'CTO', 'VP', 'Director', 'Head of', 'Manager'],
      limit_per_account = 3,
      icp_id
    } = await req.json() as ContactDiscoveryRequest;

    if (!org_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing org_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Contact Discovery] Starting for org ${org_id}`);

    // Get accounts to find contacts for
    let accountsToProcess: { external_id: string; name: string; domain: string }[] = [];
    
    if (account_ids && account_ids.length > 0) {
      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('external_id, name, domain')
        .eq('org_id', org_id)
        .in('external_id', account_ids)
        .not('domain', 'is', null);
      
      if (error) throw error;
      accountsToProcess = accounts || [];
    } else if (domains && domains.length > 0) {
      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('external_id, name, domain')
        .eq('org_id', org_id)
        .in('domain', domains);
      
      if (error) throw error;
      accountsToProcess = accounts || [];
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Provide account_ids or domains' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Contact Discovery] Processing ${accountsToProcess.length} accounts`);

    const allDiscoveredContacts: DiscoveredContact[] = [];
    let createdLeads = 0;
    let skippedDuplicates = 0;
    let failedAccounts = 0;

    for (const account of accountsToProcess) {
      try {
        console.log(`[Contact Discovery] Searching contacts for ${account.name} (${account.domain})`);
        
        let contacts: DiscoveredContact[] = [];
        
        // Use Perplexity for real-time web search if available
        if (perplexityKey) {
          contacts = await searchContactsWithPerplexity(
            account,
            persona_job_titles,
            limit_per_account,
            perplexityKey,
            lovableApiKey
          );
        } else {
          // Fallback to Lovable AI only
          contacts = await discoverContactsWithAI(
            account,
            persona_job_titles,
            limit_per_account,
            lovableApiKey
          );
        }
        
        console.log(`[Contact Discovery] Found ${contacts.length} contacts for ${account.name}`);
        
        // Check for existing leads and create new ones
        for (const contact of contacts) {
          // Check if lead already exists (by email or LinkedIn)
          const existingQuery = supabase
            .from('Leads')
            .select('id')
            .eq('org_id', org_id);
          
          if (contact.email) {
            existingQuery.or(`email.eq.${contact.email},linkedin_url.eq.${contact.linkedin_url || ''}`);
          } else if (contact.linkedin_url) {
            existingQuery.eq('linkedin_url', contact.linkedin_url);
          }
          
          const { data: existing } = await existingQuery.maybeSingle();
          
          if (existing) {
            skippedDuplicates++;
            continue;
          }
          
          // Create new lead
          const { error: insertError } = await supabase
            .from('Leads')
            .insert({
              org_id,
              first_name: contact.first_name,
              last_name: contact.last_name,
              email: contact.email,
              job_title: contact.job_title,
              linkedin_url: contact.linkedin_url,
              company_name: account.name,
              company_domain: account.domain,
              account_external_id: account.external_id,
              source: 'ai_discovery',
              lead_status: 'new',
              quality_score: Math.round(contact.confidence),
              data_quality: contact.confidence >= 80 ? 'high' : contact.confidence >= 50 ? 'medium' : 'low',
              enrichment_status: 'pending',
              sync_needed: true
            });
          
          if (insertError) {
            console.error(`[Contact Discovery] Failed to insert lead:`, insertError);
          } else {
            createdLeads++;
            allDiscoveredContacts.push(contact);
          }
        }
      } catch (accountError) {
        console.error(`[Contact Discovery] Error processing ${account.name}:`, accountError);
        failedAccounts++;
      }
    }

    // Log the discovery action
    await supabase.from('audit_logs').insert({
      org_id,
      actor: 'contact_discovery',
      action: 'contacts_discovered',
      meta: {
        accounts_processed: accountsToProcess.length,
        contacts_found: allDiscoveredContacts.length,
        leads_created: createdLeads,
        duplicates_skipped: skippedDuplicates,
        failed_accounts: failedAccounts,
        persona_titles: persona_job_titles,
        icp_id
      }
    });

    console.log(`[Contact Discovery] Completed: ${createdLeads} leads created, ${skippedDuplicates} duplicates skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        accounts_processed: accountsToProcess.length,
        contacts_found: allDiscoveredContacts.length,
        leads_created: createdLeads,
        duplicates_skipped: skippedDuplicates,
        failed_accounts: failedAccounts,
        contacts: allDiscoveredContacts
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Contact Discovery] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function searchContactsWithPerplexity(
  account: { external_id: string; name: string; domain: string },
  personaTitles: string[],
  limit: number,
  perplexityKey: string,
  lovableApiKey: string
): Promise<DiscoveredContact[]> {
  const prompt = `Find decision-makers and key contacts at ${account.name} (${account.domain}).

Target job titles: ${personaTitles.join(', ')}

For each person found, provide:
- Full name
- Current job title
- LinkedIn profile URL (if available)
- Professional email (if publicly available)

Focus on currently employed, verifiable individuals. Return up to ${limit} contacts.`;

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${perplexityKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert B2B researcher finding decision-makers at target companies. Provide accurate, verifiable contact information only.'
        },
        { role: 'user', content: prompt }
      ],
      search_recency_filter: 'month',
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  // Parse with Lovable AI
  return parseContactsWithAI(content, account, limit, lovableApiKey);
}

async function parseContactsWithAI(
  rawContent: string,
  account: { external_id: string; name: string; domain: string },
  limit: number,
  lovableApiKey: string
): Promise<DiscoveredContact[]> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'Extract contact information from search results into structured data. Only include contacts with verifiable information.'
        },
        {
          role: 'user',
          content: `Parse contacts for ${account.name} (${account.domain}) from:\n\n${rawContent}`
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'parsed_contacts',
            description: 'Return structured contact data',
            parameters: {
              type: 'object',
              properties: {
                contacts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      full_name: { type: 'string' },
                      first_name: { type: 'string' },
                      last_name: { type: 'string' },
                      job_title: { type: 'string' },
                      linkedin_url: { type: 'string' },
                      email: { type: 'string' },
                      confidence: { type: 'number', minimum: 0, maximum: 100 }
                    },
                    required: ['full_name', 'first_name', 'last_name', 'job_title', 'confidence']
                  }
                }
              },
              required: ['contacts']
            }
          }
        }
      ],
      tool_choice: { type: 'function', function: { name: 'parsed_contacts' } }
    }),
  });

  if (!response.ok) {
    throw new Error(`Lovable AI error: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (toolCall?.function?.arguments) {
    const parsed = JSON.parse(toolCall.function.arguments);
    const contacts = (parsed.contacts || []).slice(0, limit);
    
    return contacts.map((c: any) => ({
      ...c,
      account_external_id: account.external_id,
      account_name: account.name,
      domain: account.domain
    }));
  }
  
  return [];
}

async function discoverContactsWithAI(
  account: { external_id: string; name: string; domain: string },
  personaTitles: string[],
  limit: number,
  lovableApiKey: string
): Promise<DiscoveredContact[]> {
  const prompt = `Find ${limit} decision-makers at ${account.name} (${account.domain}) with these titles: ${personaTitles.join(', ')}. 

For each person, provide their full name, job title, and LinkedIn URL if known. Focus on accuracy.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'You are a B2B researcher. Suggest likely decision-makers at companies based on your knowledge. Be conservative with confidence scores since this is not real-time data.'
        },
        { role: 'user', content: prompt }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'discovered_contacts',
            description: 'Return discovered contacts',
            parameters: {
              type: 'object',
              properties: {
                contacts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      full_name: { type: 'string' },
                      first_name: { type: 'string' },
                      last_name: { type: 'string' },
                      job_title: { type: 'string' },
                      linkedin_url: { type: 'string' },
                      email: { type: 'string' },
                      confidence: { type: 'number', minimum: 0, maximum: 100 }
                    },
                    required: ['full_name', 'first_name', 'last_name', 'job_title', 'confidence']
                  }
                }
              },
              required: ['contacts']
            }
          }
        }
      ],
      tool_choice: { type: 'function', function: { name: 'discovered_contacts' } }
    }),
  });

  if (!response.ok) {
    throw new Error(`Lovable AI error: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (toolCall?.function?.arguments) {
    const parsed = JSON.parse(toolCall.function.arguments);
    const contacts = (parsed.contacts || []).slice(0, limit);
    
    return contacts.map((c: any) => ({
      ...c,
      account_external_id: account.external_id,
      account_name: account.name,
      domain: account.domain
    }));
  }
  
  return [];
}
