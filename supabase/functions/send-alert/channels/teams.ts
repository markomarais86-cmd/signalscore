interface AlertPayload {
  alertId: string;
  alertType: string;
  alertName: string;
  triggerValue: number;
  thresholdValue: number;
  message: string;
  contextData?: Record<string, any>;
}

export async function sendTeams(
  url: string,
  payload: AlertPayload
): Promise<{ channel: string; success: boolean; error?: string }> {
  const body = {
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
            { type: 'TextBlock', text: payload.message, wrap: true },
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

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return response.ok
    ? { channel: 'teams', success: true }
    : { channel: 'teams', success: false, error: `HTTP ${response.status}` };
}
