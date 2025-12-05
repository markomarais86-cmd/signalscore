import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DuplicateCheckRequest {
  org_id: string;
  emails?: string[];
  domains?: string[];
  check_type: 'pre_redemption' | 'full_analysis';
}

interface DuplicateAnalysis {
  existing_leads_count: number;
  crm_contacts_count: number;
  previous_exports_count: number;
  existing_lead_emails: string[];
  crm_contact_emails: string[];
  previous_export_emails: string[];
  total_duplicates: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { org_id, emails, domains, check_type = 'pre_redemption' }: DuplicateCheckRequest = await req.json();

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: 'org_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[check-apollo-duplicates] Checking duplicates for org ${org_id}`);
    console.log(`[check-apollo-duplicates] Emails to check: ${emails?.length || 0}, Domains: ${domains?.length || 0}`);

    const analysis: DuplicateAnalysis = {
      existing_leads_count: 0,
      crm_contacts_count: 0,
      previous_exports_count: 0,
      existing_lead_emails: [],
      crm_contact_emails: [],
      previous_export_emails: [],
      total_duplicates: 0,
    };

    // If checking specific emails
    if (emails && emails.length > 0) {
      const lowerEmails = emails.map(e => e.toLowerCase());

      // Check existing leads
      const { data: existingLeads } = await supabase
        .from('Leads')
        .select('email')
        .eq('org_id', org_id)
        .not('email', 'is', null);

      if (existingLeads) {
        const existingEmails = new Set(existingLeads.map(l => l.email?.toLowerCase()).filter(Boolean));
        analysis.existing_lead_emails = lowerEmails.filter(e => existingEmails.has(e));
        analysis.existing_leads_count = analysis.existing_lead_emails.length;
      }

      // Check CRM contacts (leads with data_source = 'crm' or linked to CRM accounts)
      const { data: crmLeads } = await supabase
        .from('Leads')
        .select('email, accounts!inner(data_source)')
        .eq('org_id', org_id)
        .in('accounts.data_source', ['crm', 'both'])
        .not('email', 'is', null);

      if (crmLeads) {
        const crmEmails = new Set(crmLeads.map(l => l.email?.toLowerCase()).filter(Boolean));
        analysis.crm_contact_emails = lowerEmails.filter(e => crmEmails.has(e));
        analysis.crm_contacts_count = analysis.crm_contact_emails.length;
      }

      // Check previous exports (last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: exports } = await supabase
        .from('campaign_snapshots')
        .select('exported_emails')
        .eq('org_id', org_id)
        .gte('exported_at', ninetyDaysAgo.toISOString());

      if (exports) {
        const exportedEmails = new Set<string>();
        exports.forEach(exp => {
          if (exp.exported_emails && Array.isArray(exp.exported_emails)) {
            exp.exported_emails.forEach((e: string) => exportedEmails.add(e.toLowerCase()));
          }
        });
        analysis.previous_export_emails = lowerEmails.filter(e => exportedEmails.has(e));
        analysis.previous_exports_count = analysis.previous_export_emails.length;
      }
    } else {
      // Full analysis - count all existing records for estimation
      const { count: leadsCount } = await supabase
        .from('Leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', org_id)
        .not('email', 'is', null);

      analysis.existing_leads_count = leadsCount || 0;

      // Count CRM contacts
      const { count: crmCount } = await supabase
        .from('Leads')
        .select('*, accounts!inner(data_source)', { count: 'exact', head: true })
        .eq('org_id', org_id)
        .in('accounts.data_source', ['crm', 'both'])
        .not('email', 'is', null);

      analysis.crm_contacts_count = crmCount || 0;

      // Count previous exports
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: exports } = await supabase
        .from('campaign_snapshots')
        .select('total_contacts')
        .eq('org_id', org_id)
        .gte('exported_at', ninetyDaysAgo.toISOString());

      if (exports) {
        analysis.previous_exports_count = exports.reduce((sum, e) => sum + (e.total_contacts || 0), 0);
      }
    }

    // Calculate unique duplicates (some emails might be in multiple categories)
    const allDuplicates = new Set([
      ...analysis.existing_lead_emails,
      ...analysis.crm_contact_emails,
      ...analysis.previous_export_emails,
    ]);
    analysis.total_duplicates = allDuplicates.size;

    console.log(`[check-apollo-duplicates] Analysis complete:`, analysis);

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        unique_duplicate_emails: Array.from(allDuplicates),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-apollo-duplicates] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});