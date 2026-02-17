-- Backfill confidence_score for existing ICPs based on field completeness
UPDATE icp_profiles 
SET confidence_score = (
  CASE WHEN array_length(industries, 1) > 0 THEN 15 ELSE 0 END +
  CASE WHEN array_length(company_sizes, 1) > 0 THEN 10 ELSE 0 END +
  CASE WHEN array_length(revenue_ranges, 1) > 0 THEN 10 ELSE 0 END +
  CASE WHEN array_length(geographies, 1) > 0 THEN 10 ELSE 0 END +
  CASE WHEN array_length(persona_job_titles, 1) > 0 THEN 10 ELSE 0 END +
  CASE WHEN array_length(persona_seniority_levels, 1) > 0 THEN 10 ELSE 0 END +
  CASE WHEN array_length(persona_departments, 1) > 0 THEN 5 ELSE 0 END +
  CASE WHEN array_length(pain_points, 1) > 0 THEN 10 ELSE 0 END +
  CASE WHEN array_length(buying_signals, 1) > 0 THEN 10 ELSE 0 END +
  CASE WHEN array_length(tech_stack, 1) > 0 THEN 5 ELSE 0 END +
  CASE WHEN array_length(company_stages, 1) > 0 THEN 5 ELSE 0 END
)
WHERE confidence_score = 0 OR confidence_score IS NULL;