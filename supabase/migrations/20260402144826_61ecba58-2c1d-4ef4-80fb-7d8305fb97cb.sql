-- Fix broken RLS policies: change "table.id = auth.uid()" to "user_profiles.user_id = auth.uid()"
-- All these policies have the same bug pattern

-- account_merge_log
DROP POLICY IF EXISTS "Users can view their org merge logs" ON public.account_merge_log;
CREATE POLICY "Users can view their org merge logs" ON public.account_merge_log
  FOR SELECT USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert merge logs for their org" ON public.account_merge_log;
CREATE POLICY "Users can insert merge logs for their org" ON public.account_merge_log
  FOR INSERT WITH CHECK (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

-- alert_history
DROP POLICY IF EXISTS "Users can view their org alert history" ON public.alert_history;
CREATE POLICY "Users can view their org alert history" ON public.alert_history
  FOR SELECT USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

-- alerts
DROP POLICY IF EXISTS "Users can manage their org alerts" ON public.alerts;
CREATE POLICY "Users can manage their org alerts" ON public.alerts
  FOR ALL USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org alerts" ON public.alerts;
CREATE POLICY "Users can view their org alerts" ON public.alerts
  FOR SELECT USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

-- anomaly_rules
DROP POLICY IF EXISTS "Users can manage org anomaly rules" ON public.anomaly_rules;
CREATE POLICY "Users can manage org anomaly rules" ON public.anomaly_rules
  FOR ALL USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view org anomaly rules" ON public.anomaly_rules;
CREATE POLICY "Users can view org anomaly rules" ON public.anomaly_rules
  FOR SELECT USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

-- coaching_recommendations
DROP POLICY IF EXISTS "Users can manage org coaching" ON public.coaching_recommendations;
CREATE POLICY "Users can manage org coaching" ON public.coaching_recommendations
  FOR ALL USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view org coaching" ON public.coaching_recommendations;
CREATE POLICY "Users can view org coaching" ON public.coaching_recommendations
  FOR SELECT USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

-- detected_anomalies
DROP POLICY IF EXISTS "Users can manage org anomalies" ON public.detected_anomalies;
CREATE POLICY "Users can manage org anomalies" ON public.detected_anomalies
  FOR ALL USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view org anomalies" ON public.detected_anomalies;
CREATE POLICY "Users can view org anomalies" ON public.detected_anomalies
  FOR SELECT USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

-- document_embeddings
DROP POLICY IF EXISTS "Users can manage org embeddings" ON public.document_embeddings;
CREATE POLICY "Users can manage org embeddings" ON public.document_embeddings
  FOR ALL USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view org embeddings" ON public.document_embeddings;
CREATE POLICY "Users can view org embeddings" ON public.document_embeddings
  FOR SELECT USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

-- email_drafts
DROP POLICY IF EXISTS "Users can manage org drafts" ON public.email_drafts;
CREATE POLICY "Users can manage org drafts" ON public.email_drafts
  FOR ALL USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view org drafts" ON public.email_drafts;
CREATE POLICY "Users can view org drafts" ON public.email_drafts
  FOR SELECT USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

-- follow_up_sequences
DROP POLICY IF EXISTS "Users can manage org sequences" ON public.follow_up_sequences;
CREATE POLICY "Users can manage org sequences" ON public.follow_up_sequences
  FOR ALL USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view org sequences" ON public.follow_up_sequences;
CREATE POLICY "Users can view org sequences" ON public.follow_up_sequences
  FOR SELECT USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

-- funnel_events
DROP POLICY IF EXISTS "Org members can view funnel events" ON public.funnel_events;
CREATE POLICY "Org members can view funnel events" ON public.funnel_events
  FOR SELECT USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

-- icp_versions
DROP POLICY IF EXISTS "Users can view their org icp_versions" ON public.icp_versions;
CREATE POLICY "Users can view their org icp_versions" ON public.icp_versions
  FOR SELECT USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their org icp_versions" ON public.icp_versions;
CREATE POLICY "Users can insert their org icp_versions" ON public.icp_versions
  FOR INSERT WITH CHECK (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

-- pipeline_metrics_cache
DROP POLICY IF EXISTS "Users can manage their org metrics cache" ON public.pipeline_metrics_cache;
CREATE POLICY "Users can manage their org metrics cache" ON public.pipeline_metrics_cache
  FOR ALL USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org metrics cache" ON public.pipeline_metrics_cache;
CREATE POLICY "Users can view their org metrics cache" ON public.pipeline_metrics_cache
  FOR SELECT USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

-- pipeline_summaries
DROP POLICY IF EXISTS "Users can manage org summaries" ON public.pipeline_summaries;
CREATE POLICY "Users can manage org summaries" ON public.pipeline_summaries
  FOR ALL USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view org summaries" ON public.pipeline_summaries;
CREATE POLICY "Users can view org summaries" ON public.pipeline_summaries
  FOR SELECT USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

-- rep_performance
DROP POLICY IF EXISTS "Users can manage org rep performance" ON public.rep_performance;
CREATE POLICY "Users can manage org rep performance" ON public.rep_performance
  FOR ALL USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view org rep performance" ON public.rep_performance;
CREATE POLICY "Users can view org rep performance" ON public.rep_performance
  FOR SELECT USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

-- rescore_queue
DROP POLICY IF EXISTS "Users can view their org rescore queue" ON public.rescore_queue;
CREATE POLICY "Users can view their org rescore queue" ON public.rescore_queue
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

-- revenue_assumptions
DROP POLICY IF EXISTS "Users can view their org revenue_assumptions" ON public.revenue_assumptions;
CREATE POLICY "Users can view their org revenue_assumptions" ON public.revenue_assumptions
  FOR SELECT USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their org revenue_assumptions" ON public.revenue_assumptions;
CREATE POLICY "Users can insert their org revenue_assumptions" ON public.revenue_assumptions
  FOR INSERT WITH CHECK (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their org revenue_assumptions" ON public.revenue_assumptions;
CREATE POLICY "Users can update their org revenue_assumptions" ON public.revenue_assumptions
  FOR UPDATE USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

-- scheduled_follow_ups
DROP POLICY IF EXISTS "Users can manage org follow-ups" ON public.scheduled_follow_ups;
CREATE POLICY "Users can manage org follow-ups" ON public.scheduled_follow_ups
  FOR ALL USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view org follow-ups" ON public.scheduled_follow_ups;
CREATE POLICY "Users can view org follow-ups" ON public.scheduled_follow_ups
  FOR SELECT USING (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

-- dsar_requests (partial fix - only the SELECT policy has the bug in the OR clause)
DROP POLICY IF EXISTS "Users can view their own DSAR requests" ON public.dsar_requests;
CREATE POLICY "Users can view their own DSAR requests" ON public.dsar_requests
  FOR SELECT USING (
    (user_id = auth.uid()) OR
    (org_id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()))
  );

-- organizations (uses id IN (...) pattern with same bug)
DROP POLICY IF EXISTS "Users can read own org settings" ON public.organizations;
CREATE POLICY "Users can read own org settings" ON public.organizations
  FOR SELECT USING (id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own org settings" ON public.organizations;
CREATE POLICY "Users can update own org settings" ON public.organizations
  FOR UPDATE USING (id IN (SELECT user_profiles.org_id FROM user_profiles WHERE user_profiles.user_id = auth.uid()));