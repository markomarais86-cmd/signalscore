-- 1. user_profiles: Add WITH CHECK to UPDATE to prevent role/org_id escalation
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND org_id = get_current_user_org_id());

-- 2. credit_adjustments: Scope to org_id
DROP POLICY IF EXISTS "Authenticated users can view credit adjustments" ON public.credit_adjustments;
CREATE POLICY "Users can view own org credit adjustments"
  ON public.credit_adjustments FOR SELECT TO authenticated
  USING (org_id = get_current_user_org_id());

DROP POLICY IF EXISTS "Authenticated users can insert credit adjustments" ON public.credit_adjustments;
CREATE POLICY "Users can insert own org credit adjustments"
  ON public.credit_adjustments FOR INSERT TO authenticated
  WITH CHECK (org_id = get_current_user_org_id());

-- 3. value_creation_plans: Scope to org_id
DROP POLICY IF EXISTS "Authenticated users can read value_creation_plans" ON public.value_creation_plans;
CREATE POLICY "Users can read own org value_creation_plans"
  ON public.value_creation_plans FOR SELECT TO authenticated
  USING (org_id = get_current_user_org_id());

DROP POLICY IF EXISTS "Authenticated users can insert value_creation_plans" ON public.value_creation_plans;
CREATE POLICY "Users can insert own org value_creation_plans"
  ON public.value_creation_plans FOR INSERT TO authenticated
  WITH CHECK (org_id = get_current_user_org_id());

DROP POLICY IF EXISTS "Authenticated users can update value_creation_plans" ON public.value_creation_plans;
CREATE POLICY "Users can update own org value_creation_plans"
  ON public.value_creation_plans FOR UPDATE TO authenticated
  USING (org_id = get_current_user_org_id())
  WITH CHECK (org_id = get_current_user_org_id());

-- 4. value_creation_milestones: Scope to org_id
DROP POLICY IF EXISTS "Authenticated users can read value_creation_milestones" ON public.value_creation_milestones;
CREATE POLICY "Users can read own org value_creation_milestones"
  ON public.value_creation_milestones FOR SELECT TO authenticated
  USING (org_id = get_current_user_org_id());

DROP POLICY IF EXISTS "Authenticated users can insert value_creation_milestones" ON public.value_creation_milestones;
CREATE POLICY "Users can insert own org value_creation_milestones"
  ON public.value_creation_milestones FOR INSERT TO authenticated
  WITH CHECK (org_id = get_current_user_org_id());

DROP POLICY IF EXISTS "Authenticated users can update value_creation_milestones" ON public.value_creation_milestones;
CREATE POLICY "Users can update own org value_creation_milestones"
  ON public.value_creation_milestones FOR UPDATE TO authenticated
  USING (org_id = get_current_user_org_id())
  WITH CHECK (org_id = get_current_user_org_id());

-- 5. system_health_checks: Restrict to service_role
DROP POLICY IF EXISTS "Service role has full access to health checks" ON public.system_health_checks;
CREATE POLICY "Service role has full access to health checks"
  ON public.system_health_checks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 6. ai_provider_health: Write=service_role, read=authenticated
DROP POLICY IF EXISTS "System can manage provider health" ON public.ai_provider_health;
CREATE POLICY "Service role can manage provider health"
  ON public.ai_provider_health FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view provider health" ON public.ai_provider_health;
CREATE POLICY "Authenticated users can view provider health"
  ON public.ai_provider_health FOR SELECT TO authenticated
  USING (true);

-- 7. quiz_responses: Restrict SELECT to admins only
DROP POLICY IF EXISTS "Authenticated users can read quiz responses" ON public.quiz_responses;
CREATE POLICY "Admins can read quiz responses"
  ON public.quiz_responses FOR SELECT TO authenticated
  USING (is_current_user_admin());