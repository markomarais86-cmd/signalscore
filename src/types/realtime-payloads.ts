/**
 * Typed interfaces for Supabase Realtime payloads.
 * Replaces `payload.new as any` throughout notification/listener hooks.
 */

// ── Account Signals ─────────────────────────────────────────

export interface SignalPayload {
  id: string;
  org_id: string;
  account_external_id: string;
  account_name: string | null;
  signal_type: string;
  signal_priority: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

// ── AI Agent Runs ───────────────────────────────────────────

export interface AgentRunPayload {
  id: string;
  agent_id: string;
  status: string;
  current_step: string | null;
  records_processed: number | null;
  records_affected: number | null;
  progress_percentage: number | null;
  error_message: string | null;
  completed_at: string | null;
}

// ── Campaigns ───────────────────────────────────────────────

export interface CampaignPayload {
  id: string;
  org_id: string;
  name: string;
  status: string;
  total_contacts: number | null;
  total_accounts: number | null;
}

// ── Bulk Scoring Jobs ───────────────────────────────────────

export interface ScoringJobPayload {
  id: string;
  org_id: string;
  status: string;
  processed_accounts: number;
  total_accounts: number;
  successful_scores: number;
  failed_scores: number;
}

// ── Enrichment Jobs ─────────────────────────────────────────

export interface EnrichmentJobPayload {
  id: string;
  org_id: string;
  status: string;
  processed_records: number;
  total_records: number;
  accounts_enriched: number;
}

// ── Account Changes (propensity score) ──────────────────────

export interface AccountChangePayload {
  id: string;
  org_id: string;
  external_id: string;
  propensity_score: number | null;
}
