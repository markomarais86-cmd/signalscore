import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";
import { sendWebhook } from "./channels/webhook.ts";
import { sendSlack } from "./channels/slack.ts";
import { sendTeams } from "./channels/teams.ts";
import { sendEmail } from "./channels/email.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlertPayload {
  alertId: string;
  alertType: string;
  alertName: string;
  triggerValue: number;
  thresholdValue: number;
  message: string;
  contextData?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { alertId, orgId, payload } = await req.json();

    if (!alertId || !orgId || !payload) {
      return new Response(
        JSON.stringify({ error: 'alertId, orgId, and payload are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[send-alert] Processing alert ${alertId} for org ${orgId}`);

    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .select('*')
      .eq('id', alertId)
      .eq('org_id', orgId)
      .single();

    if (alertError || !alert) throw new Error('Alert not found');

    if (!alert.is_active) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Alert is inactive' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const alertPayload = payload as AlertPayload;
    const promises: Promise<{ channel: string; success: boolean; error?: string }>[] = [];

    if (alert.webhook_url) {
      promises.push(sendWebhook(alert.webhook_url, alertPayload).catch(e => ({ channel: 'webhook', success: false, error: e.message })));
    }
    if (alert.slack_webhook_url) {
      promises.push(sendSlack(alert.slack_webhook_url, alertPayload).catch(e => ({ channel: 'slack', success: false, error: e.message })));
    }
    if (alert.teams_webhook_url) {
      promises.push(sendTeams(alert.teams_webhook_url, alertPayload).catch(e => ({ channel: 'teams', success: false, error: e.message })));
    }
    if (alert.email_recipients && alert.email_recipients.length > 0) {
      promises.push(sendEmail(alert.email_recipients, alertPayload, supabase).catch(e => ({ channel: 'email', success: false, error: e.message })));
    }

    const results = await Promise.all(promises);

    for (const r of results) {
      console.log(`[send-alert] ${r.channel}: ${r.success ? 'ok' : r.error}`);
    }

    const notificationSent = results.some(r => r.success);
    const notificationError = results
      .filter(r => !r.success)
      .map(r => `${r.channel}: ${r.error}`)
      .join('; ');

    await supabase.from('alert_history').insert({
      alert_id: alertId,
      org_id: orgId,
      trigger_value: alertPayload.triggerValue,
      threshold_value: alertPayload.thresholdValue,
      notification_sent: notificationSent,
      notification_channels: results.filter(r => r.success).map(r => r.channel),
      notification_error: notificationError || null,
      context_data: alertPayload.contextData || {},
    });

    await supabase
      .from('alerts')
      .update({
        last_triggered_at: new Date().toISOString(),
        trigger_count: alert.trigger_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', alertId);

    console.log(`[send-alert] Done, ${results.filter(r => r.success).length} notifications sent`);

    return new Response(
      JSON.stringify({ success: true, notificationResults: results, alertHistoryCreated: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[send-alert] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
