import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

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

// --- Notification senders ---

async function sendWebhook(url: string, payload: AlertPayload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'alert',
      alert_type: payload.alertType,
      alert_name: payload.alertName,
      trigger_value: payload.triggerValue,
      threshold_value: payload.thresholdValue,
      message: payload.message,
      context: payload.contextData,
      timestamp: new Date().toISOString(),
    }),
  });
  return response.ok
    ? { channel: 'webhook', success: true }
    : { channel: 'webhook', success: false, error: `HTTP ${response.status}` };
}

function buildSlackBlocks(payload: AlertPayload) {
  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🚨 Alert: ${payload.alertName}`, emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Type:*\n${payload.alertType}` },
          { type: 'mrkdwn', text: `*Trigger Value:*\n${payload.triggerValue}` },
          { type: 'mrkdwn', text: `*Threshold:*\n${payload.thresholdValue}` },
        ],
      },
      { type: 'section', text: { type: 'mrkdwn', text: payload.message } },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `Triggered at ${new Date().toISOString()}` }],
      },
    ],
  };
}

async function sendSlack(url: string, payload: AlertPayload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildSlackBlocks(payload)),
  });
  return response.ok
    ? { channel: 'slack', success: true }
    : { channel: 'slack', success: false, error: `HTTP ${response.status}` };
}

function buildTeamsCard(payload: AlertPayload) {
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              text: `🚨 Alert: ${payload.alertName}`,
              weight: 'Bolder',
              size: 'Large',
              color: 'Attention',
            },
            {
              type: 'FactSet',
              facts: [
                { title: 'Type', value: payload.alertType },
                { title: 'Trigger Value', value: String(payload.triggerValue) },
                { title: 'Threshold', value: String(payload.thresholdValue) },
              ],
            },
            {
              type: 'TextBlock',
              text: payload.message,
              wrap: true,
            },
            {
              type: 'TextBlock',
              text: `Triggered at ${new Date().toISOString()}`,
              isSubtle: true,
              size: 'Small',
            },
          ],
        },
      },
    ],
  };
}

async function sendTeams(url: string, payload: AlertPayload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildTeamsCard(payload)),
  });
  return response.ok
    ? { channel: 'teams', success: true }
    : { channel: 'teams', success: false, error: `HTTP ${response.status}` };
}

// --- Main handler ---

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
    const results: Array<{ channel: string; success: boolean; error?: string }> = [];

    // Fire all channels in parallel
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

    const settled = await Promise.all(promises);
    results.push(...settled);

    for (const r of results) {
      console.log(`[send-alert] ${r.channel}: ${r.success ? 'ok' : r.error}`);
    }

    // Log to alert_history
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
