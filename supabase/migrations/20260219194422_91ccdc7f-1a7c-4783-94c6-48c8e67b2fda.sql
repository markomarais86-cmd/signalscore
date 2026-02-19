-- Add api_credits_low and service_degraded to allowed alert types
ALTER TABLE public.alerts DROP CONSTRAINT alerts_alert_type_check;
ALTER TABLE public.alerts ADD CONSTRAINT alerts_alert_type_check 
  CHECK (alert_type = ANY (ARRAY[
    'velocity_drop', 'win_rate_decline', 'slippage_increase', 
    'pipeline_threshold', 'deal_at_risk', 'custom',
    'api_credits_low', 'service_degraded'
  ]));
