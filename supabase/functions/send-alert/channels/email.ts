interface AlertPayload {
  alertId: string;
  alertType: string;
  alertName: string;
  triggerValue: number;
  thresholdValue: number;
  message: string;
  contextData?: Record<string, any>;
}

export async function sendEmail(
  recipients: string[],
  payload: AlertPayload,
  supabaseClient: any
): Promise<{ channel: string; success: boolean; error?: string }> {
  if (!recipients || recipients.length === 0) {
    return { channel: 'email', success: false, error: 'No email recipients configured' };
  }

  // Send individual emails via Supabase's built-in email or a transactional edge function
  const results: boolean[] = [];

  for (const recipient of recipients) {
    try {
      // Use the send-transactional-email function if available, otherwise fall back to a simple approach
      const { error } = await supabaseClient.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'alert-notification',
          recipientEmail: recipient,
          idempotencyKey: `alert-${payload.alertId}-${Date.now()}`,
          templateData: {
            alertName: payload.alertName,
            alertType: payload.alertType,
            triggerValue: payload.triggerValue,
            thresholdValue: payload.thresholdValue,
            message: payload.message,
            triggeredAt: new Date().toISOString(),
          },
        },
      });

      if (error) {
        console.warn(`[send-alert] Email to ${recipient} failed via transactional:`, error.message);
        // Fallback: send via Resend if available
        const resendKey = Deno.env.get('RESEND_API_KEY');
        if (resendKey) {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: 'LaunchPulse Alerts <alerts@launchpulse.app>',
              to: [recipient],
              subject: `🚨 Alert: ${payload.alertName}`,
              html: buildEmailHtml(payload),
            }),
          });
          results.push(res.ok);
        } else {
          results.push(false);
        }
      } else {
        results.push(true);
      }
    } catch (e) {
      console.error(`[send-alert] Email to ${recipient} error:`, e);
      results.push(false);
    }
  }

  const anySuccess = results.some(Boolean);
  return anySuccess
    ? { channel: 'email', success: true }
    : { channel: 'email', success: false, error: `Failed to send to ${recipients.length} recipient(s)` };
}

function buildEmailHtml(payload: AlertPayload): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #dc2626; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">🚨 Alert: ${payload.alertName}</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: 0; padding: 24px; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Type</td>
            <td style="padding: 8px 0; font-weight: 600;">${payload.alertType}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Trigger Value</td>
            <td style="padding: 8px 0; font-weight: 600;">${payload.triggerValue}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Threshold</td>
            <td style="padding: 8px 0; font-weight: 600;">${payload.thresholdValue}</td>
          </tr>
        </table>
        <p style="color: #374151; line-height: 1.6;">${payload.message}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">Triggered at ${new Date().toISOString()}</p>
      </div>
    </div>
  `;
}
