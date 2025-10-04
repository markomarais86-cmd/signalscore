import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Domain normalization function
function normalizeDomain(domain: string | null | undefined): string {
  if (!domain) return '';
  
  let normalized = domain.trim().toLowerCase();
  normalized = normalized.replace(/^(https?:\/\/|\/\/)/i, '');
  normalized = normalized.replace(/^www\./i, '');
  normalized = normalized.replace(/\/.*$/, '');
  normalized = normalized.replace(/\.$/, '');
  
  return normalized;
}

// Extract domain from email
function extractDomainFromEmail(email: string | null): string {
  if (!email) return '';
  const match = email.match(/@(.+)$/);
  return match ? match[1] : '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { org_id } = await req.json();

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: 'org_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting lead-to-account matching for org: ${org_id}`);

    // Get all unlinked leads
    const { data: unlinkedLeads, error: leadsError } = await supabase
      .from('Leads')
      .select('id, external_id, email, website, company, industry, employee_count, revenue_range, country, state_province, phone, mobile')
      .eq('org_id', org_id)
      .is('account_external_id', null);

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      throw leadsError;
    }

    console.log(`Found ${unlinkedLeads?.length || 0} unlinked leads`);

    // Get all existing accounts for the org with their normalized domains
    const { data: existingAccounts, error: accountsError } = await supabase
      .from('accounts')
      .select('external_id, domain, name')
      .eq('org_id', org_id);

    if (accountsError) throw accountsError;

    // Create a map of normalized domains to account external_ids
    const domainMap = new Map<string, string>();
    existingAccounts?.forEach(account => {
      const normalized = normalizeDomain(account.domain);
      if (normalized) {
        domainMap.set(normalized, account.external_id);
      }
    });

    let matched = 0;
    let created = 0;
    let failed = 0;
    const errors: any[] = [];

    // Process leads in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < (unlinkedLeads?.length || 0); i += BATCH_SIZE) {
      const batch = unlinkedLeads?.slice(i, i + BATCH_SIZE) || [];
      
      for (const lead of batch) {
        try {
          // Extract and normalize domain
          let domain = '';
          if (lead.website) {
            domain = normalizeDomain(lead.website);
          } else if (lead.email) {
            domain = normalizeDomain(extractDomainFromEmail(lead.email));
          }

          if (!domain) {
            failed++;
            errors.push({
              lead_id: lead.external_id,
              reason: 'No valid domain found',
            });
            continue;
          }

          let accountExternalId = domainMap.get(domain);

          // If no matching account, create one
          if (!accountExternalId) {
            const newAccountId = `ACC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const { error: insertError } = await supabase
              .from('accounts')
              .insert({
                org_id,
                external_id: newAccountId,
                name: lead.company || domain,
                domain: domain,
                industry_norm: lead.industry,
                employee_count: lead.employee_count,
                revenue_range: lead.revenue_range,
                country: lead.country,
                state_province: lead.state_province,
                phone: lead.phone || lead.mobile,
                data_source: 'crm',
              });

            if (insertError) {
              console.error('Error creating account:', insertError);
              failed++;
              errors.push({
                lead_id: lead.external_id,
                reason: insertError.message,
              });
              continue;
            }

            accountExternalId = newAccountId;
            domainMap.set(domain, newAccountId);
            created++;
          } else {
            matched++;
          }

          // Link the lead to the account
          const { error: updateError } = await supabase
            .from('Leads')
            .update({ account_external_id: accountExternalId })
            .eq('id', lead.id);

          if (updateError) {
            console.error('Error linking lead:', updateError);
            failed++;
            errors.push({
              lead_id: lead.external_id,
              reason: updateError.message,
            });
          }
        } catch (error) {
          console.error('Error processing lead:', error);
          failed++;
          errors.push({
            lead_id: lead.external_id,
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    console.log(`Matching complete: ${matched} matched, ${created} created, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        total_leads: unlinkedLeads?.length || 0,
        matched_to_existing: matched,
        new_accounts_created: created,
        failed,
        errors: errors.slice(0, 10), // Return first 10 errors only
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in match-leads-to-accounts:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
