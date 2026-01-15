-- Create vector similarity search function for semantic search
CREATE OR REPLACE FUNCTION search_embeddings(
  query_embedding vector(1536),
  match_org_id uuid,
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 5,
  filter_source_types text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  source_type text,
  source_id text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    de.id,
    de.source_type,
    de.source_id,
    de.content,
    de.metadata,
    1 - (de.embedding <=> query_embedding) as similarity
  FROM document_embeddings de
  WHERE 
    de.org_id = match_org_id
    AND 1 - (de.embedding <=> query_embedding) > match_threshold
    AND (filter_source_types IS NULL OR de.source_type = ANY(filter_source_types))
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create function to update AI provider health
CREATE OR REPLACE FUNCTION update_ai_provider_health(
  p_provider text,
  p_success boolean,
  p_latency_ms integer DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_existing record;
BEGIN
  SELECT * INTO v_existing 
  FROM ai_provider_health 
  WHERE provider = p_provider;

  IF FOUND THEN
    IF p_success THEN
      UPDATE ai_provider_health SET
        status = 'healthy',
        checked_at = now(),
        last_success_at = now(),
        failure_count = 0,
        avg_latency_ms = COALESCE((avg_latency_ms + COALESCE(p_latency_ms, avg_latency_ms)) / 2, p_latency_ms)
      WHERE provider = p_provider;
    ELSE
      UPDATE ai_provider_health SET
        checked_at = now(),
        last_failure_at = now(),
        failure_count = COALESCE(failure_count, 0) + 1,
        status = CASE 
          WHEN COALESCE(failure_count, 0) + 1 >= 3 THEN 'unhealthy' 
          ELSE 'degraded' 
        END
      WHERE provider = p_provider;
    END IF;
  ELSE
    INSERT INTO ai_provider_health (
      provider, 
      status, 
      checked_at,
      last_success_at, 
      last_failure_at, 
      failure_count, 
      avg_latency_ms
    ) VALUES (
      p_provider,
      CASE WHEN p_success THEN 'healthy' ELSE 'degraded' END,
      now(),
      CASE WHEN p_success THEN now() ELSE NULL END,
      CASE WHEN NOT p_success THEN now() ELSE NULL END,
      CASE WHEN p_success THEN 0 ELSE 1 END,
      p_latency_ms
    );
  END IF;
END;
$$;

-- Add index for faster embedding search if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'document_embeddings_org_idx'
  ) THEN
    CREATE INDEX document_embeddings_org_idx ON document_embeddings(org_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'document_embeddings_source_type_idx'
  ) THEN
    CREATE INDEX document_embeddings_source_type_idx ON document_embeddings(source_type);
  END IF;
END $$;