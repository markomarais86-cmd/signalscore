import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { jobId } = await req.json();
    console.log('🔄 Starting smart enrichment waterfall for job:', jobId);

    const { data: job, error: jobError } = await supabase
      .from('enrichment_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError) throw jobError;

    await supabase
      .from('enrichment_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', jobId);

    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('external_id, name, domain, employee_count, revenue_range')
      .eq('org_id', job.org_id)
      .or('employee_count.is.null,revenue_range.is.null')
      .not('domain', 'is', null)
      .limit(100);

    if (accountsError) throw accountsError;

    if (!accounts || accounts.length === 0) {
      await supabase.from('enrichment_jobs').update({ 
        status: 'completed', 
        completed_at: new Date().toISOString(),
        total_records: 0 
      }).eq('id', jobId);

      return new Response(JSON.stringify({ success: true, message: 'No accounts need enrichment' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📊 Found ${accounts.length} accounts`);
    await supabase.from('enrichment_jobs').update({ total_records: accounts.length }).eq('id', jobId);

    let enrichedCount = 0;
    const enrichedAccounts = new Set<string>();

    // PHASE 1: Clearbit Free
    console.log('🔍 Phase 1: Clearbit');
    for (const account of accounts) {
      if (!account.domain) continue;

      try {
        const response = await fetch(`https://company.clearbit.com/v1/domains/find?domain=${account.domain}`);
        if (response.ok) {
          const data = await response.json();
          const updateData: any = {};
          
          if (!account.employee_count && data.metrics?.employees) {
            updateData.employee_count = data.metrics.employees;
          }
          if (!account.revenue_range && data.metrics?.estimatedAnnualRevenue) {
            const revenue = data.metrics.estimatedAnnualRevenue;
            if (revenue < 1000000) updateData.revenue_range = '$0-$1M';
            else if (revenue < 5000000) updateData.revenue_range = '$1M-$5M';
            else if (revenue < 10000000) updateData.revenue_range = '$5M-$10M';
            else if (revenue < 25000000) updateData.revenue_range = '$10M-$25M';
            else if (revenue < 50000000) updateData.revenue_range = '$25M-$50M';
            else if (revenue < 100000000) updateData.revenue_range = '$50M-$100M';
            else if (revenue < 500000000) updateData.revenue_range = '$100M-$500M';
            else if (revenue < 1000000000) updateData.revenue_range = '$500M-$1B';
            else if (revenue < 10000000000) updateData.revenue_range = '$1B-$10B';
            else updateData.revenue_range = '$10B+';
          }

          if (Object.keys(updateData).length > 0) {
            updateData.enriched_at = new Date().toISOString();
            updateData.enriched_from = 'clearbit';

            await supabase.from('accounts').update(updateData)
              .eq('external_id', account.external_id).eq('org_id', job.org_id);

            await supabase.rpc('auto_score_account', {
              p_account_external_id: account.external_id,
              p_org_id: job.org_id
            });

            enrichedAccounts.add(account.external_id);
            enrichedCount++;
          }
        }
      } catch (e) {
        console.error(`Clearbit error for ${account.name}:`, e);
      }
    }

    // PHASE 2: AI for remaining
    const remaining = accounts.filter(a => !enrichedAccounts.has(a.external_id));
    if (remaining.length > 0) {
      console.log(`🤖 Phase 2: AI (${remaining.length} accounts)`);
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      
      if (LOVABLE_API_KEY) {
        const batchSize = 10;
        for (let i = 0; i < remaining.length; i += batchSize) {
          const batch = remaining.slice(i, i + batchSize);
          
          const prompt = `Estimate firmographic data. Return JSON: [{"external_id": "id", "employee_count": number, "revenue_range": "range", "confidence": 0-100}]
Revenue ranges: "$0-$1M", "$1M-$5M", "$5M-$10M", "$10M-$25M", "$25M-$50M", "$50M-$100M", "$100M-$500M", "$500M-$1B", "$1B-$10B", "$10B+"
Companies: ${batch.map(a => `${a.name} (${a.domain})`).join(', ')}`;

          try {
            const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [
                  { role: 'system', content: 'B2B data analyst. Provide realistic estimates.' },
                  { role: 'user', content: prompt }
                ],
              }),
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              const jsonMatch = aiData.choices[0].message.content.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                const estimates = JSON.parse(jsonMatch[0]);
                for (const est of estimates) {
                  if (est.confidence >= 70) {
                    const acc = batch.find(a => a.external_id === est.external_id);
                    if (!acc) continue;

                    const updateData: any = { enriched_at: new Date().toISOString(), enriched_from: 'ai' };
                    if (!acc.employee_count && est.employee_count) updateData.employee_count = est.employee_count;
                    if (!acc.revenue_range && est.revenue_range) updateData.revenue_range = est.revenue_range;

                    if (Object.keys(updateData).length > 2) {
                      await supabase.from('accounts').update(updateData)
                        .eq('external_id', est.external_id).eq('org_id', job.org_id);
                      await supabase.rpc('auto_score_account', {
                        p_account_external_id: est.external_id,
                        p_org_id: job.org_id
                      });
                      enrichedCount++;
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.error('AI batch error:', e);
          }
        }
      }
    }

    await supabase.from('enrichment_jobs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      processed_records: accounts.length,
      enriched_records: enrichedCount,
      failed_records: accounts.length - enrichedCount
    }).eq('id', jobId);

    console.log(`✨ Complete: ${enrichedCount}/${accounts.length} enriched`);

    return new Response(JSON.stringify({ success: true, enriched: enrichedCount, total: accounts.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
