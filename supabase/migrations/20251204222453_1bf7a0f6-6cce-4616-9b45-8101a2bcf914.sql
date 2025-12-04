-- Add sub_industry column to Leads table
ALTER TABLE "Leads" ADD COLUMN IF NOT EXISTS sub_industry TEXT;