-- Fix type mismatch: SUM returns NUMERIC, need to cast to BIGINT
CREATE OR REPLACE FUNCTION public.get_geography_distribution(
  p_org_id uuid,
  p_source_filter text DEFAULT 'all'
)
RETURNS TABLE(country text, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  geo_breakdown jsonb;
BEGIN
  -- Database only: Return from external_data_sources
  IF p_source_filter = 'database' THEN
    SELECT geography_breakdown INTO geo_breakdown
    FROM external_data_sources
    WHERE org_id = p_org_id AND is_active = true
    ORDER BY last_synced_at DESC
    LIMIT 1;
    
    IF geo_breakdown IS NOT NULL THEN
      RETURN QUERY
      SELECT 
        country_key::text as country,
        (country_data->>'accounts')::bigint as count
      FROM jsonb_each(geo_breakdown) AS entry(country_key, country_data)
      ORDER BY (country_data->>'accounts')::bigint DESC
      LIMIT 50;
    END IF;
    RETURN;
  END IF;

  -- CRM only: Return from accounts table
  IF p_source_filter = 'crm' THEN
    RETURN QUERY
    SELECT 
      COALESCE(a.country, 'Unknown')::text as country,
      COUNT(*)::bigint as count
    FROM accounts a
    WHERE a.org_id = p_org_id
      AND a.country IS NOT NULL
      AND a.country != ''
      AND a.data_source IN ('crm', 'both')
    GROUP BY a.country
    ORDER BY COUNT(*) DESC
    LIMIT 50;
    RETURN;
  END IF;

  -- ALL SOURCES: Combine CRM + Database
  IF p_source_filter = 'all' THEN
    SELECT geography_breakdown INTO geo_breakdown
    FROM external_data_sources
    WHERE org_id = p_org_id AND is_active = true
    ORDER BY last_synced_at DESC
    LIMIT 1;

    RETURN QUERY
    WITH crm_geo AS (
      SELECT 
        COALESCE(a.country, 'Unknown')::text as c_country,
        COUNT(*)::bigint as c_count
      FROM accounts a
      WHERE a.org_id = p_org_id
        AND a.country IS NOT NULL
        AND a.country != ''
      GROUP BY a.country
    ),
    external_geo AS (
      SELECT 
        country_key::text as e_country,
        (country_data->>'accounts')::bigint as e_count
      FROM jsonb_each(COALESCE(geo_breakdown, '{}'::jsonb)) AS entry(country_key, country_data)
      WHERE geo_breakdown IS NOT NULL
    ),
    combined AS (
      SELECT 
        combined_country,
        SUM(combined_count) as combined_total
      FROM (
        SELECT c_country as combined_country, c_count as combined_count FROM crm_geo
        UNION ALL
        SELECT e_country as combined_country, e_count as combined_count FROM external_geo
      ) all_sources
      GROUP BY combined_country
    )
    SELECT 
      combined.combined_country as country,
      combined.combined_total::bigint as count
    FROM combined
    ORDER BY combined.combined_total DESC
    LIMIT 50;
    
    RETURN;
  END IF;
END;
$function$;