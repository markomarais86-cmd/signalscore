-- Update get_geography_distribution to return external geography data when filter is 'database'
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
  -- When filter is 'database', return geography from external_data_sources
  IF p_source_filter = 'database' THEN
    -- Get the latest active external data source geography breakdown
    SELECT geography_breakdown INTO geo_breakdown
    FROM external_data_sources
    WHERE org_id = p_org_id 
      AND is_active = true
    ORDER BY last_synced_at DESC
    LIMIT 1;
    
    -- If we found geography data, parse and return it
    IF geo_breakdown IS NOT NULL THEN
      FOR country_key IN SELECT jsonb_object_keys(geo_breakdown)
      LOOP
        country_data := geo_breakdown -> country_key;
        RETURN QUERY SELECT 
          country_key::text, 
          (country_data->>'accounts')::bigint;
      END LOOP;
    END IF;
    
    RETURN;
  END IF;

  -- For 'all' and 'crm' filters, query accounts table (existing logic)
  RETURN QUERY
  SELECT 
    COALESCE(a.country, 'Unknown') as country,
    COUNT(*)::bigint as count
  FROM accounts a
  WHERE a.org_id = p_org_id
    AND a.country IS NOT NULL
    AND a.country != ''
    AND CASE 
      WHEN p_source_filter = 'crm' THEN a.data_source IN ('crm', 'both')
      ELSE true
    END
  GROUP BY a.country
  ORDER BY count DESC
  LIMIT 50;
END;
$function$;