/**
 * Typed interfaces for custom Supabase RPCs and JSONB columns
 * that aren't in the auto-generated types.ts
 */
import { supabase } from '@/integrations/supabase/client';

// ── Dashboard RPCs ──────────────────────────────────────────

export interface DashboardMetricsCachedResult {
  total_accounts: number;
  scored_accounts: number;
  total_leads: number;
  total_crm_accounts: number;
  total_database_accounts: number;
  scored_crm_accounts: number;
  scored_database_accounts: number;
  both_accounts: number;
  linked_leads: number;
  high_fit_accounts: number;
  medium_fit_accounts: number;
  low_fit_accounts: number;
  high_fit_crm_accounts: number;
  high_fit_database_accounts: number;
  medium_fit_crm_accounts: number;
  medium_fit_database_accounts: number;
  low_fit_crm_accounts: number;
  low_fit_database_accounts: number;
  total_crm_leads: number;
  total_database_leads: number;
  high_fit_leads: number;
  medium_fit_leads: number;
  low_fit_leads: number;
  high_fit_crm_leads: number;
  high_fit_database_leads: number;
  medium_fit_crm_leads: number;
  medium_fit_database_leads: number;
  low_fit_crm_leads: number;
  low_fit_database_leads: number;
  campaign_ready_accounts: number;
  campaign_ready: number;
  apollo_accounts_available?: number;
  apollo_contacts_available?: number;
  apollo_provider?: string;
}

export interface DataCompletenessResult {
  completeness: number;
}

// ── Branded Config RPCs ─────────────────────────────────────

export interface BrandedConfigRow {
  org_id: string;
  company_name: string | null;
  logo_url: string | null;
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
  value_proposition: string | null;
  target_persona_description: string | null;
  calendly_base_url: string | null;
}

// ── Score History / Score JSON shapes ────────────────────────

export interface ScoreSnapshot {
  overall: number;
  fit: number;
  intent: number;
  reachability: number;
}

export interface ICPScoringReasons {
  industry_match: boolean;
  size_match: boolean;
  revenue_match: boolean;
  geography_match: boolean;
}

export interface CalculateAccountScoreResult {
  overall: number;
  fit: number;
  intent: number;
  reachability: number;
  breakdown: Record<string, boolean>;
}

// ── Enriched Leads metrics RPC ──────────────────────────────

export interface EnrichedLeadsMetricsResult {
  total_enriched: number;
  high_confidence: number;
  phone_discovered: number;
  email_verified_count: number;
}

// ── Filtered Accounts RPC ───────────────────────────────────

export interface FilteredAccountRow {
  id: string;
  external_id: string;
  name: string | null;
  domain: string | null;
  industry_raw: string | null;
  industry_norm: string | null;
  employee_count: number | null;
  revenue_range: string | null;
  country: string | null;
  updated_at: string;
  data_source: string | null;
  external_database_match: boolean | null;
  enriched_from: string | null;
  enriched_at: string | null;
  total_count: number;
}

// ── Campaign Row (fuel line queries) ────────────────────────

export interface CampaignFuelLineRow {
  fuel_line_type: string | null;
  total_accounts: number | null;
  total_contacts: number | null;
  signal_source_ids: string[] | null;
  metadata: Record<string, unknown> | null;
}

// ── Helper to safely cast RPC results ───────────────────────

/**
 * Unwraps a Supabase RPC result that may return as an array or single object.
 * Avoids `as any` throughout the codebase.
 */
export function unwrapRpcResult<T>(data: unknown): T | null {
  if (data == null) return null;
  if (Array.isArray(data)) return (data[0] as T) ?? null;
  return data as T;
}

/**
 * Calls a custom RPC that isn't in the generated Supabase types.
 * Wraps supabase.rpc with proper typing to avoid `as any` casts.
 */
export async function callCustomRpc<T = unknown>(
  name: string,
  params: Record<string, unknown> = {}
): Promise<{ data: T | null; error: any }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(name, params);
  return { data: data as T | null, error };
}

import { supabase } from '@/integrations/supabase/client';
