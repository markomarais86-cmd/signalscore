-- Add scoring_version column to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS scoring_version text DEFAULT 'legacy_v1.0';

-- Create function to automatically update org scoring version based on feature weights
CREATE OR REPLACE FUNCTION update_org_scoring_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if any weights exist for this org
  IF EXISTS (
    SELECT 1 FROM public.icp_feature_weights 
    WHERE org_id = NEW.org_id
  ) THEN
    -- Update org to use statistical v2.0
    UPDATE public.organizations
    SET scoring_version = 'statistical_v2.0'
    WHERE id = NEW.org_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on icp_feature_weights
DROP TRIGGER IF EXISTS update_org_scoring_version_trigger ON public.icp_feature_weights;
CREATE TRIGGER update_org_scoring_version_trigger
  AFTER INSERT ON public.icp_feature_weights
  FOR EACH ROW
  EXECUTE FUNCTION update_org_scoring_version();

-- Initialize scoring_version for existing orgs with weights
UPDATE public.organizations o
SET scoring_version = 'statistical_v2.0'
WHERE EXISTS (
  SELECT 1 FROM public.icp_feature_weights w
  WHERE w.org_id = o.id
);