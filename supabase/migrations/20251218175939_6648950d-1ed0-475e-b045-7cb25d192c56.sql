-- Phase 3: Anomaly Detection System
-- Anomaly detection rules and triggers
CREATE TABLE IF NOT EXISTS anomaly_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  comparison TEXT NOT NULL,
  threshold NUMERIC NOT NULL,
  lookback_days INTEGER DEFAULT 7,
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE anomaly_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org anomaly rules" ON anomaly_rules
  FOR SELECT USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage org anomaly rules" ON anomaly_rules
  FOR ALL USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

-- Detected anomalies
CREATE TABLE IF NOT EXISTS detected_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES anomaly_rules(id) ON DELETE SET NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  expected_value NUMERIC,
  deviation_percent NUMERIC,
  severity TEXT DEFAULT 'warning',
  explanation TEXT,
  ai_recommendation TEXT,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE detected_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org anomalies" ON detected_anomalies
  FOR SELECT USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage org anomalies" ON detected_anomalies
  FOR ALL USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

CREATE INDEX idx_detected_anomalies_org ON detected_anomalies(org_id);
CREATE INDEX idx_detected_anomalies_created ON detected_anomalies(created_at DESC);
CREATE INDEX idx_anomaly_rules_org ON anomaly_rules(org_id);

-- Phase 4: RAG System
-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Document embeddings for RAG
CREATE TABLE IF NOT EXISTS document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org embeddings" ON document_embeddings
  FOR SELECT USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage org embeddings" ON document_embeddings
  FOR ALL USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

CREATE INDEX idx_document_embeddings_org ON document_embeddings(org_id);
CREATE INDEX idx_document_embeddings_source ON document_embeddings(source_type, source_id);

-- Phase 5: Content Generation & Follow-up Automation
-- Follow-up sequences
CREATE TABLE IF NOT EXISTS follow_up_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,
  steps JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE follow_up_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org sequences" ON follow_up_sequences
  FOR SELECT USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage org sequences" ON follow_up_sequences
  FOR ALL USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

-- Scheduled follow-ups
CREATE TABLE IF NOT EXISTS scheduled_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sequence_id UUID REFERENCES follow_up_sequences(id) ON DELETE CASCADE,
  account_external_id TEXT,
  lead_id INTEGER,
  deal_id UUID,
  current_step INTEGER DEFAULT 0,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'cancelled', 'failed')),
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE scheduled_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org follow-ups" ON scheduled_follow_ups
  FOR SELECT USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage org follow-ups" ON scheduled_follow_ups
  FOR ALL USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

CREATE INDEX idx_scheduled_follow_ups_org ON scheduled_follow_ups(org_id);
CREATE INDEX idx_scheduled_follow_ups_scheduled ON scheduled_follow_ups(scheduled_at) WHERE status = 'pending';

-- Email drafts table
CREATE TABLE IF NOT EXISTS email_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_external_id TEXT,
  lead_id INTEGER,
  deal_id UUID,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  draft_type TEXT DEFAULT 'outreach',
  context_used JSONB DEFAULT '{}',
  ai_model TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent', 'discarded')),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org drafts" ON email_drafts
  FOR SELECT USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage org drafts" ON email_drafts
  FOR ALL USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

CREATE INDEX idx_email_drafts_org ON email_drafts(org_id);
CREATE INDEX idx_email_drafts_status ON email_drafts(status);

-- Phase 6: Rep Performance & Coaching
-- Rep performance metrics
CREATE TABLE IF NOT EXISTS rep_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  calls_made INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  meetings_booked INTEGER DEFAULT 0,
  deals_won INTEGER DEFAULT 0,
  deals_lost INTEGER DEFAULT 0,
  pipeline_generated NUMERIC DEFAULT 0,
  revenue_closed NUMERIC DEFAULT 0,
  avg_deal_size NUMERIC,
  avg_sales_cycle_days NUMERIC,
  win_rate NUMERIC,
  avg_talk_ratio NUMERIC,
  objection_handling_score NUMERIC,
  discovery_score NUMERIC,
  closing_score NUMERIC,
  computed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rep_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org rep performance" ON rep_performance
  FOR SELECT USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage org rep performance" ON rep_performance
  FOR ALL USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

CREATE INDEX idx_rep_performance_org ON rep_performance(org_id);
CREATE INDEX idx_rep_performance_user ON rep_performance(user_id);
CREATE INDEX idx_rep_performance_period ON rep_performance(period_start, period_end);

-- Coaching recommendations
CREATE TABLE IF NOT EXISTS coaching_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  topic TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  category TEXT DEFAULT 'general',
  example_call_id UUID,
  best_practice_source UUID,
  evidence JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'dismissed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE coaching_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org coaching" ON coaching_recommendations
  FOR SELECT USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage org coaching" ON coaching_recommendations
  FOR ALL USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

CREATE INDEX idx_coaching_recommendations_org ON coaching_recommendations(org_id);
CREATE INDEX idx_coaching_recommendations_user ON coaching_recommendations(user_id);
CREATE INDEX idx_coaching_recommendations_status ON coaching_recommendations(status);

-- Pipeline summaries for AI summarization
CREATE TABLE IF NOT EXISTS pipeline_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  summary_type TEXT DEFAULT 'daily',
  summary_text TEXT NOT NULL,
  key_insights JSONB DEFAULT '[]',
  risks JSONB DEFAULT '[]',
  opportunities JSONB DEFAULT '[]',
  recommended_actions JSONB DEFAULT '[]',
  metrics_snapshot JSONB DEFAULT '{}',
  ai_model TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pipeline_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org summaries" ON pipeline_summaries
  FOR SELECT USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage org summaries" ON pipeline_summaries
  FOR ALL USING (org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

CREATE INDEX idx_pipeline_summaries_org ON pipeline_summaries(org_id);
CREATE INDEX idx_pipeline_summaries_generated ON pipeline_summaries(generated_at DESC);

-- Insert default anomaly rules
INSERT INTO anomaly_rules (org_id, name, metric_name, comparison, threshold, lookback_days, severity)
SELECT id, 'Win Rate Drop', 'win_rate', 'decrease_by', 20, 7, 'critical' FROM organizations
UNION ALL
SELECT id, 'Velocity Slowdown', 'sales_velocity', 'decrease_by', 30, 14, 'warning' FROM organizations
UNION ALL
SELECT id, 'Conversion Drop', 'conversion_rate', 'decrease_by', 25, 7, 'critical' FROM organizations
UNION ALL
SELECT id, 'Pipeline Value Drop', 'pipeline_value', 'decrease_by', 40, 7, 'critical' FROM organizations
UNION ALL
SELECT id, 'Cycle Length Increase', 'avg_cycle_length', 'increase_by', 50, 14, 'warning' FROM organizations;

-- Insert default follow-up sequences
INSERT INTO follow_up_sequences (org_id, name, description, trigger_event, steps)
SELECT id, 'Post-Demo Follow-up', 'Automated follow-up after demo calls', 'demo_completed', 
  '[{"delay_days": 1, "action_type": "email", "template": "thank_you_demo"}, {"delay_days": 3, "action_type": "email", "template": "proposal_reminder"}, {"delay_days": 7, "action_type": "task", "template": "call_follow_up"}]'::jsonb
FROM organizations
UNION ALL
SELECT id, 'No Response Nurture', 'Re-engage prospects who went silent', 'no_response_7_days',
  '[{"delay_days": 7, "action_type": "email", "template": "check_in"}, {"delay_days": 14, "action_type": "email", "template": "value_add"}, {"delay_days": 21, "action_type": "email", "template": "break_up"}]'::jsonb
FROM organizations
UNION ALL
SELECT id, 'Post-Meeting Prep', 'Pre and post meeting automation', 'meeting_scheduled',
  '[{"delay_days": -1, "action_type": "task", "template": "meeting_prep"}, {"delay_days": 0, "action_type": "email", "template": "meeting_reminder"}, {"delay_days": 1, "action_type": "email", "template": "meeting_recap"}]'::jsonb
FROM organizations;