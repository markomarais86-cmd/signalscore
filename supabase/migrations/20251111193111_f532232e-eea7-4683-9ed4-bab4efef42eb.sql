-- Fix get_geography_distribution to combine CRM and Database data for 'all' filter
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
  country_key text;
  country_data jsonb;
BEGIN
  -- When filter is 'database', return geography from external_data_sources only
  IF p_source_filter = 'database' THEN
    SELECT geography_breakdown INTO geo_breakdown
    FROM external_data_sources
    WHERE org_id = p_org_id 
      AND is_active = true
    ORDER BY last_synced_at DESC
    LIMIT 1;
    
    IF geo_breakdown IS NOT NULL THEN
      RETURN QUERY
      SELECT 
        country_key::text, 
        (country_data->>'accounts')::bigint as account_count
      FROM (
        SELECT 
          jsonb_object_keys(geo_breakdown) as country_key
      ) keys
      CROSS JOIN LATERAL (
        SELECT geo_breakdown -> keys.country_key as country_data
      ) data
      ORDER BY (country_data->>'accounts')::bigint DESC
      LIMIT 50;
    END IF;
    
    RETURN;
  END IF;

  -- When filter is 'crm', return geography from accounts table only
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

  -- When filter is 'all', COMBINE both CRM and Database sources
  IF p_source_filter = 'all' THEN
    CREATE TEMP TABLE IF NOT EXISTS temp_combined_geo (
      country text PRIMARY KEY,
      count bigint
    ) ON COMMIT DROP;

    -- Add CRM data from accounts table
    INSERT INTO temp_combined_geo
    SELECT 
      COALESCE(a.country, 'Unknown') as country,
      COUNT(*)::bigint as count
    FROM accounts a
    WHERE a.org_id = p_org_id
      AND a.country IS NOT NULL
      AND a.country != ''
    GROUP BY a.country
    ON CONFLICT (country) DO UPDATE 
      SET count = temp_combined_geo.count + EXCLUDED.count;

    -- Add Database data from external_data_sources
    SELECT geography_breakdown INTO geo_breakdown
    FROM external_data_sources
    WHERE org_id = p_org_id 
      AND is_active = true
    ORDER BY last_synced_at DESC
    LIMIT 1;

    IF geo_breakdown IS NOT NULL THEN
      FOR country_key IN SELECT jsonb_object_keys(geo_breakdown)
      LOOP
        country_data := geo_breakdown -> country_key;
        INSERT INTO temp_combined_geo VALUES (
          country_key::text,
          (country_data->>'accounts')::bigint
        )
        ON CONFLICT (country) DO UPDATE 
          SET count = temp_combined_geo.count + EXCLUDED.count;
      END LOOP;
    END IF;

    RETURN QUERY 
    SELECT * FROM temp_combined_geo 
    ORDER BY count DESC 
    LIMIT 50;
    
    RETURN;
  END IF;
END;
$function$;