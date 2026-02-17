
CREATE OR REPLACE FUNCTION increment_enrichment_credits(
  p_org_id UUID,
  p_amount INTEGER
) RETURNS void AS $$
BEGIN
  UPDATE organizations
  SET enrichment_credits_used = COALESCE(enrichment_credits_used, 0) + p_amount
  WHERE id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
