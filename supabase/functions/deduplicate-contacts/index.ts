import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { org_id, batch_size = 1000, auto_merge = false } = await req.json();

    console.log(`🔍 Finding duplicates for org: ${org_id}`);

    // Find duplicate emails
    const { data: duplicates, error: dupError } = await supabase.rpc('get_duplicate_emails', {
      p_org_id: org_id,
      p_limit: batch_size
    }).catch(() => {
      // Fallback: manual query if RPC doesn't exist
      return supabase
        .from('Leads')
        .select('email, id, account_external_id, company')
        .eq('org_id', org_id)
        .not('email', 'is', null)
        .order('email')
        .limit(batch_size * 2);
    });

    if (dupError) {
      console.error('Error fetching duplicates:', dupError);
    }

    // Group by email
    const emailGroups = new Map<string, any[]>();
    duplicates?.forEach((lead: any) => {
      const email = lead.email.toLowerCase();
      if (!emailGroups.has(email)) {
        emailGroups.set(email, []);
      }
      emailGroups.get(email)!.push(lead);
    });

    let duplicatesFound = 0;
    let merged = 0;
    let markedIneligible = 0;

    // Process each duplicate group
    for (const [email, group] of emailGroups.entries()) {
      if (group.length <= 1) continue;

      duplicatesFound += group.length - 1;

      // Get ICP scores for ranking
      const leadIds = group.map(l => l.id);
      const { data: scores } = await supabase
        .from('scores')
        .select('account_external_id, overall')
        .in('account_external_id', group.map(l => l.account_external_id).filter(Boolean))
        .eq('org_id', org_id);

      // Rank by score
      const scoreMap = new Map(scores?.map(s => [s.account_external_id, s.overall]) || []);
      group.sort((a, b) => {
        const scoreA = scoreMap.get(a.account_external_id) || 0;
        const scoreB = scoreMap.get(b.account_external_id) || 0;
        return scoreB - scoreA; // Highest score first
      });

      const primaryLead = group[0];
      const duplicateIds = group.slice(1).map(l => l.id);

      console.log(`📧 ${email}: ${group.length} duplicates, keeping lead ${primaryLead.id}`);

      if (auto_merge) {
        // Mark duplicates as ineligible
        const { error: updateError } = await supabase
          .from('Leads')
          .update({ 
            export_eligible: false,
            suppression_reason: `Duplicate of lead ${primaryLead.id}`
          })
          .in('id', duplicateIds);

        if (!updateError) {
          markedIneligible += duplicateIds.length;
        }
      }

      // Update identity_registry with canonical mapping
      const emailHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(email)
      );
      const hashHex = Array.from(new Uint8Array(emailHash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      await supabase
        .from('identity_registry')
        .upsert({
          org_id,
          contact_id: primaryLead.id,
          primary_email: email,
          email_hash: hashHex,
          primary_domain: email.split('@')[1],
          crm_object_type: 'lead',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'org_id,email_hash'
        });

      merged++;
    }

    console.log(`✅ Deduplication complete: ${duplicatesFound} duplicates, ${merged} groups, ${markedIneligible} marked ineligible`);

    return new Response(
      JSON.stringify({
        processed: duplicates?.length || 0,
        duplicates_found: duplicatesFound,
        duplicate_groups: merged,
        merged,
        marked_ineligible: markedIneligible
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Deduplication error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
