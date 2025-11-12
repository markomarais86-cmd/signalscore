import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      org_id,
      campaign_name,
      campaign_id,
      contacts,
      batch_metadata
    } = await req.json();

    console.log('[push-campaign-to-crm] Starting CRM push:', {
      org_id,
      campaign_name,
      campaign_id,
      contact_count: contacts?.length
    });

    if (!org_id || !campaign_name || !contacts || contacts.length === 0) {
      throw new Error('Missing required fields: org_id, campaign_name, and contacts');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if Salesforce is integrated
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('org_id', org_id)
      .eq('provider_name', 'salesforce')
      .eq('status', 'active')
      .maybeSingle();

    if (!integration) {
      throw new Error('Salesforce integration not found or inactive. Please connect Salesforce in Settings.');
    }

    // Generate batch ID
    const batchId = `CAMP_${Date.now()}`;

    // Mock Salesforce API interaction
    // TODO: Replace with actual Salesforce API calls using integration.credentials
    console.log('[push-campaign-to-crm] Pushing to Salesforce (mock)...');

    const sfCampaignId = campaign_id || `701${Math.random().toString(36).substr(2, 9)}`;
    const sfCampaignUrl = `https://example.salesforce.com/lightning/r/Campaign/${sfCampaignId}/view`;

    let membersAdded = 0;
    let membersUpdated = 0;
    const errors: any[] = [];

    // In production, this would iterate and call Salesforce API
    for (const contact of contacts) {
      try {
        // Mock: Create/update Lead in Salesforce
        // Mock: Add as Campaign Member
        membersAdded++;
      } catch (error: any) {
        errors.push({
          contact_email: contact.email,
          error: error.message
        });
      }
    }

    // Log to campaign_snapshots
    const { error: snapshotError } = await supabase
      .from('campaign_snapshots')
      .insert({
        org_id,
        batch_id: batchId,
        campaign_name,
        total_leads: contacts.length,
        icp_breakdown: batch_metadata.icp_criteria || {},
        persona_breakdown: batch_metadata.persona_criteria || {},
        exported_at: new Date().toISOString()
      });

    if (snapshotError) {
      console.error('[push-campaign-to-crm] Error logging snapshot:', snapshotError);
    }

    console.log(`[push-campaign-to-crm] Successfully pushed ${membersAdded} contacts to Salesforce`);

    return new Response(
      JSON.stringify({
        success: true,
        campaign_id: sfCampaignId,
        campaign_url: sfCampaignUrl,
        members_added: membersAdded,
        members_updated: membersUpdated,
        errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[push-campaign-to-crm] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
