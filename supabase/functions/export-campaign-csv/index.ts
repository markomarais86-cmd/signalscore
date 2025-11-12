import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ExportFilters {
  icp_id?: string;
  source_filter: 'all' | 'crm' | 'database';
  min_score?: number;
  max_score?: number;
  fit_bands?: string[];
  personas?: string[];
  max_records?: number;
  include_unverified?: boolean;
  skip_consent_check?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { org_id, filters, export_format = 'standard' } = await req.json();

    const {
      source_filter = 'all',
      min_score = 70,
      max_score = 100,
      fit_bands = ['A', 'B'],
      personas = [],
      max_records = 1000,
      include_unverified = false,
      skip_consent_check = false
    } = filters as ExportFilters;

    console.log(`📤 Starting export for org ${org_id} with format: ${export_format}`);

    // Generate unique batch ID
    const batchId = `CAMP-${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}`;

    // Query campaign-ready leads
    let query = supabase
      .from('Leads')
      .select(`
        id, external_id, first_name, last_name, email, title, phone, mobile,
        company, persona, data_source, account_external_id, email_verified,
        email_verification_status, consent_status, country, state_province,
        location_city, industry, employee_count, revenue_range,
        enriched_at, enrichment_confidence
      `)
      .eq('org_id', org_id)
      .eq('export_eligible', true)
      .not('email', 'is', null);

    // Apply source filter
    if (source_filter !== 'all') {
      query = query.eq('data_source', source_filter);
    }

    // Apply persona filter
    if (personas.length > 0) {
      query = query.in('persona', personas);
    }

    // Fetch leads
    const { data: leads, error: leadsError } = await query;

    if (leadsError) throw leadsError;

    console.log(`📊 Found ${leads?.length || 0} potential leads`);

    // Fetch scores for filtering
    const accountIds = [...new Set(leads?.map(l => l.account_external_id).filter(Boolean))];
    const { data: scores } = await supabase
      .from('scores')
      .select('account_external_id, overall, fit')
      .in('account_external_id', accountIds)
      .eq('org_id', org_id);

    const scoreMap = new Map(scores?.map(s => [s.account_external_id, s]) || []);

    // Pre-flight checks and filtering
    const skipReasons = {
      unverified: 0,
      no_consent: 0,
      suppressed: 0,
      duplicate: 0,
      low_score: 0
    };

    const seenEmails = new Set<string>();
    const eligibleLeads: any[] = [];

    for (const lead of leads || []) {
      // Check score
      const score = scoreMap.get(lead.account_external_id);
      const overallScore = score?.overall || 50;
      
      if (overallScore < min_score || overallScore > max_score) {
        skipReasons.low_score++;
        continue;
      }

      // Check fit band
      const fitBand = overallScore >= 85 ? 'A' : overallScore >= 70 ? 'B' : 'C';
      if (!fit_bands.includes(fitBand)) {
        skipReasons.low_score++;
        continue;
      }

      // Check email verification
      if (!include_unverified && !lead.email_verified) {
        skipReasons.unverified++;
        continue;
      }

      // Check for duplicates
      const emailKey = lead.email.toLowerCase();
      if (seenEmails.has(emailKey)) {
        skipReasons.duplicate++;
        continue;
      }
      seenEmails.add(emailKey);

      // Check consent (if not skipped)
      if (!skip_consent_check) {
        const { data: consentData } = await supabase.functions.invoke('check-consent', {
          body: { email: lead.email, org_id }
        });

        if (consentData?.suppressed) {
          skipReasons.suppressed++;
          continue;
        }

        if (!consentData?.eligible && lead.consent_status !== 'given') {
          skipReasons.no_consent++;
          continue;
        }
      }

      eligibleLeads.push({
        ...lead,
        icp_score: overallScore,
        fit_score: score?.fit || 50,
        fit_band: fitBand
      });

      if (eligibleLeads.length >= max_records) break;
    }

    // Sort by score descending and assign priority rank
    eligibleLeads.sort((a, b) => b.icp_score - a.icp_score);
    eligibleLeads.forEach((lead, idx) => {
      lead.priority_rank = idx + 1;
    });

    console.log(`✅ ${eligibleLeads.length} leads passed pre-flight checks`);

    // Generate CSV based on format
    let csvData: string;

    if (export_format === 'outreach') {
      csvData = generateOutreachCSV(eligibleLeads, batchId);
    } else if (export_format === 'salesloft') {
      csvData = generateSalesLoftCSV(eligibleLeads, batchId);
    } else {
      csvData = generateStandardCSV(eligibleLeads, batchId);
    }

    // Update Leads table
    const leadIds = eligibleLeads.map(l => l.id);
    if (leadIds.length > 0) {
      await supabase
        .from('Leads')
        .update({
          last_exported_at: new Date().toISOString(),
          lp_batch_id: batchId
        })
        .in('id', leadIds);
    }

    // Insert into lp_exports
    await supabase
      .from('lp_exports')
      .insert({
        org_id,
        batch_id: batchId,
        export_type: 'csv',
        filter_params: filters,
        export_count: eligibleLeads.length,
        eligible_count: leads?.length || 0,
        skipped_count: (leads?.length || 0) - eligibleLeads.length,
        skip_reasons: skipReasons,
        exported_by: null // Will be set by RLS
      });

    // Insert into campaign_snapshots (existing table)
    await supabase
      .from('campaign_snapshots')
      .insert({
        org_id,
        icp_name: 'Campaign Export',
        export_type: 'csv',
        total_contacts: eligibleLeads.length,
        campaign_ready_contacts: eligibleLeads.length,
        total_accounts: new Set(eligibleLeads.map(l => l.account_external_id)).size,
        source_filter,
        export_filename: `${batchId}.csv`
      });

    console.log(`🎉 Export complete: ${eligibleLeads.length} leads, batch ${batchId}`);

    return new Response(
      JSON.stringify({
        success: true,
        batch_id: batchId,
        csv_data: csvData,
        metadata: {
          total_queried: leads?.length || 0,
          eligible_count: leads?.length || 0,
          export_count: eligibleLeads.length,
          skipped_count: (leads?.length || 0) - eligibleLeads.length,
          skip_reasons: skipReasons
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Export error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateStandardCSV(leads: any[], batchId: string): string {
  const headers = [
    'First Name', 'Last Name', 'Email', 'Title', 'Phone', 'Mobile',
    'Company', 'Domain', 'Industry', 'Employee Count', 'Revenue Range',
    'Country', 'State', 'City', 'ICP Score', 'Fit Score', 'Fit Band',
    'Persona', 'Data Source', 'Priority Rank', 'Account ID', 'Contact ID',
    'LP Batch ID', 'Email Verified', 'Email Status', 'Consent Status',
    'Last Enriched'
  ];

  const rows = leads.map(lead => [
    lead.first_name, lead.last_name, lead.email, lead.title,
    lead.phone, lead.mobile, lead.company, 
    lead.account_external_id?.split('/')[0] || '', // Extract domain if stored
    lead.industry, lead.employee_count, lead.revenue_range,
    lead.country, lead.state_province, lead.location_city,
    lead.icp_score, lead.fit_score, lead.fit_band,
    lead.persona, lead.data_source, lead.priority_rank,
    lead.account_external_id, lead.external_id || lead.id,
    batchId, lead.email_verified ? 'Yes' : 'No',
    lead.email_verification_status || 'unknown',
    lead.consent_status || 'unknown',
    lead.enriched_at ? new Date(lead.enriched_at).toISOString().split('T')[0] : ''
  ].map(escapeCSV));

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

function generateOutreachCSV(leads: any[], batchId: string): string {
  const headers = [
    'First Name', 'Last Name', 'Email', 'Title', 'Work Phone',
    'Company', 'Website', 'City', 'State', 'Country', 'Tags',
    'Custom 1', 'Custom 2', 'Custom 3'
  ];

  const rows = leads.map(lead => [
    lead.first_name, lead.last_name, lead.email, lead.title,
    lead.phone || lead.mobile, lead.company,
    lead.account_external_id?.split('/')[0] || '',
    lead.location_city, lead.state_province, lead.country,
    lead.persona,
    lead.icp_score, lead.fit_band, batchId
  ].map(escapeCSV));

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

function generateSalesLoftCSV(leads: any[], batchId: string): string {
  const headers = [
    'First Name', 'Last Name', 'Email Address', 'Title', 'Phone',
    'Company Name', 'City', 'State', 'Country', 'Tags',
    'Custom Field 1', 'Custom Field 2', 'Custom Field 3'
  ];

  const rows = leads.map(lead => [
    lead.first_name, lead.last_name, lead.email, lead.title,
    lead.phone || lead.mobile, lead.company,
    lead.location_city, lead.state_province, lead.country,
    lead.persona,
    lead.icp_score, lead.fit_band, batchId
  ].map(escapeCSV));

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}
