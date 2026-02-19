/**
 * Centralised score-band thresholds.
 * Change these values to adjust what counts as High / Medium / Low fit
 * across the entire application (frontend only — matview must match).
 */
export const HIGH_FIT_THRESHOLD = 60;
export const MEDIUM_FIT_THRESHOLD = 40;

export type ScoreBand = 'A' | 'B' | 'C';

export function getScoreBand(score: number | null | undefined): ScoreBand {
  if (!score) return 'C';
  if (score >= HIGH_FIT_THRESHOLD) return 'A';
  if (score >= MEDIUM_FIT_THRESHOLD) return 'B';
  return 'C';
}

export function getScoreLabel(score: number): string {
  if (score >= HIGH_FIT_THRESHOLD) return 'High Fit';
  if (score >= MEDIUM_FIT_THRESHOLD) return 'Medium Fit';
  return 'Low Fit';
}

export function isHighFit(score: number | null | undefined): boolean {
  return (score ?? 0) >= HIGH_FIT_THRESHOLD;
}
