-- Fix ambiguous column reference in get_geography_distribution for 'all' filter
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
  -- Database only
  IF p_source_filter = 'database' THEN
    SELECT geography_breakdown INTO geo_breakdown
    FROM external_data_sources
    WHERE org_id = p_org_id AND is_active = true
    ORDER BY last_synced_at DESC
    LIMIT 1;
    
    IF geo_breakdown IS NOT NULL THEN
      RETURN QUERY
      SELECT 
        country_key::text, 
        (country_data->>'accounts')::bigint
      FROM jsonb_each(geo_breakdown) AS entry(country_key, country_data)
      ORDER BY (country_data->>'accounts')::bigint DESC
      LIMIT 50;
    END IF;
    RETURN;
  END IF;

  -- CRM only
  IF p_source_filter = 'crm' THEN
    RETURN QUERY
    SELECT 
      COALESCE(a.country, 'Unknown') as country,
      COUNT(*)::bigint as count
    FROM accounts a
    WHERE a.org_id = p_org_id
      AND a.country IS NOT NULL
      AND a.country != ''
      AND a.data_source IN ('crm', 'both')
    GROUP BY a.country
    ORDER BY count DESC
    LIMIT 50;
    RETURN;
  END IF;

  -- ALL SOURCES: Fixed version with explicit column aliases
  IF p_source_filter = 'all' THEN
    -- Get external data
    SELECT geography_breakdown INTO geo_breakdown
    FROM external_data_sources
    WHERE org_id = p_org_id AND is_active = true
    ORDER BY last_synced_at DESC
    LIMIT 1;

    RETURN QUERY
    WITH crm_geo AS (
      -- CRM geography counts
      SELECT 
        COALESCE(a.country, 'Unknown') as country,
        COUNT(*)::bigint as count
      FROM accounts a
      WHERE a.org_id = p_org_id
        AND a.country IS NOT NULL
        AND a.country != ''
      GROUP BY a.country
    ),
    external_geo AS (
      -- External geography counts (only if exists)
      SELECT 
        country_key::text as country,
        (country_data->>'accounts')::bigint as count
      FROM jsonb_each(COALESCE(geo_breakdown, '{}'::jsonb)) AS entry(country_key, country_data)
      WHERE geo_breakdown IS NOT NULL
    ),
    combined AS (
      -- Union and sum both sources with explicit aliases
      SELECT 
        all_geo.country_name,
        SUM(all_geo.country_count) as total_count
      FROM (
        SELECT country as country_name, count as country_count FROM crm_geo
        UNION ALL
        SELECT country as country_name, count as country_count FROM external_geo
      ) all_geo
      GROUP BY all_geo.country_name
    )
    SELECT combined.country_name as country, combined.total_count as count
    FROM combined
    ORDER BY combined.total_count DESC
    LIMIT 50;
    
    RETURN;
  END IF;
END;
$function$;