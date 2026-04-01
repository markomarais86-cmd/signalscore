interface AlertPayload {
  alertId: string;
  alertType: string;
  alertName: string;
  triggerValue: number;
  thresholdValue: number;
  message: string;
  contextData?: Record<string, any>;
}

export async function sendWebhook(
  url: string,
  payload: AlertPayload
): Promise<{ channel: string; success: boolean; error?: string }> {
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
