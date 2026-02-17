/**
 * Compute ICP confidence score based on profile field completeness.
 * Returns a number 0-100.
 */
export function computeICPConfidence(profile: Record<string, any>): number {
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

  return score;
}
