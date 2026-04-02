-- Fix 1: ai_agent_registry - "Service role can manage agent registry" targets public, should be service_role
DROP POLICY IF EXISTS "Service role can manage agent registry" ON public.ai_agent_registry;
CREATE POLICY "Service role can manage agent registry"
  ON public.ai_agent_registry
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Fix 2: enrichment_costs - "Service role can insert enrichment costs" targets public, should be service_role
DROP POLICY IF EXISTS "Service role can insert enrichment costs" ON public.enrichment_costs;
CREATE POLICY "Service role can insert enrichment costs"
  ON public.enrichment_costs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Fix 3: weekly_analytics_snapshots - insert/update policies target public, should be service_role
DROP POLICY IF EXISTS "System can insert snapshots" ON public.weekly_analytics_snapshots;
CREATE POLICY "System can insert snapshots"
  ON public.weekly_analytics_snapshots
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can update snapshots" ON public.weekly_analytics_snapshots;
CREATE POLICY "System can update snapshots"
  ON public.weekly_analytics_snapshots
  FOR UPDATE
  TO service_role
  USING (true);