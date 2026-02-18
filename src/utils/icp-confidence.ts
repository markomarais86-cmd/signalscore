/**
 * Multi-factor ICP confidence scoring.
 *
 * Four dimensions, each weighted:
 *   1. Field Completeness  – 30 %
 *   2. Match Coverage      – 25 %  (match_count / tam_estimate)
 *   3. Fit Quality         – 25 %  (avg fit score of scored accounts)
 *   4. Validation Recency  – 20 %  (how recently accounts were scored)
 *
 * Returns { total, breakdown } where total is 0-100 and breakdown contains
 * the per-dimension scores and labels.
 */

export interface ConfidenceBreakdown {
  label: string;
  score: number;   // 0-100 within this dimension
  weight: number;  // 0-1
  weighted: number; // score * weight
}

export interface ICPConfidenceResult {
  total: number;
  breakdown: ConfidenceBreakdown[];
}

// ── helpers ────────────────────────────────────────────────────────

function computeCompleteness(profile: Record<string, any>): number {
  const fields: { key: string; points: number }[] = [
    { key: 'industries', points: 15 },
    { key: 'company_sizes', points: 10 },
    { key: 'revenue_ranges', points: 10 },
    { key: 'geographies', points: 10 },
    { key: 'persona_job_titles', points: 10 },
    { key: 'persona_seniority_levels', points: 10 },
    { key: 'persona_departments', points: 5 },
    { key: 'pain_points', points: 10 },
    { key: 'buying_signals', points: 10 },
    { key: 'tech_stack', points: 5 },
    { key: 'company_stages', points: 5 },
  ];

  let score = 0;
  for (const { key, points } of fields) {
    const value = profile[key];
    if (Array.isArray(value) && value.length > 0) {
      score += points;
    }
  }
  return score; // 0-100
}

function computeMatchCoverage(matchCount: number, tamEstimate: number): number {
  if (!tamEstimate || tamEstimate <= 0) {
    // No TAM defined – give partial credit if there are any matches
    return matchCount > 0 ? 50 : 0;
  }
  const ratio = matchCount / tamEstimate;
  // Cap at 100 – diminishing returns above 80 % coverage
  return Math.min(100, Math.round(ratio * 125));
}

function computeFitQuality(avgFit: number | null, scoredAccounts: number): number {
  if (!scoredAccounts || scoredAccounts === 0 || avgFit == null) return 0;
  // avgFit is 0-100 already; light penalty if very few accounts scored
  const volumeMultiplier = scoredAccounts >= 50 ? 1 : scoredAccounts >= 10 ? 0.9 : 0.7;
  return Math.min(100, Math.round(avgFit * volumeMultiplier));
}

function computeRecency(lastScoredAt: string | null): number {
  if (!lastScoredAt) return 0;
  const daysSince = (Date.now() - new Date(lastScoredAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 1) return 100;
  if (daysSince <= 7) return 90;
  if (daysSince <= 14) return 75;
  if (daysSince <= 30) return 50;
  if (daysSince <= 60) return 25;
  return 10;
}

// ── main export ────────────────────────────────────────────────────

export interface ScoringStats {
  matchCount?: number;
  tamEstimate?: number;
  avgFit?: number | null;
  scoredAccounts?: number;
  lastScoredAt?: string | null;
}

/**
 * Legacy single-number API (still used by ICPWizard on save).
 */
export function computeICPConfidence(profile: Record<string, any>): number {
  return computeCompleteness(profile);
}

/**
 * Enhanced multi-factor confidence score with breakdown.
 */
export function computeEnhancedICPConfidence(
  profile: Record<string, any>,
  stats: ScoringStats = {},
): ICPConfidenceResult {
  const completeness = computeCompleteness(profile);
  const coverage = computeMatchCoverage(stats.matchCount ?? 0, stats.tamEstimate ?? 0);
  const fitQuality = computeFitQuality(stats.avgFit ?? null, stats.scoredAccounts ?? 0);
  const recency = computeRecency(stats.lastScoredAt ?? null);

  const breakdown: ConfidenceBreakdown[] = [
    { label: 'Completeness', score: completeness, weight: 0.30, weighted: Math.round(completeness * 0.30) },
    { label: 'Match Coverage', score: coverage, weight: 0.25, weighted: Math.round(coverage * 0.25) },
    { label: 'Fit Quality', score: fitQuality, weight: 0.25, weighted: Math.round(fitQuality * 0.25) },
    { label: 'Validation Recency', score: recency, weight: 0.20, weighted: Math.round(recency * 0.20) },
  ];

  const total = breakdown.reduce((sum, b) => sum + b.weighted, 0);

  return { total: Math.min(100, total), breakdown };
}
