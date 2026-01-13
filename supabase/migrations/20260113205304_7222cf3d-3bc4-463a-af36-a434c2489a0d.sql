-- =============================================
-- FIX OVERLY PERMISSIVE RLS POLICIES
-- =============================================

-- 1. deal_stage_history - UPDATE needs org check
DROP POLICY IF EXISTS "System can update deal history" ON deal_stage_history;
CREATE POLICY "Users can update deal history in their org"
ON deal_stage_history FOR UPDATE
USING (org_id = get_current_user_org_id());

-- 2. ai_action_logs - INSERT needs org check
DROP POLICY IF EXISTS "System can insert action logs" ON ai_action_logs;
CREATE POLICY "System can insert action logs for org"
ON ai_action_logs FOR INSERT
WITH CHECK (org_id = get_current_user_org_id());

-- 3. ai_usage_tracking - INSERT needs org check
DROP POLICY IF EXISTS "System can insert AI usage" ON ai_usage_tracking;
CREATE POLICY "System can insert AI usage for org"
ON ai_usage_tracking FOR INSERT
WITH CHECK (org_id = get_current_user_org_id());

-- 4. auto_score_failures - INSERT needs org check
DROP POLICY IF EXISTS "System can insert auto score failures" ON auto_score_failures;
CREATE POLICY "System can insert score failures for org"
ON auto_score_failures FOR INSERT
WITH CHECK (org_id = get_current_user_org_id());

-- 5. clay_webhook_logs - INSERT/UPDATE need org check
DROP POLICY IF EXISTS "System can insert webhook logs" ON clay_webhook_logs;
DROP POLICY IF EXISTS "System can update webhook logs" ON clay_webhook_logs;
CREATE POLICY "Insert webhook logs for org"
ON clay_webhook_logs FOR INSERT
WITH CHECK (org_id = get_current_user_org_id());
CREATE POLICY "Update webhook logs for org"
ON clay_webhook_logs FOR UPDATE
USING (org_id = get_current_user_org_id());

-- 6. consent_registry - INSERT/UPDATE need org check
DROP POLICY IF EXISTS "System can insert consent records" ON consent_registry;
DROP POLICY IF EXISTS "System can update consent records" ON consent_registry;
CREATE POLICY "Insert consent for org"
ON consent_registry FOR INSERT
WITH CHECK (org_id = get_current_user_org_id());
CREATE POLICY "Update consent for org"
ON consent_registry FOR UPDATE
USING (org_id = get_current_user_org_id());

-- 7. enrichment_field_coverage - ALL needs org check
DROP POLICY IF EXISTS "System can manage field coverage" ON enrichment_field_coverage;
CREATE POLICY "Users can manage field coverage in their org"
ON enrichment_field_coverage FOR ALL
USING (org_id = get_current_user_org_id())
WITH CHECK (org_id = get_current_user_org_id());

-- 8. enrichment_history - INSERT needs org check
DROP POLICY IF EXISTS "System can insert enrichment history" ON enrichment_history;
CREATE POLICY "Insert enrichment history for org"
ON enrichment_history FOR INSERT
WITH CHECK (org_id = get_current_user_org_id());

-- 9. enrichment_spending - INSERT/UPDATE need org check
DROP POLICY IF EXISTS "System can insert spending" ON enrichment_spending;
DROP POLICY IF EXISTS "System can update spending" ON enrichment_spending;
CREATE POLICY "Insert spending for org"
ON enrichment_spending FOR INSERT
WITH CHECK (org_id = get_current_user_org_id());
CREATE POLICY "Update spending for org"
ON enrichment_spending FOR UPDATE
USING (org_id = get_current_user_org_id());

-- 10. icp_feature_weights - INSERT/UPDATE need org check
DROP POLICY IF EXISTS "System can insert feature weights" ON icp_feature_weights;
DROP POLICY IF EXISTS "System can update feature weights" ON icp_feature_weights;
CREATE POLICY "Insert feature weights for org"
ON icp_feature_weights FOR INSERT
WITH CHECK (org_id = get_current_user_org_id());
CREATE POLICY "Update feature weights for org"
ON icp_feature_weights FOR UPDATE
USING (org_id = get_current_user_org_id());

-- 11. idempotency_keys - ALL needs org check
DROP POLICY IF EXISTS "System can manage idempotency keys" ON idempotency_keys;
CREATE POLICY "Manage idempotency keys for org"
ON idempotency_keys FOR ALL
USING (org_id = get_current_user_org_id())
WITH CHECK (org_id = get_current_user_org_id());

-- 12. identity_registry - INSERT/UPDATE need org check
DROP POLICY IF EXISTS "System can insert identity records" ON identity_registry;
DROP POLICY IF EXISTS "System can update identity records" ON identity_registry;
CREATE POLICY "Insert identity for org"
ON identity_registry FOR INSERT
WITH CHECK (org_id = get_current_user_org_id());
CREATE POLICY "Update identity for org"
ON identity_registry FOR UPDATE
USING (org_id = get_current_user_org_id());

-- 13. job_recovery_log - INSERT needs org check
DROP POLICY IF EXISTS "System can insert recovery logs" ON job_recovery_log;
CREATE POLICY "Insert recovery logs for org"
ON job_recovery_log FOR INSERT
WITH CHECK (org_id = get_current_user_org_id());

-- 14. recommendation_history - ALL needs org check
DROP POLICY IF EXISTS "System can manage recommendation history" ON recommendation_history;
CREATE POLICY "Manage recommendations for org"
ON recommendation_history FOR ALL
USING (org_id = get_current_user_org_id())
WITH CHECK (org_id = get_current_user_org_id());

-- 15. verification_log - INSERT needs org check
DROP POLICY IF EXISTS "System can insert verification logs" ON verification_log;
CREATE POLICY "Insert verification logs for org"
ON verification_log FOR INSERT
WITH CHECK (org_id = get_current_user_org_id());

-- 16. webhook_logs - INSERT/UPDATE need org check
DROP POLICY IF EXISTS "System can insert webhook logs" ON webhook_logs;
DROP POLICY IF EXISTS "System can update webhook logs" ON webhook_logs;
CREATE POLICY "Insert webhook logs for org"
ON webhook_logs FOR INSERT
WITH CHECK (org_id = get_current_user_org_id());
CREATE POLICY "Update webhook logs for org"
ON webhook_logs FOR UPDATE
USING (org_id = get_current_user_org_id());