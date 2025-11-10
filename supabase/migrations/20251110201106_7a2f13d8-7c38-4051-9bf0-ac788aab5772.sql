-- Add base fit level tracking columns to data_quality_history
ALTER TABLE data_quality_history
ADD COLUMN IF NOT EXISTS medium_fit_accounts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS low_fit_accounts integer DEFAULT 0;