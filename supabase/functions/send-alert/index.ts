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

    // Fetch alert configuration
    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .select('*')
      .eq('id', alertId)
      .eq('org_id', orgId)
      .single();

    if (alertError || !alert) {
      throw new Error('Alert not found');
    }

    if (!alert.is_active) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Alert is inactive' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const notificationResults: Array<{ channel: string; success: boolean; error?: string }> = [];
    const alertPayload = payload as AlertPayload;

    // Send to webhook if configured
    if (alert.webhook_url) {
      try {
        const webhookResponse = await fetch(alert.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'alert',
            alert_type: alertPayload.alertType,
            alert_name: alertPayload.alertName,
            trigger_value: alertPayload.triggerValue,
            threshold_value: alertPayload.thresholdValue,
            message: alertPayload.message,
            context: alertPayload.contextData,
            timestamp: new Date().toISOString(),
          }),
        });

        notificationResults.push({
          channel: 'webhook',
          success: webhookResponse.ok,
          error: webhookResponse.ok ? undefined : `HTTP ${webhookResponse.status}`,
        });
        console.log(`[send-alert] Webhook sent: ${webhookResponse.ok}`);
      } catch (error) {
        notificationResults.push({
          channel: 'webhook',
          success: false,
          error: error.message,
        });
        console.error(`[send-alert] Webhook failed:`, error);
      }
    }

    // Send to Slack if configured
    if (alert.slack_webhook_url) {
      try {
        const slackPayload = {
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `🚨 Alert: ${alertPayload.alertName}`,
                emoji: true,
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Type:*\n${alertPayload.alertType}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Trigger Value:*\n${alertPayload.triggerValue}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Threshold:*\n${alertPayload.thresholdValue}`,
                },
              ],
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: alertPayload.message,
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `Triggered at ${new Date().toISOString()}`,
                },
              ],
            },
          ],
        };

        const slackResponse = await fetch(alert.slack_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackPayload),
        });

        notificationResults.push({
          channel: 'slack',
          success: slackResponse.ok,
          error: slackResponse.ok ? undefined : `HTTP ${slackResponse.status}`,
        });
        console.log(`[send-alert] Slack sent: ${slackResponse.ok}`);
      } catch (error) {
        notificationResults.push({
          channel: 'slack',
          success: false,
          error: error.message,
        });
        console.error(`[send-alert] Slack failed:`, error);
      }
    }

    // Log to alert_history
    const notificationSent = notificationResults.some(r => r.success);
    const notificationError = notificationResults
      .filter(r => !r.success)
      .map(r => `${r.channel}: ${r.error}`)
      .join('; ');

    await supabase.from('alert_history').insert({
      alert_id: alertId,
      org_id: orgId,
      trigger_value: alertPayload.triggerValue,
      threshold_value: alertPayload.thresholdValue,
      notification_sent: notificationSent,
      notification_channels: notificationResults.filter(r => r.success).map(r => r.channel),
      notification_error: notificationError || null,
      context_data: alertPayload.contextData || {},
    });

    // Update alert last_triggered_at and trigger_count
    await supabase
      .from('alerts')
      .update({
        last_triggered_at: new Date().toISOString(),
        trigger_count: alert.trigger_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', alertId);

    console.log(`[send-alert] Alert processed, ${notificationResults.filter(r => r.success).length} notifications sent`);

    return new Response(
      JSON.stringify({
        success: true,
        notificationResults,
        alertHistoryCreated: true,
      }),
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
