interface AlertPayload {
  alertId: string;
  alertType: string;
  alertName: string;
  triggerValue: number;
  thresholdValue: number;
  message: string;
  contextData?: Record<string, any>;
}

export async function sendSlack(
  url: string,
  payload: AlertPayload
): Promise<{ channel: string; success: boolean; error?: string }> {
  const body = {
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

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return response.ok
    ? { channel: 'slack', success: true }
    : { channel: 'slack', success: false, error: `HTTP ${response.status}` };
}
