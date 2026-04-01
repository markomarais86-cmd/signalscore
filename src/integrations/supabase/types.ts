export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      account_insights: {
        Row: {
          account_external_id: string
          confidence: number | null
          content: Json
          created_at: string
          expires_at: string
          generated_at: string
          id: string
          insight_type: string
          org_id: string
        }
        Insert: {
          account_external_id: string
          confidence?: number | null
          content?: Json
          created_at?: string
          expires_at?: string
          generated_at?: string
          id?: string
          insight_type: string
          org_id: string
        }
        Update: {
          account_external_id?: string
          confidence?: number | null
          content?: Json
          created_at?: string
          expires_at?: string
          generated_at?: string
          id?: string
          insight_type?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_insights_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      account_merge_log: {
        Row: {
          created_at: string
          id: string
          merge_details: Json | null
          merged_at: string
          merged_by: string | null
          new_account_external_id: string
          old_account_data: Json | null
          old_account_external_id: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          merge_details?: Json | null
          merged_at?: string
          merged_by?: string | null
          new_account_external_id: string
          old_account_data?: Json | null
          old_account_external_id: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          merge_details?: Json | null
          merged_at?: string
          merged_by?: string | null
          new_account_external_id?: string
          old_account_data?: Json | null
          old_account_external_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_merge_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      account_segments: {
        Row: {
          account_id: string
          assigned_at: string
          assigned_by: string | null
          id: string
          org_id: string
          segment_id: string
        }
        Insert: {
          account_id: string
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          org_id: string
          segment_id: string
        }
        Update: {
          account_id?: string
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          org_id?: string
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_segments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_segments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_segments_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      account_signals: {
        Row: {
          account_external_id: string
          account_name: string | null
          actioned_at: string | null
          created_at: string | null
          description: string | null
          dismissed_at: string | null
          expires_at: string | null
          id: string
          metadata: Json | null
          org_id: string
          signal_priority: string
          signal_type: string
          title: string
        }
        Insert: {
          account_external_id: string
          account_name?: string | null
          actioned_at?: string | null
          created_at?: string | null
          description?: string | null
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          org_id: string
          signal_priority?: string
          signal_type: string
          title: string
        }
        Update: {
          account_external_id?: string
          account_name?: string | null
          actioned_at?: string | null
          created_at?: string | null
          description?: string | null
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string
          signal_priority?: string
          signal_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_signals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          business_model: string | null
          city: string | null
          company_main_phone: string | null
          country: string | null
          custom_attributes: Json | null
          data_source: string | null
          deep_research_completed_at: string | null
          deep_research_requested: boolean | null
          domain: string | null
          employee_count: number | null
          enriched_at: string | null
          enriched_from: string | null
          enrichment_citations: Json | null
          enrichment_confidence: number | null
          enrichment_field_scores: Json | null
          enrichment_overall_score: number | null
          enrichment_phase: string | null
          external_database_match: boolean | null
          external_id: string
          facebook_url: string | null
          founded_year: number | null
          hq_address: string | null
          hq_city: string | null
          hq_postal_code: string | null
          hq_state: string | null
          icp_fail_reasons: string[] | null
          icp_qualified: boolean | null
          id: string
          industry_norm: string | null
          industry_raw: string | null
          last_funding_date: string | null
          last_funding_round: string | null
          last_verified_at: string | null
          legal_name: string | null
          linkedin_url: string | null
          manually_verified: Json | null
          mobile: string | null
          naics: string | null
          name: string | null
          org_id: string
          phone: string | null
          propensity_computed_at: string | null
          propensity_score: number | null
          revenue_range: string | null
          sic_code: string | null
          state_province: string | null
          sub_industry: string | null
          tech_stack: string[] | null
          total_raised_usd: number | null
          trust_signals: Json | null
          twitter_url: string | null
          updated_at: string | null
        }
        Insert: {
          business_model?: string | null
          city?: string | null
          company_main_phone?: string | null
          country?: string | null
          custom_attributes?: Json | null
          data_source?: string | null
          deep_research_completed_at?: string | null
          deep_research_requested?: boolean | null
          domain?: string | null
          employee_count?: number | null
          enriched_at?: string | null
          enriched_from?: string | null
          enrichment_citations?: Json | null
          enrichment_confidence?: number | null
          enrichment_field_scores?: Json | null
          enrichment_overall_score?: number | null
          enrichment_phase?: string | null
          external_database_match?: boolean | null
          external_id: string
          facebook_url?: string | null
          founded_year?: number | null
          hq_address?: string | null
          hq_city?: string | null
          hq_postal_code?: string | null
          hq_state?: string | null
          icp_fail_reasons?: string[] | null
          icp_qualified?: boolean | null
          id?: string
          industry_norm?: string | null
          industry_raw?: string | null
          last_funding_date?: string | null
          last_funding_round?: string | null
          last_verified_at?: string | null
          legal_name?: string | null
          linkedin_url?: string | null
          manually_verified?: Json | null
          mobile?: string | null
          naics?: string | null
          name?: string | null
          org_id: string
          phone?: string | null
          propensity_computed_at?: string | null
          propensity_score?: number | null
          revenue_range?: string | null
          sic_code?: string | null
          state_province?: string | null
          sub_industry?: string | null
          tech_stack?: string[] | null
          total_raised_usd?: number | null
          trust_signals?: Json | null
          twitter_url?: string | null
          updated_at?: string | null
        }
        Update: {
          business_model?: string | null
          city?: string | null
          company_main_phone?: string | null
          country?: string | null
          custom_attributes?: Json | null
          data_source?: string | null
          deep_research_completed_at?: string | null
          deep_research_requested?: boolean | null
          domain?: string | null
          employee_count?: number | null
          enriched_at?: string | null
          enriched_from?: string | null
          enrichment_citations?: Json | null
          enrichment_confidence?: number | null
          enrichment_field_scores?: Json | null
          enrichment_overall_score?: number | null
          enrichment_phase?: string | null
          external_database_match?: boolean | null
          external_id?: string
          facebook_url?: string | null
          founded_year?: number | null
          hq_address?: string | null
          hq_city?: string | null
          hq_postal_code?: string | null
          hq_state?: string | null
          icp_fail_reasons?: string[] | null
          icp_qualified?: boolean | null
          id?: string
          industry_norm?: string | null
          industry_raw?: string | null
          last_funding_date?: string | null
          last_funding_round?: string | null
          last_verified_at?: string | null
          legal_name?: string | null
          linkedin_url?: string | null
          manually_verified?: Json | null
          mobile?: string | null
          naics?: string | null
          name?: string | null
          org_id?: string
          phone?: string | null
          propensity_computed_at?: string | null
          propensity_score?: number | null
          revenue_range?: string | null
          sic_code?: string | null
          state_province?: string | null
          sub_industry?: string | null
          tech_stack?: string[] | null
          total_raised_usd?: number | null
          trust_signals?: Json | null
          twitter_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      action_templates: {
        Row: {
          action_type: string
          content_template: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          org_id: string
          priority_weight: number | null
          subject_template: string | null
          success_rate: number | null
          suggested_delay_hours: number | null
          trigger_conditions: Json | null
          updated_at: string
          usage_count: number | null
          variables: Json | null
        }
        Insert: {
          action_type: string
          content_template?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          org_id: string
          priority_weight?: number | null
          subject_template?: string | null
          success_rate?: number | null
          suggested_delay_hours?: number | null
          trigger_conditions?: Json | null
          updated_at?: string
          usage_count?: number | null
          variables?: Json | null
        }
        Update: {
          action_type?: string
          content_template?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          org_id?: string
          priority_weight?: number | null
          subject_template?: string | null
          success_rate?: number | null
          suggested_delay_hours?: number | null
          trigger_conditions?: Json | null
          updated_at?: string
          usage_count?: number | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "action_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          account_external_id: string | null
          activity_date: string
          activity_type: string
          completed_at: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          duration_minutes: number | null
          external_id: string | null
          id: string
          lead_id: number | null
          metadata: Json | null
          org_id: string
          outcome: string | null
          owner_id: string | null
          owner_name: string | null
          subject: string | null
        }
        Insert: {
          account_external_id?: string | null
          activity_date: string
          activity_type: string
          completed_at?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          duration_minutes?: number | null
          external_id?: string | null
          id?: string
          lead_id?: number | null
          metadata?: Json | null
          org_id: string
          outcome?: string | null
          owner_id?: string | null
          owner_name?: string | null
          subject?: string | null
        }
        Update: {
          account_external_id?: string | null
          activity_date?: string
          activity_type?: string
          completed_at?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          duration_minutes?: number | null
          external_id?: string | null
          id?: string
          lead_id?: number | null
          metadata?: Json | null
          org_id?: string
          outcome?: string | null
          owner_id?: string | null
          owner_name?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "Leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_action_logs: {
        Row: {
          action_name: string
          action_parameters: Json
          action_result: Json | null
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          id: string
          org_id: string
          status: string
          user_id: string | null
          workflow_id: string | null
        }
        Insert: {
          action_name: string
          action_parameters?: Json
          action_result?: Json | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          org_id: string
          status?: string
          user_id?: string | null
          workflow_id?: string | null
        }
        Update: {
          action_name?: string
          action_parameters?: Json
          action_result?: Json | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          org_id?: string
          status?: string
          user_id?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_action_logs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "ai_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_action_templates: {
        Row: {
          action_type: string
          created_at: string
          description: string | null
          id: string
          last_used_at: string | null
          name: string
          org_id: string
          parameters: Json | null
          success_rate: number | null
          updated_at: string
          usage_count: number | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          description?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          org_id: string
          parameters?: Json | null
          success_rate?: number | null
          updated_at?: string
          usage_count?: number | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          org_id?: string
          parameters?: Json | null
          success_rate?: number | null
          updated_at?: string
          usage_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_feedback: {
        Row: {
          account_id: string | null
          agent_id: string | null
          ai_reasoning: string | null
          confidence_score: number | null
          context_data: Json | null
          created_at: string
          decision_type: string
          feedback_notes: string | null
          feedback_score: number | null
          id: string
          lead_id: string | null
          org_id: string
          outcome: string | null
          outcome_at: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          agent_id?: string | null
          ai_reasoning?: string | null
          confidence_score?: number | null
          context_data?: Json | null
          created_at?: string
          decision_type: string
          feedback_notes?: string | null
          feedback_score?: number | null
          id?: string
          lead_id?: string | null
          org_id: string
          outcome?: string | null
          outcome_at?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          agent_id?: string | null
          ai_reasoning?: string | null
          confidence_score?: number | null
          context_data?: Json | null
          created_at?: string
          decision_type?: string
          feedback_notes?: string | null
          feedback_score?: number | null
          id?: string
          lead_id?: string | null
          org_id?: string
          outcome?: string | null
          outcome_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_feedback_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_feedback_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_registry: {
        Row: {
          agent_name: string
          agent_type: string
          avg_latency_ms: number | null
          capabilities: Json
          created_at: string
          health_score: number | null
          id: string
          input_schema: Json | null
          last_error: string | null
          last_heartbeat: string | null
          metadata: Json | null
          org_id: string
          output_schema: Json | null
          status: Database["public"]["Enums"]["agent_registry_status"]
          success_rate: number | null
          total_invocations: number | null
          updated_at: string
        }
        Insert: {
          agent_name: string
          agent_type: string
          avg_latency_ms?: number | null
          capabilities?: Json
          created_at?: string
          health_score?: number | null
          id?: string
          input_schema?: Json | null
          last_error?: string | null
          last_heartbeat?: string | null
          metadata?: Json | null
          org_id: string
          output_schema?: Json | null
          status?: Database["public"]["Enums"]["agent_registry_status"]
          success_rate?: number | null
          total_invocations?: number | null
          updated_at?: string
        }
        Update: {
          agent_name?: string
          agent_type?: string
          avg_latency_ms?: number | null
          capabilities?: Json
          created_at?: string
          health_score?: number | null
          id?: string
          input_schema?: Json | null
          last_error?: string | null
          last_heartbeat?: string | null
          metadata?: Json | null
          org_id?: string
          output_schema?: Json | null
          status?: Database["public"]["Enums"]["agent_registry_status"]
          success_rate?: number | null
          total_invocations?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_registry_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_runs: {
        Row: {
          agent_id: string
          completed_at: string | null
          current_step: string | null
          error_message: string | null
          id: string
          live_metrics: Json | null
          progress_percentage: number | null
          records_affected: number | null
          records_processed: number | null
          results: Json | null
          started_at: string
          status: string
          step_details: Json | null
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          current_step?: string | null
          error_message?: string | null
          id?: string
          live_metrics?: Json | null
          progress_percentage?: number | null
          records_affected?: number | null
          records_processed?: number | null
          results?: Json | null
          started_at?: string
          status: string
          step_details?: Json | null
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          current_step?: string | null
          error_message?: string | null
          id?: string
          live_metrics?: Json | null
          progress_percentage?: number | null
          records_affected?: number | null
          records_processed?: number | null
          results?: Json | null
          started_at?: string
          status?: string
          step_details?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          agent_type: string
          created_at: string | null
          created_by: string | null
          description: string | null
          enabled: boolean | null
          id: string
          is_default: boolean | null
          last_run_at: string | null
          name: string
          next_run_at: string | null
          org_id: string
          parameters: Json | null
          schedule: string
          status: string
          updated_at: string | null
        }
        Insert: {
          agent_type: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          is_default?: boolean | null
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          org_id: string
          parameters?: Json | null
          schedule?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          agent_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          is_default?: boolean | null
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          org_id?: string
          parameters?: Json | null
          schedule?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_decision_feedback: {
        Row: {
          agent_name: string
          ai_recommendation: Json
          confidence: number
          created_at: string
          decision_type: string
          entity_id: string
          entity_type: string
          id: string
          modified_recommendation: Json | null
          org_id: string
          outcome_notes: string | null
          outcome_success: boolean | null
          outcome_tracked: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          user_decision: Database["public"]["Enums"]["feedback_decision"] | null
          user_feedback: string | null
        }
        Insert: {
          agent_name: string
          ai_recommendation: Json
          confidence: number
          created_at?: string
          decision_type: string
          entity_id: string
          entity_type: string
          id?: string
          modified_recommendation?: Json | null
          org_id: string
          outcome_notes?: string | null
          outcome_success?: boolean | null
          outcome_tracked?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          user_decision?:
            | Database["public"]["Enums"]["feedback_decision"]
            | null
          user_feedback?: string | null
        }
        Update: {
          agent_name?: string
          ai_recommendation?: Json
          confidence?: number
          created_at?: string
          decision_type?: string
          entity_id?: string
          entity_type?: string
          id?: string
          modified_recommendation?: Json | null
          org_id?: string
          outcome_notes?: string | null
          outcome_success?: boolean | null
          outcome_tracked?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          user_decision?:
            | Database["public"]["Enums"]["feedback_decision"]
            | null
          user_feedback?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_decision_feedback_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_memory: {
        Row: {
          confidence: number | null
          created_at: string
          expires_at: string | null
          id: string
          learned_from: string[] | null
          memory_key: string
          memory_type: string
          memory_value: Json
          org_id: string
          preference_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          learned_from?: string[] | null
          memory_key: string
          memory_type: string
          memory_value?: Json
          org_id: string
          preference_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          learned_from?: string[] | null
          memory_key?: string
          memory_type?: string
          memory_value?: Json
          org_id?: string
          preference_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_memory_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_planning_rules: {
        Row: {
          action_workflow: string
          auto_execute: boolean | null
          confidence_threshold: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          org_id: string
          parameters_template: Json | null
          requires_approval: boolean | null
          rule_name: string
          success_count: number | null
          trigger_condition: Json
          trigger_count: number | null
          updated_at: string
        }
        Insert: {
          action_workflow: string
          auto_execute?: boolean | null
          confidence_threshold?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          org_id: string
          parameters_template?: Json | null
          requires_approval?: boolean | null
          rule_name: string
          success_count?: number | null
          trigger_condition: Json
          trigger_count?: number | null
          updated_at?: string
        }
        Update: {
          action_workflow?: string
          auto_execute?: boolean | null
          confidence_threshold?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          org_id?: string
          parameters_template?: Json | null
          requires_approval?: boolean | null
          rule_name?: string
          success_count?: number | null
          trigger_condition?: Json
          trigger_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_planning_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_provider_health: {
        Row: {
          avg_latency_ms: number | null
          checked_at: string
          failure_count: number | null
          id: string
          last_failure_at: string | null
          last_success_at: string | null
          provider: string
          requests_24h: number | null
          status: string
          timeout_count: number | null
          total_cost: number | null
        }
        Insert: {
          avg_latency_ms?: number | null
          checked_at?: string
          failure_count?: number | null
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          provider: string
          requests_24h?: number | null
          status?: string
          timeout_count?: number | null
          total_cost?: number | null
        }
        Update: {
          avg_latency_ms?: number | null
          checked_at?: string
          failure_count?: number | null
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          provider?: string
          requests_24h?: number | null
          status?: string
          timeout_count?: number | null
          total_cost?: number | null
        }
        Relationships: []
      }
      ai_task_queue: {
        Row: {
          assigned_agent: string | null
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          expires_at: string | null
          id: string
          max_retries: number | null
          org_id: string
          parent_task_id: string | null
          payload: Json
          priority: Database["public"]["Enums"]["task_priority"]
          requesting_agent: string
          required_capabilities: Json
          result: Json | null
          retry_count: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["task_queue_status"]
          timeout_seconds: number | null
        }
        Insert: {
          assigned_agent?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          id?: string
          max_retries?: number | null
          org_id: string
          parent_task_id?: string | null
          payload?: Json
          priority?: Database["public"]["Enums"]["task_priority"]
          requesting_agent: string
          required_capabilities?: Json
          result?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_queue_status"]
          timeout_seconds?: number | null
        }
        Update: {
          assigned_agent?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          id?: string
          max_retries?: number | null
          org_id?: string
          parent_task_id?: string | null
          payload?: Json
          priority?: Database["public"]["Enums"]["task_priority"]
          requesting_agent?: string
          required_capabilities?: Json
          result?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_queue_status"]
          timeout_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_task_queue_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_task_queue_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "ai_task_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_tracking: {
        Row: {
          cost_estimate: number | null
          created_at: string
          error_message: string | null
          id: string
          latency_ms: number | null
          model: string
          org_id: string
          provider: string
          success: boolean | null
          task_type: string | null
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          cost_estimate?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          model: string
          org_id: string
          provider: string
          success?: boolean | null
          task_type?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          cost_estimate?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          model?: string
          org_id?: string
          provider?: string
          success?: boolean | null
          task_type?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_tracking_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_workflows: {
        Row: {
          completed_at: string | null
          context: Json
          created_at: string
          current_step: number
          error_message: string | null
          id: string
          org_id: string
          started_at: string | null
          status: string
          step_outputs: Json
          steps: Json
          total_steps: number
          updated_at: string
          user_id: string
          workflow_name: string
          workflow_type: string
        }
        Insert: {
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_step?: number
          error_message?: string | null
          id?: string
          org_id: string
          started_at?: string | null
          status?: string
          step_outputs?: Json
          steps?: Json
          total_steps?: number
          updated_at?: string
          user_id: string
          workflow_name: string
          workflow_type: string
        }
        Update: {
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_step?: number
          error_message?: string | null
          id?: string
          org_id?: string
          started_at?: string | null
          status?: string
          step_outputs?: Json
          steps?: Json
          total_steps?: number
          updated_at?: string
          user_id?: string
          workflow_name?: string
          workflow_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_workflows_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_history: {
        Row: {
          alert_id: string
          context_data: Json | null
          id: string
          notification_channels: string[] | null
          notification_error: string | null
          notification_sent: boolean
          org_id: string
          threshold_value: number | null
          trigger_value: number | null
          triggered_at: string
        }
        Insert: {
          alert_id: string
          context_data?: Json | null
          id?: string
          notification_channels?: string[] | null
          notification_error?: string | null
          notification_sent?: boolean
          org_id: string
          threshold_value?: number | null
          trigger_value?: number | null
          triggered_at?: string
        }
        Update: {
          alert_id?: string
          context_data?: Json | null
          id?: string
          notification_channels?: string[] | null
          notification_error?: string | null
          notification_sent?: boolean
          org_id?: string
          threshold_value?: number | null
          trigger_value?: number | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_history_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          alert_type: string
          comparison_period: string | null
          created_at: string
          created_by: string | null
          email_recipients: string[] | null
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          notification_channels: Json
          org_id: string
          slack_webhook_url: string | null
          teams_webhook_url: string | null
          threshold_operator: string | null
          threshold_value: number | null
          trigger_count: number
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          alert_type: string
          comparison_period?: string | null
          created_at?: string
          created_by?: string | null
          email_recipients?: string[] | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          notification_channels?: Json
          org_id: string
          slack_webhook_url?: string | null
          teams_webhook_url?: string | null
          threshold_operator?: string | null
          threshold_value?: number | null
          trigger_count?: number
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          alert_type?: string
          comparison_period?: string | null
          created_at?: string
          created_by?: string | null
          email_recipients?: string[] | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          notification_channels?: Json
          org_id?: string
          slack_webhook_url?: string | null
          teams_webhook_url?: string | null
          threshold_operator?: string | null
          threshold_value?: number | null
          trigger_count?: number
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      anomaly_rules: {
        Row: {
          comparison: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          lookback_days: number | null
          metric_name: string
          name: string
          org_id: string
          severity: string | null
          threshold: number
          updated_at: string | null
        }
        Insert: {
          comparison: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          lookback_days?: number | null
          metric_name: string
          name: string
          org_id: string
          severity?: string | null
          threshold: number
          updated_at?: string | null
        }
        Update: {
          comparison?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          lookback_days?: number | null
          metric_name?: string
          name?: string
          org_id?: string
          severity?: string | null
          threshold?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          org_id: string
          scopes: string[] | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          org_id: string
          scopes?: string[] | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          org_id?: string
          scopes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      apollo_redemption_log: {
        Row: {
          account_filters: Json | null
          campaign_name: string | null
          contacts_redeemed: number
          contacts_skipped_duplicate: number
          credits_used: number
          id: string
          org_id: string
          persona_filters: Json | null
          redeemed_at: string
          redeemed_emails: string[] | null
          source_accounts: string[] | null
        }
        Insert: {
          account_filters?: Json | null
          campaign_name?: string | null
          contacts_redeemed?: number
          contacts_skipped_duplicate?: number
          credits_used?: number
          id?: string
          org_id: string
          persona_filters?: Json | null
          redeemed_at?: string
          redeemed_emails?: string[] | null
          source_accounts?: string[] | null
        }
        Update: {
          account_filters?: Json | null
          campaign_name?: string | null
          contacts_redeemed?: number
          contacts_skipped_duplicate?: number
          credits_used?: number
          id?: string
          org_id?: string
          persona_filters?: Json | null
          redeemed_at?: string
          redeemed_emails?: string[] | null
          source_accounts?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "apollo_redemption_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string | null
          actor: string | null
          created_at: string | null
          id: string
          meta: Json | null
          org_id: string
        }
        Insert: {
          action?: string | null
          actor?: string | null
          created_at?: string | null
          id?: string
          meta?: Json | null
          org_id: string
        }
        Update: {
          action?: string | null
          actor?: string | null
          created_at?: string | null
          id?: string
          meta?: Json | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_score_failures: {
        Row: {
          account_external_id: string
          account_name: string | null
          created_at: string | null
          error_details: Json | null
          error_message: string | null
          id: string
          last_retry_at: string | null
          org_id: string
          retry_count: number | null
          trigger_type: string | null
        }
        Insert: {
          account_external_id: string
          account_name?: string | null
          created_at?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          org_id: string
          retry_count?: number | null
          trigger_type?: string | null
        }
        Update: {
          account_external_id?: string
          account_name?: string | null
          created_at?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          org_id?: string
          retry_count?: number | null
          trigger_type?: string | null
        }
        Relationships: []
      }
      automation_settings: {
        Row: {
          created_at: string | null
          enabled: boolean
          id: string
          last_run_at: string | null
          org_id: string
          schedule_frequency: string | null
          setting_key: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          org_id: string
          schedule_frequency?: string | null
          setting_key: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          org_id?: string
          schedule_frequency?: string | null
          setting_key?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_scoring_jobs: {
        Row: {
          chunk_size: number
          completed_at: string | null
          created_at: string
          current_chunk: number
          error_details: Json | null
          error_message: string | null
          failed_scores: number
          icp_id: string | null
          id: string
          last_processed_at: string | null
          org_id: string
          processed_accounts: number
          started_at: string | null
          status: string
          successful_scores: number
          total_accounts: number
          total_chunks: number
          updated_at: string
        }
        Insert: {
          chunk_size?: number
          completed_at?: string | null
          created_at?: string
          current_chunk?: number
          error_details?: Json | null
          error_message?: string | null
          failed_scores?: number
          icp_id?: string | null
          id?: string
          last_processed_at?: string | null
          org_id: string
          processed_accounts?: number
          started_at?: string | null
          status?: string
          successful_scores?: number
          total_accounts?: number
          total_chunks?: number
          updated_at?: string
        }
        Update: {
          chunk_size?: number
          completed_at?: string | null
          created_at?: string
          current_chunk?: number
          error_details?: Json | null
          error_message?: string | null
          failed_scores?: number
          icp_id?: string | null
          id?: string
          last_processed_at?: string | null
          org_id?: string
          processed_accounts?: number
          started_at?: string | null
          status?: string
          successful_scores?: number
          total_accounts?: number
          total_chunks?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_scoring_jobs_icp_id_fkey"
            columns: ["icp_id"]
            isOneToOne: false
            referencedRelation: "icp_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_scoring_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_insights: {
        Row: {
          action_items: Json | null
          ai_model: string | null
          budget_discussed: boolean | null
          buying_signals: Json | null
          call_id: string
          competitor_mentions: Json | null
          confidence: number | null
          created_at: string
          decision_makers_identified: Json | null
          id: string
          key_topics: Json | null
          next_steps: string | null
          objections: Json | null
          org_id: string
          risk_indicators: Json | null
          sentiment: string | null
          sentiment_score: number | null
          summary: string | null
          timeline_discussed: boolean | null
        }
        Insert: {
          action_items?: Json | null
          ai_model?: string | null
          budget_discussed?: boolean | null
          buying_signals?: Json | null
          call_id: string
          competitor_mentions?: Json | null
          confidence?: number | null
          created_at?: string
          decision_makers_identified?: Json | null
          id?: string
          key_topics?: Json | null
          next_steps?: string | null
          objections?: Json | null
          org_id: string
          risk_indicators?: Json | null
          sentiment?: string | null
          sentiment_score?: number | null
          summary?: string | null
          timeline_discussed?: boolean | null
        }
        Update: {
          action_items?: Json | null
          ai_model?: string | null
          budget_discussed?: boolean | null
          buying_signals?: Json | null
          call_id?: string
          competitor_mentions?: Json | null
          confidence?: number | null
          created_at?: string
          decision_makers_identified?: Json | null
          id?: string
          key_topics?: Json | null
          next_steps?: string | null
          objections?: Json | null
          org_id?: string
          risk_indicators?: Json | null
          sentiment?: string | null
          sentiment_score?: number | null
          summary?: string | null
          timeline_discussed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "call_insights_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_insights_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_recordings: {
        Row: {
          account_external_id: string | null
          call_type: string | null
          created_at: string
          deal_id: string | null
          duration_seconds: number | null
          error_message: string | null
          external_id: string | null
          id: string
          lead_id: number | null
          metadata: Json | null
          org_id: string
          participants: Json | null
          processed_at: string | null
          processing_status: string | null
          recorded_at: string | null
          recording_url: string | null
          source: string | null
          transcript: string | null
          updated_at: string
        }
        Insert: {
          account_external_id?: string | null
          call_type?: string | null
          created_at?: string
          deal_id?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          lead_id?: number | null
          metadata?: Json | null
          org_id: string
          participants?: Json | null
          processed_at?: string | null
          processing_status?: string | null
          recorded_at?: string | null
          recording_url?: string | null
          source?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          account_external_id?: string | null
          call_type?: string | null
          created_at?: string
          deal_id?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          lead_id?: number | null
          metadata?: Json | null
          org_id?: string
          participants?: Json | null
          processed_at?: string | null
          processing_status?: string | null
          recorded_at?: string | null
          recording_url?: string | null
          source?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_recordings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_recordings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "Leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_recordings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_recordings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_naming_registry: {
        Row: {
          campaign_name: string
          created_at: string | null
          icp_segment: string
          id: string
          org_id: string
          region: string
          signal_type: string
          week_year: string
        }
        Insert: {
          campaign_name: string
          created_at?: string | null
          icp_segment: string
          id?: string
          org_id: string
          region: string
          signal_type: string
          week_year: string
        }
        Update: {
          campaign_name?: string
          created_at?: string | null
          icp_segment?: string
          id?: string
          org_id?: string
          region?: string
          signal_type?: string
          week_year?: string
        }
        Relationships: []
      }
      campaign_snapshots: {
        Row: {
          campaign_ready_contacts: number
          created_at: string | null
          created_by: string | null
          deduplication_strategy: string | null
          export_filename: string | null
          export_type: string
          exported_at: string
          exported_emails: Json | null
          firmographic_filters: Json | null
          icp_id: string | null
          icp_name: string
          icp_version: number | null
          id: string
          max_contacts_per_account: number | null
          org_id: string
          persona_filters_applied: Json | null
          source_filter: string | null
          sync_destination: string | null
          sync_error: string | null
          sync_status: string | null
          total_accounts: number
          total_contacts: number
        }
        Insert: {
          campaign_ready_contacts?: number
          created_at?: string | null
          created_by?: string | null
          deduplication_strategy?: string | null
          export_filename?: string | null
          export_type: string
          exported_at?: string
          exported_emails?: Json | null
          firmographic_filters?: Json | null
          icp_id?: string | null
          icp_name: string
          icp_version?: number | null
          id?: string
          max_contacts_per_account?: number | null
          org_id: string
          persona_filters_applied?: Json | null
          source_filter?: string | null
          sync_destination?: string | null
          sync_error?: string | null
          sync_status?: string | null
          total_accounts?: number
          total_contacts?: number
        }
        Update: {
          campaign_ready_contacts?: number
          created_at?: string | null
          created_by?: string | null
          deduplication_strategy?: string | null
          export_filename?: string | null
          export_type?: string
          exported_at?: string
          exported_emails?: Json | null
          firmographic_filters?: Json | null
          icp_id?: string | null
          icp_name?: string
          icp_version?: number | null
          id?: string
          max_contacts_per_account?: number | null
          org_id?: string
          persona_filters_applied?: Json | null
          source_filter?: string | null
          sync_destination?: string | null
          sync_error?: string | null
          sync_status?: string | null
          total_accounts?: number
          total_contacts?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_snapshots_icp_id_fkey"
            columns: ["icp_id"]
            isOneToOne: false
            referencedRelation: "icp_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_templates: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          name: string
          org_id: string
          persona_criteria: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          name: string
          org_id: string
          persona_criteria?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          persona_criteria?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          account_ids: string[] | null
          campaign_type: string
          contact_ids: number[] | null
          created_at: string
          created_by: string | null
          fuel_line_type: string | null
          id: string
          metadata: Json | null
          name: string
          org_id: string
          signal_source_ids: string[] | null
          status: string
          total_accounts: number | null
          total_contacts: number | null
          updated_at: string
        }
        Insert: {
          account_ids?: string[] | null
          campaign_type?: string
          contact_ids?: number[] | null
          created_at?: string
          created_by?: string | null
          fuel_line_type?: string | null
          id?: string
          metadata?: Json | null
          name: string
          org_id: string
          signal_source_ids?: string[] | null
          status?: string
          total_accounts?: number | null
          total_contacts?: number | null
          updated_at?: string
        }
        Update: {
          account_ids?: string[] | null
          campaign_type?: string
          contact_ids?: number[] | null
          created_at?: string
          created_by?: string | null
          fuel_line_type?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          org_id?: string
          signal_source_ids?: string[] | null
          status?: string
          total_accounts?: number | null
          total_contacts?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      capital_tracking: {
        Row: {
          cac: number | null
          created_at: string | null
          id: string
          marketing_investment: number
          org_id: string
          period_end: string
          period_start: string
          pipeline_multiplier: number | null
          pipeline_value: number
          revenue_generated: number
          roas: number | null
          sales_investment: number
          total_investment: number | null
          updated_at: string | null
        }
        Insert: {
          cac?: number | null
          created_at?: string | null
          id?: string
          marketing_investment?: number
          org_id: string
          period_end: string
          period_start: string
          pipeline_multiplier?: number | null
          pipeline_value?: number
          revenue_generated?: number
          roas?: number | null
          sales_investment?: number
          total_investment?: number | null
          updated_at?: string | null
        }
        Update: {
          cac?: number | null
          created_at?: string | null
          id?: string
          marketing_investment?: number
          org_id?: string
          period_end?: string
          period_start?: string
          pipeline_multiplier?: number | null
          pipeline_value?: number
          revenue_generated?: number
          roas?: number | null
          sales_investment?: number
          total_investment?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capital_tracking_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_cache: {
        Row: {
          carrier_name: string | null
          country_code: string | null
          country_name: string | null
          created_at: string
          expires_at: string
          line_type: string | null
          org_id: string | null
          phone_normalized: string
          raw_response: Json | null
          valid: boolean
          verified_at: string
        }
        Insert: {
          carrier_name?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          expires_at?: string
          line_type?: string | null
          org_id?: string | null
          phone_normalized: string
          raw_response?: Json | null
          valid?: boolean
          verified_at?: string
        }
        Update: {
          carrier_name?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          expires_at?: string
          line_type?: string | null
          org_id?: string | null
          phone_normalized?: string
          raw_response?: Json | null
          valid?: boolean
          verified_at?: string
        }
        Relationships: []
      }
      child_dashboard_metrics_cache: {
        Row: {
          metrics: Json
          org_id: string
          refreshed_at: string
        }
        Insert: {
          metrics?: Json
          org_id: string
          refreshed_at?: string
        }
        Update: {
          metrics?: Json
          org_id?: string
          refreshed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_dashboard_metrics_cache_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clay_webhook_config: {
        Row: {
          created_at: string
          field_mappings: Json
          id: string
          is_enabled: boolean
          org_id: string
          updated_at: string
          webhook_type: string
        }
        Insert: {
          created_at?: string
          field_mappings?: Json
          id?: string
          is_enabled?: boolean
          org_id: string
          updated_at?: string
          webhook_type: string
        }
        Update: {
          created_at?: string
          field_mappings?: Json
          id?: string
          is_enabled?: boolean
          org_id?: string
          updated_at?: string
          webhook_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "clay_webhook_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clay_webhook_logs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          org_id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          processing_started_at: string | null
          webhook_type: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          org_id: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          processing_started_at?: string | null
          webhook_type: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          org_id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          processing_started_at?: string | null
          webhook_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "clay_webhook_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      closed_won_deals: {
        Row: {
          account_external_id: string
          close_date: string
          created_at: string
          deal_value: number
          id: string
          org_id: string
          sales_cycle_days: number | null
        }
        Insert: {
          account_external_id: string
          close_date: string
          created_at?: string
          deal_value: number
          id?: string
          org_id: string
          sales_cycle_days?: number | null
        }
        Update: {
          account_external_id?: string
          close_date?: string
          created_at?: string
          deal_value?: number
          id?: string
          org_id?: string
          sales_cycle_days?: number | null
        }
        Relationships: []
      }
      coaching_recommendations: {
        Row: {
          best_practice_source: string | null
          category: string | null
          completed_at: string | null
          created_at: string | null
          evidence: Json | null
          example_call_id: string | null
          id: string
          org_id: string
          priority: number | null
          recommendation: string
          status: string | null
          topic: string
          user_id: string
        }
        Insert: {
          best_practice_source?: string | null
          category?: string | null
          completed_at?: string | null
          created_at?: string | null
          evidence?: Json | null
          example_call_id?: string | null
          id?: string
          org_id: string
          priority?: number | null
          recommendation: string
          status?: string | null
          topic: string
          user_id: string
        }
        Update: {
          best_practice_source?: string | null
          category?: string | null
          completed_at?: string | null
          created_at?: string | null
          evidence?: Json | null
          example_call_id?: string | null
          id?: string
          org_id?: string
          priority?: number | null
          recommendation?: string
          status?: string | null
          topic?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_recommendations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_registry: {
        Row: {
          consent_given: boolean | null
          consent_source: string | null
          consent_timestamp: string | null
          contact_id: number | null
          created_at: string | null
          email: string
          id: string
          legal_basis: string | null
          opt_out_timestamp: string | null
          org_id: string
        }
        Insert: {
          consent_given?: boolean | null
          consent_source?: string | null
          consent_timestamp?: string | null
          contact_id?: number | null
          created_at?: string | null
          email: string
          id?: string
          legal_basis?: string | null
          opt_out_timestamp?: string | null
          org_id: string
        }
        Update: {
          consent_given?: boolean | null
          consent_source?: string | null
          consent_timestamp?: string | null
          contact_id?: number | null
          created_at?: string | null
          email?: string
          id?: string
          legal_basis?: string | null
          opt_out_timestamp?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_registry_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "Leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_registry_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "leads_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_adjustments: {
        Row: {
          adjustment_type: string
          created_at: string | null
          credits_added: number | null
          id: string
          new_bonus: number | null
          new_total: number | null
          new_used: number | null
          org_id: string
          performed_by: string
          previous_bonus: number | null
          previous_total: number | null
          previous_used: number | null
          reason: string | null
        }
        Insert: {
          adjustment_type: string
          created_at?: string | null
          credits_added?: number | null
          id?: string
          new_bonus?: number | null
          new_total?: number | null
          new_used?: number | null
          org_id: string
          performed_by: string
          previous_bonus?: number | null
          previous_total?: number | null
          previous_used?: number | null
          reason?: string | null
        }
        Update: {
          adjustment_type?: string
          created_at?: string | null
          credits_added?: number | null
          id?: string
          new_bonus?: number | null
          new_total?: number | null
          new_used?: number | null
          org_id?: string
          performed_by?: string
          previous_bonus?: number | null
          previous_total?: number | null
          previous_used?: number | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_adjustments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_attribute_definitions: {
        Row: {
          category: string | null
          created_at: string
          enrichment_prompt: string | null
          field_key: string
          field_label: string
          field_type: string
          id: string
          options: string[] | null
          org_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          enrichment_prompt?: string | null
          field_key: string
          field_label: string
          field_type: string
          id?: string
          options?: string[] | null
          org_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          enrichment_prompt?: string | null
          field_key?: string
          field_label?: string
          field_type?: string
          id?: string
          options?: string[] | null
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_attribute_definitions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_reports: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          org_id: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          org_id: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      data_quality_history: {
        Row: {
          accounts_with_contacts: number
          accounts_with_geography: number
          accounts_with_industry: number
          accounts_with_revenue: number
          accounts_with_size: number
          created_at: string | null
          high_fit_accounts: number
          high_fit_accounts_delta: number | null
          id: string
          low_fit_accounts: number | null
          low_fit_accounts_delta: number | null
          medium_fit_accounts: number | null
          medium_fit_accounts_delta: number | null
          org_id: string
          overall_completeness: number
          sam_accounts: number | null
          scored_accounts: number
          tam_accounts: number | null
          total_accounts: number
        }
        Insert: {
          accounts_with_contacts: number
          accounts_with_geography: number
          accounts_with_industry: number
          accounts_with_revenue: number
          accounts_with_size: number
          created_at?: string | null
          high_fit_accounts: number
          high_fit_accounts_delta?: number | null
          id?: string
          low_fit_accounts?: number | null
          low_fit_accounts_delta?: number | null
          medium_fit_accounts?: number | null
          medium_fit_accounts_delta?: number | null
          org_id: string
          overall_completeness: number
          sam_accounts?: number | null
          scored_accounts: number
          tam_accounts?: number | null
          total_accounts: number
        }
        Update: {
          accounts_with_contacts?: number
          accounts_with_geography?: number
          accounts_with_industry?: number
          accounts_with_revenue?: number
          accounts_with_size?: number
          created_at?: string | null
          high_fit_accounts?: number
          high_fit_accounts_delta?: number | null
          id?: string
          low_fit_accounts?: number | null
          low_fit_accounts_delta?: number | null
          medium_fit_accounts?: number | null
          medium_fit_accounts_delta?: number | null
          org_id?: string
          overall_completeness?: number
          sam_accounts?: number | null
          scored_accounts?: number
          tam_accounts?: number | null
          total_accounts?: number
        }
        Relationships: [
          {
            foreignKeyName: "data_quality_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stage_history: {
        Row: {
          created_at: string
          deal_id: string
          entered_at: string
          exited_at: string | null
          id: string
          org_id: string
          stage: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          entered_at?: string
          exited_at?: string | null
          id?: string
          org_id: string
          stage: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          entered_at?: string
          exited_at?: string | null
          id?: string
          org_id?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          account_external_id: string | null
          amount: number | null
          attribution_click_ids: Json | null
          attribution_funnel_variant: string | null
          attribution_utm: Json | null
          closed_date: string | null
          created_at: string
          deal_type: string | null
          expected_close_date: string | null
          external_id: string | null
          id: string
          loss_category: string | null
          loss_reason: string | null
          marketing_lead_id: string | null
          metadata: Json | null
          name: string
          org_id: string
          owner_id: string | null
          owner_name: string | null
          probability: number | null
          source: string | null
          stage: string
          status: string
          updated_at: string
          win_reason: string | null
        }
        Insert: {
          account_external_id?: string | null
          amount?: number | null
          attribution_click_ids?: Json | null
          attribution_funnel_variant?: string | null
          attribution_utm?: Json | null
          closed_date?: string | null
          created_at?: string
          deal_type?: string | null
          expected_close_date?: string | null
          external_id?: string | null
          id?: string
          loss_category?: string | null
          loss_reason?: string | null
          marketing_lead_id?: string | null
          metadata?: Json | null
          name: string
          org_id: string
          owner_id?: string | null
          owner_name?: string | null
          probability?: number | null
          source?: string | null
          stage: string
          status?: string
          updated_at?: string
          win_reason?: string | null
        }
        Update: {
          account_external_id?: string | null
          amount?: number | null
          attribution_click_ids?: Json | null
          attribution_funnel_variant?: string | null
          attribution_utm?: Json | null
          closed_date?: string | null
          created_at?: string
          deal_type?: string | null
          expected_close_date?: string | null
          external_id?: string | null
          id?: string
          loss_category?: string | null
          loss_reason?: string | null
          marketing_lead_id?: string | null
          metadata?: Json | null
          name?: string
          org_id?: string
          owner_id?: string | null
          owner_name?: string | null
          probability?: number | null
          source?: string | null
          stage?: string
          status?: string
          updated_at?: string
          win_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_marketing_lead_id_fkey"
            columns: ["marketing_lead_id"]
            isOneToOne: false
            referencedRelation: "marketing_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deep_research_candidates: {
        Row: {
          account_external_id: string | null
          citations: Json | null
          company_data: Json | null
          confidence: number | null
          created_at: string | null
          dismissed: boolean | null
          dismissed_reason: string | null
          id: string
          lead_id: number | null
          match_reasoning: string | null
          org_id: string
          person_data: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          selected: boolean | null
        }
        Insert: {
          account_external_id?: string | null
          citations?: Json | null
          company_data?: Json | null
          confidence?: number | null
          created_at?: string | null
          dismissed?: boolean | null
          dismissed_reason?: string | null
          id?: string
          lead_id?: number | null
          match_reasoning?: string | null
          org_id: string
          person_data?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selected?: boolean | null
        }
        Update: {
          account_external_id?: string | null
          citations?: Json | null
          company_data?: Json | null
          confidence?: number | null
          created_at?: string | null
          dismissed?: boolean | null
          dismissed_reason?: string | null
          id?: string
          lead_id?: number | null
          match_reasoning?: string | null
          org_id?: string
          person_data?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selected?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "deep_research_candidates_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "Leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deep_research_candidates_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deep_research_candidates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      detected_anomalies: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          ai_recommendation: string | null
          created_at: string | null
          deviation_percent: number | null
          expected_value: number | null
          explanation: string | null
          id: string
          metric_name: string
          metric_value: number
          org_id: string
          rule_id: string | null
          severity: string | null
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          ai_recommendation?: string | null
          created_at?: string | null
          deviation_percent?: number | null
          expected_value?: number | null
          explanation?: string | null
          id?: string
          metric_name: string
          metric_value: number
          org_id: string
          rule_id?: string | null
          severity?: string | null
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          ai_recommendation?: string | null
          created_at?: string | null
          deviation_percent?: number | null
          expected_value?: number | null
          explanation?: string | null
          id?: string
          metric_name?: string
          metric_value?: number
          org_id?: string
          rule_id?: string | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "detected_anomalies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detected_anomalies_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "anomaly_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      dismissed_recommendations: {
        Row: {
          dismissed_at: string
          id: string
          org_id: string
          reason: string | null
          recommendation_id: string
          recommendation_type: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          id?: string
          org_id: string
          reason?: string | null
          recommendation_id: string
          recommendation_type: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          id?: string
          org_id?: string
          reason?: string | null
          recommendation_id?: string
          recommendation_type?: string
          user_id?: string
        }
        Relationships: []
      }
      document_embeddings: {
        Row: {
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          org_id: string
          source_id: string | null
          source_type: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          org_id: string
          source_id?: string | null
          source_type: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string
          source_id?: string | null
          source_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_embeddings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_aliases: {
        Row: {
          alias_domain: string
          canonical_domain: string
          confidence: number | null
          created_at: string | null
          id: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          alias_domain: string
          canonical_domain: string
          confidence?: number | null
          created_at?: string | null
          id?: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          alias_domain?: string
          canonical_domain?: string
          confidence?: number | null
          created_at?: string | null
          id?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_aliases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dsar_requests: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          notes: string | null
          org_id: string
          request_details: Json | null
          request_type: string
          requested_at: string
          result_data: Json | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          org_id: string
          request_details?: Json | null
          request_type: string
          requested_at?: string
          result_data?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string
          request_details?: Json | null
          request_type?: string
          requested_at?: string
          result_data?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dsar_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_drafts: {
        Row: {
          account_external_id: string | null
          ai_model: string | null
          approved_at: string | null
          approved_by: string | null
          body: string
          context_used: Json | null
          created_at: string | null
          deal_id: string | null
          draft_type: string | null
          id: string
          lead_id: number | null
          org_id: string
          sent_at: string | null
          status: string | null
          subject: string
        }
        Insert: {
          account_external_id?: string | null
          ai_model?: string | null
          approved_at?: string | null
          approved_by?: string | null
          body: string
          context_used?: Json | null
          created_at?: string | null
          deal_id?: string | null
          draft_type?: string | null
          id?: string
          lead_id?: number | null
          org_id: string
          sent_at?: string | null
          status?: string | null
          subject: string
        }
        Update: {
          account_external_id?: string | null
          ai_model?: string | null
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          context_used?: Json | null
          created_at?: string | null
          deal_id?: string | null
          draft_type?: string | null
          id?: string
          lead_id?: number | null
          org_id?: string
          sent_at?: string | null
          status?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_drafts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_threads: {
        Row: {
          account_external_id: string | null
          action_required: boolean | null
          action_required_by: string | null
          created_at: string
          deal_id: string | null
          external_id: string | null
          first_message_at: string | null
          id: string
          intent: string | null
          key_points: Json | null
          labels: Json | null
          last_message_at: string | null
          last_sender: string | null
          lead_id: number | null
          message_count: number | null
          metadata: Json | null
          org_id: string
          participants: Json | null
          processed_at: string | null
          processing_status: string | null
          response_time_avg_hours: number | null
          sentiment: string | null
          source: string | null
          subject: string | null
          summary: string | null
          thread_id: string | null
          updated_at: string
          urgency: string | null
        }
        Insert: {
          account_external_id?: string | null
          action_required?: boolean | null
          action_required_by?: string | null
          created_at?: string
          deal_id?: string | null
          external_id?: string | null
          first_message_at?: string | null
          id?: string
          intent?: string | null
          key_points?: Json | null
          labels?: Json | null
          last_message_at?: string | null
          last_sender?: string | null
          lead_id?: number | null
          message_count?: number | null
          metadata?: Json | null
          org_id: string
          participants?: Json | null
          processed_at?: string | null
          processing_status?: string | null
          response_time_avg_hours?: number | null
          sentiment?: string | null
          source?: string | null
          subject?: string | null
          summary?: string | null
          thread_id?: string | null
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          account_external_id?: string | null
          action_required?: boolean | null
          action_required_by?: string | null
          created_at?: string
          deal_id?: string | null
          external_id?: string | null
          first_message_at?: string | null
          id?: string
          intent?: string | null
          key_points?: Json | null
          labels?: Json | null
          last_message_at?: string | null
          last_sender?: string | null
          lead_id?: number | null
          message_count?: number | null
          metadata?: Json | null
          org_id?: string
          participants?: Json | null
          processed_at?: string | null
          processing_status?: string | null
          response_time_avg_hours?: number | null
          sentiment?: string | null
          source?: string | null
          subject?: string | null
          summary?: string | null
          thread_id?: string | null
          updated_at?: string
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_threads_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "Leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_accuracy_results: {
        Row: {
          cost_usd: number | null
          created_at: string | null
          employee_count_match: boolean | null
          employee_count_variance: number | null
          enriched_employee_count: number | null
          enriched_industry: string | null
          enriched_naics: string | null
          enriched_phone: string | null
          enriched_revenue_range: string | null
          enrichment_duration_ms: number | null
          id: string
          industry_match: boolean | null
          linkedin_match: boolean | null
          mobile_match: boolean | null
          naics_match: boolean | null
          org_id: string | null
          phone_match: boolean | null
          revenue_match: boolean | null
          source: string
          test_data_id: string | null
          test_run_id: string | null
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string | null
          employee_count_match?: boolean | null
          employee_count_variance?: number | null
          enriched_employee_count?: number | null
          enriched_industry?: string | null
          enriched_naics?: string | null
          enriched_phone?: string | null
          enriched_revenue_range?: string | null
          enrichment_duration_ms?: number | null
          id?: string
          industry_match?: boolean | null
          linkedin_match?: boolean | null
          mobile_match?: boolean | null
          naics_match?: boolean | null
          org_id?: string | null
          phone_match?: boolean | null
          revenue_match?: boolean | null
          source: string
          test_data_id?: string | null
          test_run_id?: string | null
        }
        Update: {
          cost_usd?: number | null
          created_at?: string | null
          employee_count_match?: boolean | null
          employee_count_variance?: number | null
          enriched_employee_count?: number | null
          enriched_industry?: string | null
          enriched_naics?: string | null
          enriched_phone?: string | null
          enriched_revenue_range?: string | null
          enrichment_duration_ms?: number | null
          id?: string
          industry_match?: boolean | null
          linkedin_match?: boolean | null
          mobile_match?: boolean | null
          naics_match?: boolean | null
          org_id?: string | null
          phone_match?: boolean | null
          revenue_match?: boolean | null
          source?: string
          test_data_id?: string | null
          test_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_accuracy_results_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_accuracy_results_test_data_id_fkey"
            columns: ["test_data_id"]
            isOneToOne: false
            referencedRelation: "enrichment_test_data"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_cache: {
        Row: {
          cache_key: string
          cache_type: string
          confidence: number | null
          created_at: string
          enriched_data: Json
          expires_at: string
          hit_count: number | null
          id: string
          last_accessed_at: string | null
          org_id: string | null
          sources: string[] | null
          total_cost: number | null
        }
        Insert: {
          cache_key: string
          cache_type: string
          confidence?: number | null
          created_at?: string
          enriched_data?: Json
          expires_at?: string
          hit_count?: number | null
          id?: string
          last_accessed_at?: string | null
          org_id?: string | null
          sources?: string[] | null
          total_cost?: number | null
        }
        Update: {
          cache_key?: string
          cache_type?: string
          confidence?: number | null
          created_at?: string
          enriched_data?: Json
          expires_at?: string
          hit_count?: number | null
          id?: string
          last_accessed_at?: string | null
          org_id?: string | null
          sources?: string[] | null
          total_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_cache_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_costs: {
        Row: {
          api_credits_used: number | null
          cost_usd: number | null
          created_at: string | null
          error_message: string | null
          fields_enriched: string[] | null
          id: string
          input_tokens: number | null
          org_id: string | null
          output_tokens: number | null
          queue_job_id: string | null
          record_id: string | null
          record_type: string
          source: string
          success: boolean | null
        }
        Insert: {
          api_credits_used?: number | null
          cost_usd?: number | null
          created_at?: string | null
          error_message?: string | null
          fields_enriched?: string[] | null
          id?: string
          input_tokens?: number | null
          org_id?: string | null
          output_tokens?: number | null
          queue_job_id?: string | null
          record_id?: string | null
          record_type: string
          source: string
          success?: boolean | null
        }
        Update: {
          api_credits_used?: number | null
          cost_usd?: number | null
          created_at?: string | null
          error_message?: string | null
          fields_enriched?: string[] | null
          id?: string
          input_tokens?: number | null
          org_id?: string | null
          output_tokens?: number | null
          queue_job_id?: string | null
          record_id?: string | null
          record_type?: string
          source?: string
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_costs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_costs_queue_job_id_fkey"
            columns: ["queue_job_id"]
            isOneToOne: false
            referencedRelation: "enrichment_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_field_coverage: {
        Row: {
          coverage_percentage: number | null
          enriched_accounts: number | null
          field_name: string
          id: string
          org_id: string
          primary_provider: string | null
          total_accounts: number | null
          updated_at: string
        }
        Insert: {
          coverage_percentage?: number | null
          enriched_accounts?: number | null
          field_name: string
          id?: string
          org_id: string
          primary_provider?: string | null
          total_accounts?: number | null
          updated_at?: string
        }
        Update: {
          coverage_percentage?: number | null
          enriched_accounts?: number | null
          field_name?: string
          id?: string
          org_id?: string
          primary_provider?: string | null
          total_accounts?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      enrichment_history: {
        Row: {
          account_external_id: string
          cost_breakdown: Json | null
          cost_usd: number | null
          created_at: string
          credits_used: number | null
          data_after: Json | null
          data_before: Json | null
          enrichment_type: string
          error_code: string | null
          error_message: string | null
          fields_enriched: string[] | null
          id: string
          job_id: string | null
          org_id: string
          provider: string
          response_time_ms: number | null
          status: string
        }
        Insert: {
          account_external_id: string
          cost_breakdown?: Json | null
          cost_usd?: number | null
          created_at?: string
          credits_used?: number | null
          data_after?: Json | null
          data_before?: Json | null
          enrichment_type: string
          error_code?: string | null
          error_message?: string | null
          fields_enriched?: string[] | null
          id?: string
          job_id?: string | null
          org_id: string
          provider: string
          response_time_ms?: number | null
          status: string
        }
        Update: {
          account_external_id?: string
          cost_breakdown?: Json | null
          cost_usd?: number | null
          created_at?: string
          credits_used?: number | null
          data_after?: Json | null
          data_before?: Json | null
          enrichment_type?: string
          error_code?: string | null
          error_message?: string | null
          fields_enriched?: string[] | null
          id?: string
          job_id?: string | null
          org_id?: string
          provider?: string
          response_time_ms?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "enrichment_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_enrichment_history_account"
            columns: ["org_id", "account_external_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["org_id", "external_id"]
          },
        ]
      }
      enrichment_jobs: {
        Row: {
          accounts_enriched: number | null
          agent_config: Json | null
          batch_size: number | null
          can_pause: boolean | null
          completed_at: string | null
          concurrency: number | null
          config_icp_id: string | null
          contacts_discovered: number | null
          created_at: string | null
          created_by: string | null
          credits_remaining: number | null
          credits_used: number | null
          current_batch: number | null
          cursor: string | null
          enable_contact_discovery: boolean | null
          enriched_records: number | null
          error_message: string | null
          estimated_completion_at: string | null
          failed_records: number | null
          fields_enriched: number | null
          filter_criteria: Json | null
          heartbeat_interval_ms: number | null
          icp_criteria: Json | null
          id: string
          input_data: Json | null
          job_type: string
          last_heartbeat: string | null
          last_progress_update: string | null
          org_id: string
          paused_at: string | null
          processed_records: number | null
          progress_percentage: number | null
          provider: string
          recovery_count: number | null
          rows_completed: number | null
          rows_failed: number | null
          rows_pending: number | null
          source_breakdown: Json | null
          source_reference: string | null
          source_type: string | null
          started_at: string | null
          status: string | null
          target_titles: string[] | null
          total_batches: number | null
          total_records: number | null
        }
        Insert: {
          accounts_enriched?: number | null
          agent_config?: Json | null
          batch_size?: number | null
          can_pause?: boolean | null
          completed_at?: string | null
          concurrency?: number | null
          config_icp_id?: string | null
          contacts_discovered?: number | null
          created_at?: string | null
          created_by?: string | null
          credits_remaining?: number | null
          credits_used?: number | null
          current_batch?: number | null
          cursor?: string | null
          enable_contact_discovery?: boolean | null
          enriched_records?: number | null
          error_message?: string | null
          estimated_completion_at?: string | null
          failed_records?: number | null
          fields_enriched?: number | null
          filter_criteria?: Json | null
          heartbeat_interval_ms?: number | null
          icp_criteria?: Json | null
          id?: string
          input_data?: Json | null
          job_type: string
          last_heartbeat?: string | null
          last_progress_update?: string | null
          org_id: string
          paused_at?: string | null
          processed_records?: number | null
          progress_percentage?: number | null
          provider: string
          recovery_count?: number | null
          rows_completed?: number | null
          rows_failed?: number | null
          rows_pending?: number | null
          source_breakdown?: Json | null
          source_reference?: string | null
          source_type?: string | null
          started_at?: string | null
          status?: string | null
          target_titles?: string[] | null
          total_batches?: number | null
          total_records?: number | null
        }
        Update: {
          accounts_enriched?: number | null
          agent_config?: Json | null
          batch_size?: number | null
          can_pause?: boolean | null
          completed_at?: string | null
          concurrency?: number | null
          config_icp_id?: string | null
          contacts_discovered?: number | null
          created_at?: string | null
          created_by?: string | null
          credits_remaining?: number | null
          credits_used?: number | null
          current_batch?: number | null
          cursor?: string | null
          enable_contact_discovery?: boolean | null
          enriched_records?: number | null
          error_message?: string | null
          estimated_completion_at?: string | null
          failed_records?: number | null
          fields_enriched?: number | null
          filter_criteria?: Json | null
          heartbeat_interval_ms?: number | null
          icp_criteria?: Json | null
          id?: string
          input_data?: Json | null
          job_type?: string
          last_heartbeat?: string | null
          last_progress_update?: string | null
          org_id?: string
          paused_at?: string | null
          processed_records?: number | null
          progress_percentage?: number | null
          provider?: string
          recovery_count?: number | null
          rows_completed?: number | null
          rows_failed?: number | null
          rows_pending?: number | null
          source_breakdown?: Json | null
          source_reference?: string | null
          source_type?: string | null
          started_at?: string | null
          status?: string | null
          target_titles?: string[] | null
          total_batches?: number | null
          total_records?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_jobs_config_icp_id_fkey"
            columns: ["config_icp_id"]
            isOneToOne: false
            referencedRelation: "icp_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_queue: {
        Row: {
          actual_cost: number | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          error_details: Json | null
          error_message: string | null
          estimated_cost: number | null
          failed_records: number | null
          id: string
          input_data: Json | null
          job_type: string
          last_processed_at: string | null
          max_cost_per_record: number | null
          org_id: string | null
          priority: number | null
          processed_records: number | null
          record_ids: string[] | null
          skip_expensive_sources: boolean | null
          sources_enabled: string[] | null
          started_at: string | null
          status: string | null
          successful_records: number | null
          total_records: number | null
        }
        Insert: {
          actual_cost?: number | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_details?: Json | null
          error_message?: string | null
          estimated_cost?: number | null
          failed_records?: number | null
          id?: string
          input_data?: Json | null
          job_type: string
          last_processed_at?: string | null
          max_cost_per_record?: number | null
          org_id?: string | null
          priority?: number | null
          processed_records?: number | null
          record_ids?: string[] | null
          skip_expensive_sources?: boolean | null
          sources_enabled?: string[] | null
          started_at?: string | null
          status?: string | null
          successful_records?: number | null
          total_records?: number | null
        }
        Update: {
          actual_cost?: number | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_details?: Json | null
          error_message?: string | null
          estimated_cost?: number | null
          failed_records?: number | null
          id?: string
          input_data?: Json | null
          job_type?: string
          last_processed_at?: string | null
          max_cost_per_record?: number | null
          org_id?: string | null
          priority?: number | null
          processed_records?: number | null
          record_ids?: string[] | null
          skip_expensive_sources?: boolean | null
          sources_enabled?: string[] | null
          started_at?: string | null
          status?: string | null
          successful_records?: number | null
          total_records?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_queue_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_rows: {
        Row: {
          confidence: string | null
          created_at: string | null
          current_agent: string | null
          enriched_raw: Json | null
          error_message: string | null
          external_id: string | null
          extra_contacts_found: number | null
          field_scores: Json | null
          icp_agent_completed_at: string | null
          icp_criteria_used: Json | null
          icp_fail_reasons: string[] | null
          icp_pass: boolean | null
          id: string
          job_id: string | null
          max_possible_score: number | null
          org_id: string
          overall_score: number | null
          raw_input: Json | null
          record_id: string
          record_type: string
          retry_count: number | null
          search_agent_completed_at: string | null
          search_payload: Json | null
          source_type: string | null
          status: string | null
          total_score: number | null
          updated_at: string | null
          validated_data: Json | null
          validation_agent_completed_at: string | null
          validation_summary: string | null
        }
        Insert: {
          confidence?: string | null
          created_at?: string | null
          current_agent?: string | null
          enriched_raw?: Json | null
          error_message?: string | null
          external_id?: string | null
          extra_contacts_found?: number | null
          field_scores?: Json | null
          icp_agent_completed_at?: string | null
          icp_criteria_used?: Json | null
          icp_fail_reasons?: string[] | null
          icp_pass?: boolean | null
          id?: string
          job_id?: string | null
          max_possible_score?: number | null
          org_id: string
          overall_score?: number | null
          raw_input?: Json | null
          record_id: string
          record_type: string
          retry_count?: number | null
          search_agent_completed_at?: string | null
          search_payload?: Json | null
          source_type?: string | null
          status?: string | null
          total_score?: number | null
          updated_at?: string | null
          validated_data?: Json | null
          validation_agent_completed_at?: string | null
          validation_summary?: string | null
        }
        Update: {
          confidence?: string | null
          created_at?: string | null
          current_agent?: string | null
          enriched_raw?: Json | null
          error_message?: string | null
          external_id?: string | null
          extra_contacts_found?: number | null
          field_scores?: Json | null
          icp_agent_completed_at?: string | null
          icp_criteria_used?: Json | null
          icp_fail_reasons?: string[] | null
          icp_pass?: boolean | null
          id?: string
          job_id?: string | null
          max_possible_score?: number | null
          org_id?: string
          overall_score?: number | null
          raw_input?: Json | null
          record_id?: string
          record_type?: string
          retry_count?: number | null
          search_agent_completed_at?: string | null
          search_payload?: Json | null
          source_type?: string | null
          status?: string | null
          total_score?: number | null
          updated_at?: string | null
          validated_data?: Json | null
          validation_agent_completed_at?: string | null
          validation_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_rows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "enrichment_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_rows_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_source_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          max_api_cost_per_record: number | null
          org_id: string
          priority_fields: string[] | null
          require_fields: string[] | null
          skip_external_if: Json | null
          source_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_api_cost_per_record?: number | null
          org_id: string
          priority_fields?: string[] | null
          require_fields?: string[] | null
          skip_external_if?: Json | null
          source_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_api_cost_per_record?: number | null
          org_id?: string
          priority_fields?: string[] | null
          require_fields?: string[] | null
          skip_external_if?: Json | null
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_source_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_spending: {
        Row: {
          created_at: string | null
          id: string
          month_start: string
          org_id: string
          phase: string
          total_calls: number
          total_spent: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          month_start: string
          org_id: string
          phase: string
          total_calls?: number
          total_spent?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          month_start?: string
          org_id?: string
          phase?: string
          total_calls?: number
          total_spent?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      enrichment_test_data: {
        Row: {
          created_at: string | null
          created_by: string | null
          expected_employee_count: number | null
          expected_founded_year: number | null
          expected_headquarters: string | null
          expected_industry: string | null
          expected_linkedin_url: string | null
          expected_mobile: string | null
          expected_naics: string | null
          expected_phone: string | null
          expected_revenue_range: string | null
          expected_sic_code: string | null
          id: string
          input_company: string | null
          input_domain: string | null
          input_email: string | null
          input_name: string | null
          input_title: string | null
          notes: string | null
          org_id: string | null
          source: string | null
          test_type: string
          verified_date: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expected_employee_count?: number | null
          expected_founded_year?: number | null
          expected_headquarters?: string | null
          expected_industry?: string | null
          expected_linkedin_url?: string | null
          expected_mobile?: string | null
          expected_naics?: string | null
          expected_phone?: string | null
          expected_revenue_range?: string | null
          expected_sic_code?: string | null
          id?: string
          input_company?: string | null
          input_domain?: string | null
          input_email?: string | null
          input_name?: string | null
          input_title?: string | null
          notes?: string | null
          org_id?: string | null
          source?: string | null
          test_type: string
          verified_date?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expected_employee_count?: number | null
          expected_founded_year?: number | null
          expected_headquarters?: string | null
          expected_industry?: string | null
          expected_linkedin_url?: string | null
          expected_mobile?: string | null
          expected_naics?: string | null
          expected_phone?: string | null
          expected_revenue_range?: string | null
          expected_sic_code?: string | null
          id?: string
          input_company?: string | null
          input_domain?: string | null
          input_email?: string | null
          input_name?: string | null
          input_title?: string | null
          notes?: string | null
          org_id?: string | null
          source?: string | null
          test_type?: string
          verified_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_test_data_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_validations: {
        Row: {
          account_external_id: string | null
          created_at: string
          enriched_value: string | null
          enrichment_job_id: string | null
          field_name: string
          id: string
          is_accurate: boolean | null
          lead_id: number | null
          notes: string | null
          org_id: string
          provider: string
          validated_at: string | null
          validated_by: string | null
          validated_value: string | null
          validation_source: string | null
        }
        Insert: {
          account_external_id?: string | null
          created_at?: string
          enriched_value?: string | null
          enrichment_job_id?: string | null
          field_name: string
          id?: string
          is_accurate?: boolean | null
          lead_id?: number | null
          notes?: string | null
          org_id: string
          provider: string
          validated_at?: string | null
          validated_by?: string | null
          validated_value?: string | null
          validation_source?: string | null
        }
        Update: {
          account_external_id?: string | null
          created_at?: string
          enriched_value?: string | null
          enrichment_job_id?: string | null
          field_name?: string
          id?: string
          is_accurate?: boolean | null
          lead_id?: number | null
          notes?: string | null
          org_id?: string
          provider?: string
          validated_at?: string | null
          validated_by?: string | null
          validated_value?: string | null
          validation_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_validations_enrichment_job_id_fkey"
            columns: ["enrichment_job_id"]
            isOneToOne: false
            referencedRelation: "enrichment_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_validations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "Leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_validations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_validations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      export_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          download_url: string | null
          error_message: string | null
          expires_at: string | null
          export_type: string
          filename: string | null
          filters: Json | null
          id: string
          org_id: string
          processed_records: number
          started_at: string | null
          status: string
          total_records: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          download_url?: string | null
          error_message?: string | null
          expires_at?: string | null
          export_type: string
          filename?: string | null
          filters?: Json | null
          id?: string
          org_id: string
          processed_records?: number
          started_at?: string | null
          status?: string
          total_records?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          download_url?: string | null
          error_message?: string | null
          expires_at?: string | null
          export_type?: string
          filename?: string | null
          filters?: Json | null
          id?: string
          org_id?: string
          processed_records?: number
          started_at?: string | null
          status?: string
          total_records?: number
        }
        Relationships: [
          {
            foreignKeyName: "export_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      external_data_sources: {
        Row: {
          api_key_configured: boolean | null
          company_size_breakdown: Json | null
          created_at: string | null
          credits_last_checked: string | null
          credits_remaining: number | null
          credits_used_total: number | null
          funding_breakdown: Json | null
          geography_breakdown: Json | null
          id: string
          industry_breakdown: Json | null
          is_active: boolean | null
          last_synced_at: string | null
          monthly_credit_limit: number | null
          org_id: string
          provider: string
          revenue_breakdown: Json | null
          technology_breakdown: Json | null
          total_accounts: number | null
          total_contacts: number | null
          updated_at: string | null
        }
        Insert: {
          api_key_configured?: boolean | null
          company_size_breakdown?: Json | null
          created_at?: string | null
          credits_last_checked?: string | null
          credits_remaining?: number | null
          credits_used_total?: number | null
          funding_breakdown?: Json | null
          geography_breakdown?: Json | null
          id?: string
          industry_breakdown?: Json | null
          is_active?: boolean | null
          last_synced_at?: string | null
          monthly_credit_limit?: number | null
          org_id: string
          provider: string
          revenue_breakdown?: Json | null
          technology_breakdown?: Json | null
          total_accounts?: number | null
          total_contacts?: number | null
          updated_at?: string | null
        }
        Update: {
          api_key_configured?: boolean | null
          company_size_breakdown?: Json | null
          created_at?: string | null
          credits_last_checked?: string | null
          credits_remaining?: number | null
          credits_used_total?: number | null
          funding_breakdown?: Json | null
          geography_breakdown?: Json | null
          id?: string
          industry_breakdown?: Json | null
          is_active?: boolean | null
          last_synced_at?: string | null
          monthly_credit_limit?: number | null
          org_id?: string
          provider?: string
          revenue_breakdown?: Json | null
          technology_breakdown?: Json | null
          total_accounts?: number | null
          total_contacts?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_data_sources_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_scores: {
        Row: {
          account_external_id: string
          account_name: string | null
          created_at: string | null
          error_details: Json | null
          error_message: string | null
          icp_id: string | null
          id: string
          job_id: string | null
          last_retry_at: string | null
          org_id: string
          retry_count: number | null
        }
        Insert: {
          account_external_id: string
          account_name?: string | null
          created_at?: string | null
          error_details?: Json | null
          error_message?: string | null
          icp_id?: string | null
          id?: string
          job_id?: string | null
          last_retry_at?: string | null
          org_id: string
          retry_count?: number | null
        }
        Update: {
          account_external_id?: string
          account_name?: string | null
          created_at?: string | null
          error_details?: Json | null
          error_message?: string | null
          icp_id?: string | null
          id?: string
          job_id?: string | null
          last_retry_at?: string | null
          org_id?: string
          retry_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "failed_scores_icp_id_fkey"
            columns: ["icp_id"]
            isOneToOne: false
            referencedRelation: "icp_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "failed_scores_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "bulk_scoring_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "failed_scores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          id: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          id?: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          id?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      firmographic_conflicts: {
        Row: {
          account_external_id: string
          account_value: string | null
          ai_confidence: number | null
          ai_reasoning: string | null
          created_at: string | null
          field_name: string
          id: string
          lead_id: number | null
          lead_value: string | null
          org_id: string
          resolution_source: string | null
          resolved_at: string | null
          resolved_by: string | null
          resolved_value: string | null
          status: string
        }
        Insert: {
          account_external_id: string
          account_value?: string | null
          ai_confidence?: number | null
          ai_reasoning?: string | null
          created_at?: string | null
          field_name: string
          id?: string
          lead_id?: number | null
          lead_value?: string | null
          org_id: string
          resolution_source?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_value?: string | null
          status?: string
        }
        Update: {
          account_external_id?: string
          account_value?: string | null
          ai_confidence?: number | null
          ai_reasoning?: string | null
          created_at?: string | null
          field_name?: string
          id?: string
          lead_id?: number | null
          lead_value?: string | null
          org_id?: string
          resolution_source?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_value?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "firmographic_conflicts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "Leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firmographic_conflicts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firmographic_conflicts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_sequences: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          steps: Json | null
          trigger_event: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          steps?: Json | null
          trigger_event: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          steps?: Json | null
          trigger_event?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_sequences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_source: string | null
          event_status: string
          event_type: string
          id: string
          lead_id: string | null
          metadata: Json | null
          org_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_source?: string | null
          event_status?: string
          event_type: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          org_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_source?: string | null
          event_status?: string
          event_type?: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      icp_feature_weights: {
        Row: {
          computed_at: string | null
          created_at: string | null
          feature_name: string
          icp_id: string
          id: string
          is_significant: boolean
          org_id: string
          p_value: number
          r_value: number
          sample_size: number | null
          weight: number
        }
        Insert: {
          computed_at?: string | null
          created_at?: string | null
          feature_name: string
          icp_id: string
          id?: string
          is_significant?: boolean
          org_id: string
          p_value: number
          r_value: number
          sample_size?: number | null
          weight: number
        }
        Update: {
          computed_at?: string | null
          created_at?: string | null
          feature_name?: string
          icp_id?: string
          id?: string
          is_significant?: boolean
          org_id?: string
          p_value?: number
          r_value?: number
          sample_size?: number | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "icp_feature_weights_icp_id_fkey"
            columns: ["icp_id"]
            isOneToOne: false
            referencedRelation: "icp_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icp_feature_weights_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      icp_profiles: {
        Row: {
          budget_indicators: string[] | null
          buying_signals: string[] | null
          buying_triggers: string[] | null
          category: string | null
          cities: string[] | null
          company_keywords: string[] | null
          company_sizes: number[] | null
          company_stages: string[] | null
          competitive_landscape: string[] | null
          confidence_score: number | null
          created_at: string | null
          decision_process: string | null
          description: string | null
          disqualifiers: Json | null
          excluded_companies: string[] | null
          excluded_industries: string[] | null
          funding_status: string[] | null
          geographies: string[] | null
          growth_stage: string[] | null
          id: string
          industries: string[] | null
          intent_signals: string[] | null
          is_primary: boolean | null
          last_validated_at: string | null
          match_count: number | null
          name: string
          org_id: string
          pain_points: string[] | null
          parent_icp_id: string | null
          persona_decision_roles: string[] | null
          persona_departments: string[] | null
          persona_job_titles: string[] | null
          persona_seniority_levels: string[] | null
          priority: number | null
          regions: string[] | null
          revenue_ranges: string[] | null
          scoring_config: Json | null
          seasonal_patterns: string[] | null
          status: string | null
          sub_industries: string[] | null
          tags: string[] | null
          tam_estimate: number | null
          tech_stack: string[] | null
          template_source: string | null
          timezones: string[] | null
          use_case: string | null
          version: number | null
          version_notes: string | null
          vertical_filters: Json | null
          weights: Json | null
        }
        Insert: {
          budget_indicators?: string[] | null
          buying_signals?: string[] | null
          buying_triggers?: string[] | null
          category?: string | null
          cities?: string[] | null
          company_keywords?: string[] | null
          company_sizes?: number[] | null
          company_stages?: string[] | null
          competitive_landscape?: string[] | null
          confidence_score?: number | null
          created_at?: string | null
          decision_process?: string | null
          description?: string | null
          disqualifiers?: Json | null
          excluded_companies?: string[] | null
          excluded_industries?: string[] | null
          funding_status?: string[] | null
          geographies?: string[] | null
          growth_stage?: string[] | null
          id?: string
          industries?: string[] | null
          intent_signals?: string[] | null
          is_primary?: boolean | null
          last_validated_at?: string | null
          match_count?: number | null
          name: string
          org_id: string
          pain_points?: string[] | null
          parent_icp_id?: string | null
          persona_decision_roles?: string[] | null
          persona_departments?: string[] | null
          persona_job_titles?: string[] | null
          persona_seniority_levels?: string[] | null
          priority?: number | null
          regions?: string[] | null
          revenue_ranges?: string[] | null
          scoring_config?: Json | null
          seasonal_patterns?: string[] | null
          status?: string | null
          sub_industries?: string[] | null
          tags?: string[] | null
          tam_estimate?: number | null
          tech_stack?: string[] | null
          template_source?: string | null
          timezones?: string[] | null
          use_case?: string | null
          version?: number | null
          version_notes?: string | null
          vertical_filters?: Json | null
          weights?: Json | null
        }
        Update: {
          budget_indicators?: string[] | null
          buying_signals?: string[] | null
          buying_triggers?: string[] | null
          category?: string | null
          cities?: string[] | null
          company_keywords?: string[] | null
          company_sizes?: number[] | null
          company_stages?: string[] | null
          competitive_landscape?: string[] | null
          confidence_score?: number | null
          created_at?: string | null
          decision_process?: string | null
          description?: string | null
          disqualifiers?: Json | null
          excluded_companies?: string[] | null
          excluded_industries?: string[] | null
          funding_status?: string[] | null
          geographies?: string[] | null
          growth_stage?: string[] | null
          id?: string
          industries?: string[] | null
          intent_signals?: string[] | null
          is_primary?: boolean | null
          last_validated_at?: string | null
          match_count?: number | null
          name?: string
          org_id?: string
          pain_points?: string[] | null
          parent_icp_id?: string | null
          persona_decision_roles?: string[] | null
          persona_departments?: string[] | null
          persona_job_titles?: string[] | null
          persona_seniority_levels?: string[] | null
          priority?: number | null
          regions?: string[] | null
          revenue_ranges?: string[] | null
          scoring_config?: Json | null
          seasonal_patterns?: string[] | null
          status?: string | null
          sub_industries?: string[] | null
          tags?: string[] | null
          tam_estimate?: number | null
          tech_stack?: string[] | null
          template_source?: string | null
          timezones?: string[] | null
          use_case?: string | null
          version?: number | null
          version_notes?: string | null
          vertical_filters?: Json | null
          weights?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "icp_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icp_profiles_parent_icp_id_fkey"
            columns: ["parent_icp_id"]
            isOneToOne: false
            referencedRelation: "icp_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      icp_templates: {
        Row: {
          category: string
          company_sizes: number[] | null
          company_stages: string[] | null
          created_at: string | null
          created_by: string | null
          description: string | null
          geographies: string[] | null
          id: string
          industries: string[] | null
          is_public: boolean | null
          name: string
          persona_departments: string[] | null
          persona_job_titles: string[] | null
          persona_seniority_levels: string[] | null
          revenue_ranges: string[] | null
          sub_industries: string[] | null
          tech_stack: string[] | null
          updated_at: string | null
          use_cases: string[] | null
        }
        Insert: {
          category: string
          company_sizes?: number[] | null
          company_stages?: string[] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          geographies?: string[] | null
          id?: string
          industries?: string[] | null
          is_public?: boolean | null
          name: string
          persona_departments?: string[] | null
          persona_job_titles?: string[] | null
          persona_seniority_levels?: string[] | null
          revenue_ranges?: string[] | null
          sub_industries?: string[] | null
          tech_stack?: string[] | null
          updated_at?: string | null
          use_cases?: string[] | null
        }
        Update: {
          category?: string
          company_sizes?: number[] | null
          company_stages?: string[] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          geographies?: string[] | null
          id?: string
          industries?: string[] | null
          is_public?: boolean | null
          name?: string
          persona_departments?: string[] | null
          persona_job_titles?: string[] | null
          persona_seniority_levels?: string[] | null
          revenue_ranges?: string[] | null
          sub_industries?: string[] | null
          tech_stack?: string[] | null
          updated_at?: string | null
          use_cases?: string[] | null
        }
        Relationships: []
      }
      icp_validation_results: {
        Row: {
          created_at: string | null
          data_quality_score: number | null
          icp_id: string
          id: string
          org_id: string
          tam_estimate: number | null
          top_matches: Json | null
          total_matches: number | null
          validation_date: string | null
          validation_details: Json | null
        }
        Insert: {
          created_at?: string | null
          data_quality_score?: number | null
          icp_id: string
          id?: string
          org_id: string
          tam_estimate?: number | null
          top_matches?: Json | null
          total_matches?: number | null
          validation_date?: string | null
          validation_details?: Json | null
        }
        Update: {
          created_at?: string | null
          data_quality_score?: number | null
          icp_id?: string
          id?: string
          org_id?: string
          tam_estimate?: number | null
          top_matches?: Json | null
          total_matches?: number | null
          validation_date?: string | null
          validation_details?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "icp_validation_results_icp_id_fkey"
            columns: ["icp_id"]
            isOneToOne: false
            referencedRelation: "icp_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      icp_versions: {
        Row: {
          created_at: string
          icp_id: string
          id: string
          org_id: string
          performance_delta: Json | null
          snapshot: Json
          version: number
        }
        Insert: {
          created_at?: string
          icp_id: string
          id?: string
          org_id: string
          performance_delta?: Json | null
          snapshot?: Json
          version?: number
        }
        Update: {
          created_at?: string
          icp_id?: string
          id?: string
          org_id?: string
          performance_delta?: Json | null
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "icp_versions_icp_id_fkey"
            columns: ["icp_id"]
            isOneToOne: false
            referencedRelation: "icp_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icp_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string | null
          endpoint: string
          expires_at: string
          id: string
          idempotency_key: string
          org_id: string | null
          request_hash: string | null
          response: Json | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          expires_at: string
          id?: string
          idempotency_key: string
          org_id?: string | null
          request_hash?: string | null
          response?: Json | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          org_id?: string | null
          request_hash?: string | null
          response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_registry: {
        Row: {
          account_id: string | null
          contact_id: number | null
          created_at: string | null
          crm_object_type: string | null
          email_hash: string
          external_source_id: string | null
          id: string
          org_id: string
          primary_domain: string | null
          primary_email: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          contact_id?: number | null
          created_at?: string | null
          crm_object_type?: string | null
          email_hash: string
          external_source_id?: string | null
          id?: string
          org_id: string
          primary_domain?: string | null
          primary_email: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          contact_id?: number | null
          created_at?: string | null
          crm_object_type?: string | null
          email_hash?: string
          external_source_id?: string | null
          id?: string
          org_id?: string
          primary_domain?: string | null
          primary_email?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "identity_registry_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_registry_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "Leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_registry_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "leads_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      industry_mapping: {
        Row: {
          confidence: number | null
          id: number
          mapped_at: string | null
          raw_industry: string
          zoominfo_primary: string
          zoominfo_sub: string | null
        }
        Insert: {
          confidence?: number | null
          id?: number
          mapped_at?: string | null
          raw_industry: string
          zoominfo_primary: string
          zoominfo_sub?: string | null
        }
        Update: {
          confidence?: number | null
          id?: number
          mapped_at?: string | null
          raw_industry?: string
          zoominfo_primary?: string
          zoominfo_sub?: string | null
        }
        Relationships: []
      }
      integration_configs: {
        Row: {
          cache_settings: Json | null
          config: Json | null
          created_at: string | null
          created_by: string | null
          error_count: number | null
          error_message: string | null
          id: string
          integration_type: string
          last_sync_at: string | null
          org_id: string
          provider_name: string
          status: string
          updated_at: string | null
        }
        Insert: {
          cache_settings?: Json | null
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          error_count?: number | null
          error_message?: string | null
          id?: string
          integration_type: string
          last_sync_at?: string | null
          org_id: string
          provider_name: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          cache_settings?: Json | null
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          error_count?: number | null
          error_message?: string | null
          id?: string
          integration_type?: string
          last_sync_at?: string | null
          org_id?: string
          provider_name?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      integration_credentials: {
        Row: {
          created_at: string | null
          created_by: string | null
          credential_type: string
          encrypted_value: string
          expires_at: string | null
          id: string
          integration_config_id: string | null
          key_prefix: string | null
          org_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          credential_type: string
          encrypted_value: string
          expires_at?: string | null
          id?: string
          integration_config_id?: string | null
          key_prefix?: string | null
          org_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          credential_type?: string
          encrypted_value?: string
          expires_at?: string | null
          id?: string
          integration_config_id?: string | null
          key_prefix?: string | null
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_integration_config_id_fkey"
            columns: ["integration_config_id"]
            isOneToOne: false
            referencedRelation: "integration_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_logs: {
        Row: {
          completed_at: string | null
          duration_ms: number | null
          error_details: Json | null
          error_message: string | null
          id: string
          integration_config_id: string | null
          metadata: Json | null
          org_id: string
          provider_name: string | null
          records_created: number | null
          records_failed: number | null
          records_processed: number | null
          records_updated: number | null
          started_at: string | null
          status: string
          sync_type: string | null
        }
        Insert: {
          completed_at?: string | null
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          integration_config_id?: string | null
          metadata?: Json | null
          org_id: string
          provider_name?: string | null
          records_created?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string | null
          status: string
          sync_type?: string | null
        }
        Update: {
          completed_at?: string | null
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          integration_config_id?: string | null
          metadata?: Json | null
          org_id?: string
          provider_name?: string | null
          records_created?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_logs_integration_config_id_fkey"
            columns: ["integration_config_id"]
            isOneToOne: false
            referencedRelation: "integration_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          role: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          org_id: string
          role?: string
          status?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_id?: string
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_recovery_log: {
        Row: {
          id: string
          job_id: string | null
          new_status: string | null
          org_id: string | null
          previous_status: string | null
          reason: string | null
          recovered_at: string | null
          recovered_by: string | null
          recovery_type: string
          rows_recovered: number | null
        }
        Insert: {
          id?: string
          job_id?: string | null
          new_status?: string | null
          org_id?: string | null
          previous_status?: string | null
          reason?: string | null
          recovered_at?: string | null
          recovered_by?: string | null
          recovery_type: string
          rows_recovered?: number | null
        }
        Update: {
          id?: string
          job_id?: string | null
          new_status?: string | null
          org_id?: string | null
          previous_status?: string | null
          reason?: string | null
          recovered_at?: string | null
          recovered_by?: string | null
          recovery_type?: string
          rows_recovered?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_recovery_log_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "enrichment_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_recovery_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_routing_rules: {
        Row: {
          assigned_to: string | null
          auto_tasks: Json
          conditions: Json
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          priority: number
          sla_minutes: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          auto_tasks?: Json
          conditions?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          priority?: number
          sla_minutes?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          auto_tasks?: Json
          conditions?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          priority?: number
          sla_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_routing_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_at: string
          id: string
          lead_id: string
          lead_type: string
          org_id: string
          routing_rule_id: string | null
          status: string
          task_type: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at: string
          id?: string
          lead_id: string
          lead_type?: string
          org_id: string
          routing_rule_id?: string | null
          status?: string
          task_type?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string
          id?: string
          lead_id?: string
          lead_type?: string
          org_id?: string
          routing_rule_id?: string | null
          status?: string
          task_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tasks_routing_rule_id_fkey"
            columns: ["routing_rule_id"]
            isOneToOne: false
            referencedRelation: "lead_routing_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      Leads: {
        Row: {
          account_external_id: string | null
          cell_phone: string | null
          company: string | null
          company_facebook_url: string | null
          company_hq_address: string | null
          company_hq_city: string | null
          company_hq_country: string | null
          company_hq_postal_code: string | null
          company_hq_state: string | null
          company_main_phone: string | null
          company_naics_code: string | null
          company_sic_code: string | null
          consent_status: string | null
          contact_external_id: string | null
          country: string | null
          created_at: string
          data_source: string | null
          deep_research_completed_at: string | null
          direct_phone: string | null
          discovered_at: string | null
          discovered_from_account: string | null
          email: string | null
          email_status: string | null
          email_verification_status: string | null
          email_verified: boolean | null
          email_verified_at: string | null
          employee_count: number | null
          enriched_at: string | null
          enriched_from: string | null
          enrichment_citations: Json | null
          enrichment_confidence: number | null
          enrichment_field_scores: Json | null
          enrichment_max_score: number | null
          enrichment_overall_score: number | null
          enrichment_pass: boolean | null
          enrichment_source: string | null
          enrichment_total_score: number | null
          export_eligible: boolean | null
          external_database_match: boolean | null
          external_id: string | null
          facebook_url: string | null
          first_name: string | null
          icp_fail_reasons: string[] | null
          icp_qualified: boolean | null
          id: number
          industry: string | null
          last_exported_at: string | null
          last_name: string | null
          level: string | null
          linkedin_url: string | null
          location_city: string | null
          location_region: string | null
          lp_batch_id: string | null
          match_confidence: number | null
          match_reasoning: string | null
          mobile: string | null
          name: string | null
          org_id: string | null
          persona: string | null
          phone: string | null
          phone_e164: string | null
          phone_extension: string | null
          phone_sources: Json | null
          phone_type: string | null
          phone_verification_status: string | null
          phone_verified: boolean | null
          phones: Json | null
          pipeline_stage: string | null
          pipeline_triggered_by: string | null
          pipeline_updated_at: string | null
          previous_company: string | null
          previous_title: string | null
          priority_rank: number | null
          revenue_range: string | null
          source_type: Database["public"]["Enums"]["lead_source_type"] | null
          state_province: string | null
          status: string | null
          still_at_company: string | null
          sub_industry: string | null
          suppression_reason: string | null
          timezone: string | null
          title: string | null
          title_as_of: string | null
          title_raw: string | null
          twitter_url: string | null
          updated_at: string | null
          verified_email: boolean | null
          verified_phone: boolean | null
          website: string | null
        }
        Insert: {
          account_external_id?: string | null
          cell_phone?: string | null
          company?: string | null
          company_facebook_url?: string | null
          company_hq_address?: string | null
          company_hq_city?: string | null
          company_hq_country?: string | null
          company_hq_postal_code?: string | null
          company_hq_state?: string | null
          company_main_phone?: string | null
          company_naics_code?: string | null
          company_sic_code?: string | null
          consent_status?: string | null
          contact_external_id?: string | null
          country?: string | null
          created_at?: string
          data_source?: string | null
          deep_research_completed_at?: string | null
          direct_phone?: string | null
          discovered_at?: string | null
          discovered_from_account?: string | null
          email?: string | null
          email_status?: string | null
          email_verification_status?: string | null
          email_verified?: boolean | null
          email_verified_at?: string | null
          employee_count?: number | null
          enriched_at?: string | null
          enriched_from?: string | null
          enrichment_citations?: Json | null
          enrichment_confidence?: number | null
          enrichment_field_scores?: Json | null
          enrichment_max_score?: number | null
          enrichment_overall_score?: number | null
          enrichment_pass?: boolean | null
          enrichment_source?: string | null
          enrichment_total_score?: number | null
          export_eligible?: boolean | null
          external_database_match?: boolean | null
          external_id?: string | null
          facebook_url?: string | null
          first_name?: string | null
          icp_fail_reasons?: string[] | null
          icp_qualified?: boolean | null
          id?: number
          industry?: string | null
          last_exported_at?: string | null
          last_name?: string | null
          level?: string | null
          linkedin_url?: string | null
          location_city?: string | null
          location_region?: string | null
          lp_batch_id?: string | null
          match_confidence?: number | null
          match_reasoning?: string | null
          mobile?: string | null
          name?: string | null
          org_id?: string | null
          persona?: string | null
          phone?: string | null
          phone_e164?: string | null
          phone_extension?: string | null
          phone_sources?: Json | null
          phone_type?: string | null
          phone_verification_status?: string | null
          phone_verified?: boolean | null
          phones?: Json | null
          pipeline_stage?: string | null
          pipeline_triggered_by?: string | null
          pipeline_updated_at?: string | null
          previous_company?: string | null
          previous_title?: string | null
          priority_rank?: number | null
          revenue_range?: string | null
          source_type?: Database["public"]["Enums"]["lead_source_type"] | null
          state_province?: string | null
          status?: string | null
          still_at_company?: string | null
          sub_industry?: string | null
          suppression_reason?: string | null
          timezone?: string | null
          title?: string | null
          title_as_of?: string | null
          title_raw?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          verified_email?: boolean | null
          verified_phone?: boolean | null
          website?: string | null
        }
        Update: {
          account_external_id?: string | null
          cell_phone?: string | null
          company?: string | null
          company_facebook_url?: string | null
          company_hq_address?: string | null
          company_hq_city?: string | null
          company_hq_country?: string | null
          company_hq_postal_code?: string | null
          company_hq_state?: string | null
          company_main_phone?: string | null
          company_naics_code?: string | null
          company_sic_code?: string | null
          consent_status?: string | null
          contact_external_id?: string | null
          country?: string | null
          created_at?: string
          data_source?: string | null
          deep_research_completed_at?: string | null
          direct_phone?: string | null
          discovered_at?: string | null
          discovered_from_account?: string | null
          email?: string | null
          email_status?: string | null
          email_verification_status?: string | null
          email_verified?: boolean | null
          email_verified_at?: string | null
          employee_count?: number | null
          enriched_at?: string | null
          enriched_from?: string | null
          enrichment_citations?: Json | null
          enrichment_confidence?: number | null
          enrichment_field_scores?: Json | null
          enrichment_max_score?: number | null
          enrichment_overall_score?: number | null
          enrichment_pass?: boolean | null
          enrichment_source?: string | null
          enrichment_total_score?: number | null
          export_eligible?: boolean | null
          external_database_match?: boolean | null
          external_id?: string | null
          facebook_url?: string | null
          first_name?: string | null
          icp_fail_reasons?: string[] | null
          icp_qualified?: boolean | null
          id?: number
          industry?: string | null
          last_exported_at?: string | null
          last_name?: string | null
          level?: string | null
          linkedin_url?: string | null
          location_city?: string | null
          location_region?: string | null
          lp_batch_id?: string | null
          match_confidence?: number | null
          match_reasoning?: string | null
          mobile?: string | null
          name?: string | null
          org_id?: string | null
          persona?: string | null
          phone?: string | null
          phone_e164?: string | null
          phone_extension?: string | null
          phone_sources?: Json | null
          phone_type?: string | null
          phone_verification_status?: string | null
          phone_verified?: boolean | null
          phones?: Json | null
          pipeline_stage?: string | null
          pipeline_triggered_by?: string | null
          pipeline_updated_at?: string | null
          previous_company?: string | null
          previous_title?: string | null
          priority_rank?: number | null
          revenue_range?: string | null
          source_type?: Database["public"]["Enums"]["lead_source_type"] | null
          state_province?: string | null
          status?: string | null
          still_at_company?: string | null
          sub_industry?: string | null
          suppression_reason?: string | null
          timezone?: string | null
          title?: string | null
          title_as_of?: string | null
          title_raw?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          verified_email?: boolean | null
          verified_phone?: boolean | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_leads_account"
            columns: ["org_id", "account_external_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["org_id", "external_id"]
          },
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lp_exports: {
        Row: {
          batch_id: string
          campaign_name: string | null
          eligible_count: number | null
          export_count: number
          export_type: string | null
          exported_at: string | null
          exported_by: string | null
          filter_params: Json
          id: string
          org_id: string
          skip_reasons: Json | null
          skipped_count: number | null
        }
        Insert: {
          batch_id: string
          campaign_name?: string | null
          eligible_count?: number | null
          export_count: number
          export_type?: string | null
          exported_at?: string | null
          exported_by?: string | null
          filter_params: Json
          id?: string
          org_id: string
          skip_reasons?: Json | null
          skipped_count?: number | null
        }
        Update: {
          batch_id?: string
          campaign_name?: string | null
          eligible_count?: number | null
          export_count?: number
          export_type?: string | null
          exported_at?: string | null
          exported_by?: string | null
          filter_params?: Json
          id?: string
          org_id?: string
          skip_reasons?: Json | null
          skipped_count?: number | null
        }
        Relationships: []
      }
      marketing_leads: {
        Row: {
          assigned_to: string | null
          click_ids: Json | null
          company: string | null
          created_at: string
          email: string
          funnel_variant: string | null
          id: string
          ip_address: string | null
          lp_tier: string | null
          meeting_booked_at: string | null
          message: string | null
          name: string | null
          otp_status: string | null
          phone: string | null
          phone_carrier: string | null
          phone_line_type: string | null
          phone_valid: boolean | null
          phone_verified: boolean | null
          qualification_score: number | null
          routed_at: string | null
          routing_rule_id: string | null
          sla_breached: boolean | null
          sla_deadline: string | null
          source: string
          status: string
          subject: string | null
          updated_at: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          assigned_to?: string | null
          click_ids?: Json | null
          company?: string | null
          created_at?: string
          email: string
          funnel_variant?: string | null
          id?: string
          ip_address?: string | null
          lp_tier?: string | null
          meeting_booked_at?: string | null
          message?: string | null
          name?: string | null
          otp_status?: string | null
          phone?: string | null
          phone_carrier?: string | null
          phone_line_type?: string | null
          phone_valid?: boolean | null
          phone_verified?: boolean | null
          qualification_score?: number | null
          routed_at?: string | null
          routing_rule_id?: string | null
          sla_breached?: boolean | null
          sla_deadline?: string | null
          source: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          assigned_to?: string | null
          click_ids?: Json | null
          company?: string | null
          created_at?: string
          email?: string
          funnel_variant?: string | null
          id?: string
          ip_address?: string | null
          lp_tier?: string | null
          meeting_booked_at?: string | null
          message?: string | null
          name?: string | null
          otp_status?: string | null
          phone?: string | null
          phone_carrier?: string | null
          phone_line_type?: string | null
          phone_valid?: boolean | null
          phone_verified?: boolean | null
          qualification_score?: number | null
          routed_at?: string | null
          routing_rule_id?: string | null
          sla_breached?: boolean | null
          sla_deadline?: string | null
          source?: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_leads_routing_rule_id_fkey"
            columns: ["routing_rule_id"]
            isOneToOne: false
            referencedRelation: "lead_routing_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      master_account_data: {
        Row: {
          "Annual Revenue": string | null
          "Business Model": string | null
          Company: string | null
          created_at: string | null
          domain_normalized: string | null
          employee_count_int: number | null
          "Founded Year": string | null
          founded_year_int: number | null
          "HQ Address": string | null
          "HQ City": string | null
          "HQ Country": string | null
          "HQ Phone": string | null
          "HQ Postal Code": string | null
          "HQ State": string | null
          id: string
          Industry: string | null
          "Lead Source": string | null
          "Lead Source Details": string | null
          "NAICS 1": string | null
          "NAICS 2": string | null
          "NAICS 3": string | null
          "NAICS 4": string | null
          "No. of Employees": string | null
          revenue_range: string | null
          "Secondary Industry": string | null
          updated_at: string | null
          Website: string | null
        }
        Insert: {
          "Annual Revenue"?: string | null
          "Business Model"?: string | null
          Company?: string | null
          created_at?: string | null
          domain_normalized?: string | null
          employee_count_int?: number | null
          "Founded Year"?: string | null
          founded_year_int?: number | null
          "HQ Address"?: string | null
          "HQ City"?: string | null
          "HQ Country"?: string | null
          "HQ Phone"?: string | null
          "HQ Postal Code"?: string | null
          "HQ State"?: string | null
          id?: string
          Industry?: string | null
          "Lead Source"?: string | null
          "Lead Source Details"?: string | null
          "NAICS 1"?: string | null
          "NAICS 2"?: string | null
          "NAICS 3"?: string | null
          "NAICS 4"?: string | null
          "No. of Employees"?: string | null
          revenue_range?: string | null
          "Secondary Industry"?: string | null
          updated_at?: string | null
          Website?: string | null
        }
        Update: {
          "Annual Revenue"?: string | null
          "Business Model"?: string | null
          Company?: string | null
          created_at?: string | null
          domain_normalized?: string | null
          employee_count_int?: number | null
          "Founded Year"?: string | null
          founded_year_int?: number | null
          "HQ Address"?: string | null
          "HQ City"?: string | null
          "HQ Country"?: string | null
          "HQ Phone"?: string | null
          "HQ Postal Code"?: string | null
          "HQ State"?: string | null
          id?: string
          Industry?: string | null
          "Lead Source"?: string | null
          "Lead Source Details"?: string | null
          "NAICS 1"?: string | null
          "NAICS 2"?: string | null
          "NAICS 3"?: string | null
          "NAICS 4"?: string | null
          "No. of Employees"?: string | null
          revenue_range?: string | null
          "Secondary Industry"?: string | null
          updated_at?: string | null
          Website?: string | null
        }
        Relationships: []
      }
      ml_models: {
        Row: {
          accuracy: number | null
          feature_importance: Json | null
          id: string
          model_config: Json
          model_type: string
          org_id: string
          precision_score: number | null
          recall_score: number | null
          trained_at: string
          training_data_count: number | null
          version: number
        }
        Insert: {
          accuracy?: number | null
          feature_importance?: Json | null
          id?: string
          model_config?: Json
          model_type: string
          org_id: string
          precision_score?: number | null
          recall_score?: number | null
          trained_at?: string
          training_data_count?: number | null
          version?: number
        }
        Update: {
          accuracy?: number | null
          feature_importance?: Json | null
          id?: string
          model_config?: Json
          model_type?: string
          org_id?: string
          precision_score?: number | null
          recall_score?: number | null
          trained_at?: string
          training_data_count?: number | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ml_models_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      next_best_actions: {
        Row: {
          accepted_at: string | null
          account_external_id: string | null
          action_type: string
          ai_confidence: number | null
          ai_model: string | null
          completed_at: string | null
          context_summary: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          dismissed_reason: string | null
          due_date: string | null
          effectiveness_score: number | null
          expires_at: string | null
          id: string
          lead_id: number | null
          metadata: Json | null
          org_id: string
          outcome: string | null
          outcome_notes: string | null
          priority: number | null
          reasoning: string | null
          related_call_id: string | null
          related_email_id: string | null
          source: string | null
          status: string | null
          suggested_content: Json | null
          suggested_subject: string | null
          suggested_talking_points: Json | null
          template_id: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          account_external_id?: string | null
          action_type: string
          ai_confidence?: number | null
          ai_model?: string | null
          completed_at?: string | null
          context_summary?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          dismissed_reason?: string | null
          due_date?: string | null
          effectiveness_score?: number | null
          expires_at?: string | null
          id?: string
          lead_id?: number | null
          metadata?: Json | null
          org_id: string
          outcome?: string | null
          outcome_notes?: string | null
          priority?: number | null
          reasoning?: string | null
          related_call_id?: string | null
          related_email_id?: string | null
          source?: string | null
          status?: string | null
          suggested_content?: Json | null
          suggested_subject?: string | null
          suggested_talking_points?: Json | null
          template_id?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          account_external_id?: string | null
          action_type?: string
          ai_confidence?: number | null
          ai_model?: string | null
          completed_at?: string | null
          context_summary?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          dismissed_reason?: string | null
          due_date?: string | null
          effectiveness_score?: number | null
          expires_at?: string | null
          id?: string
          lead_id?: number | null
          metadata?: Json | null
          org_id?: string
          outcome?: string | null
          outcome_notes?: string | null
          priority?: number | null
          reasoning?: string | null
          related_call_id?: string | null
          related_email_id?: string | null
          source?: string | null
          status?: string | null
          suggested_content?: Json | null
          suggested_subject?: string | null
          suggested_talking_points?: Json | null
          template_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "next_best_actions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_best_actions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "Leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_best_actions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_best_actions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_best_actions_related_call_id_fkey"
            columns: ["related_call_id"]
            isOneToOne: false
            referencedRelation: "call_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_best_actions_related_email_id_fkey"
            columns: ["related_email_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_best_actions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "action_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_state: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          metadata: Json | null
          org_id: string
          provider: string
          redirect_url: string
          state_token: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          metadata?: Json | null
          org_id: string
          provider: string
          redirect_url: string
          state_token: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          provider?: string
          redirect_url?: string
          state_token?: string
        }
        Relationships: []
      }
      org_benchmarks: {
        Row: {
          benchmark_value: number
          created_at: string | null
          id: string
          industry: string | null
          metric_type: string
          org_id: string
          stage: string
          updated_at: string | null
        }
        Insert: {
          benchmark_value: number
          created_at?: string | null
          id?: string
          industry?: string | null
          metric_type: string
          org_id: string
          stage: string
          updated_at?: string | null
        }
        Update: {
          benchmark_value?: number
          created_at?: string | null
          id?: string
          industry?: string | null
          metric_type?: string
          org_id?: string
          stage?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_benchmarks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_campaign_config: {
        Row: {
          ad_account_id: string | null
          campaign_name: string
          created_at: string
          end_date: string | null
          id: string
          landing_page_variant: string | null
          monthly_budget_cents: number | null
          org_id: string
          platform: string
          quiz_variant: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ad_account_id?: string | null
          campaign_name: string
          created_at?: string
          end_date?: string | null
          id?: string
          landing_page_variant?: string | null
          monthly_budget_cents?: number | null
          org_id: string
          platform: string
          quiz_variant?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string | null
          campaign_name?: string
          created_at?: string
          end_date?: string | null
          id?: string
          landing_page_variant?: string | null
          monthly_budget_cents?: number | null
          org_id?: string
          platform?: string
          quiz_variant?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_campaign_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_onboarding_config: {
        Row: {
          brand_primary_color: string | null
          brand_secondary_color: string | null
          calendly_base_url: string | null
          company_name: string | null
          created_at: string
          id: string
          launched_at: string | null
          logo_url: string | null
          monthly_lead_target: number | null
          onboarding_status: string
          org_id: string
          paused_at: string | null
          target_persona_description: string | null
          updated_at: string
          value_proposition: string | null
          website_url: string | null
        }
        Insert: {
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          calendly_base_url?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          launched_at?: string | null
          logo_url?: string | null
          monthly_lead_target?: number | null
          onboarding_status?: string
          org_id: string
          paused_at?: string | null
          target_persona_description?: string | null
          updated_at?: string
          value_proposition?: string | null
          website_url?: string | null
        }
        Update: {
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          calendly_base_url?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          launched_at?: string | null
          logo_url?: string | null
          monthly_lead_target?: number | null
          onboarding_status?: string
          org_id?: string
          paused_at?: string | null
          target_persona_description?: string | null
          updated_at?: string
          value_proposition?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_onboarding_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          default_acv: number | null
          enrichment_credits_bonus: number | null
          enrichment_credits_reset_at: string | null
          enrichment_credits_total: number | null
          enrichment_credits_used: number | null
          icp_threshold: number | null
          id: string
          name: string
          org_settings: Json | null
          parent_org_id: string | null
          plan_id: string | null
          scoring_version: string | null
          service_type: string
          slug: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
        }
        Insert: {
          created_at?: string | null
          default_acv?: number | null
          enrichment_credits_bonus?: number | null
          enrichment_credits_reset_at?: string | null
          enrichment_credits_total?: number | null
          enrichment_credits_used?: number | null
          icp_threshold?: number | null
          id?: string
          name: string
          org_settings?: Json | null
          parent_org_id?: string | null
          plan_id?: string | null
          scoring_version?: string | null
          service_type?: string
          slug?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
        }
        Update: {
          created_at?: string | null
          default_acv?: number | null
          enrichment_credits_bonus?: number | null
          enrichment_credits_reset_at?: string | null
          enrichment_credits_total?: number | null
          enrichment_credits_used?: number | null
          icp_threshold?: number | null
          id?: string
          name?: string
          org_settings?: Json | null
          parent_org_id?: string | null
          plan_id?: string | null
          scoring_version?: string | null
          service_type?: string
          slug?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_org_id_fkey"
            columns: ["parent_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plan_limits"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_metrics_cache: {
        Row: {
          computed_at: string
          date_range_end: string
          date_range_start: string
          expires_at: string
          filters: Json | null
          id: string
          metrics: Json
          org_id: string
        }
        Insert: {
          computed_at?: string
          date_range_end: string
          date_range_start: string
          expires_at?: string
          filters?: Json | null
          id?: string
          metrics: Json
          org_id: string
        }
        Update: {
          computed_at?: string
          date_range_end?: string
          date_range_start?: string
          expires_at?: string
          filters?: Json | null
          id?: string
          metrics?: Json
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_metrics_cache_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          account_external_id: string | null
          conversion_value: number | null
          created_at: string | null
          duration_hours: number | null
          entered_at: string
          exited_at: string | null
          id: string
          lead_id: number | null
          notes: string | null
          org_id: string
          stage: string
          updated_at: string | null
        }
        Insert: {
          account_external_id?: string | null
          conversion_value?: number | null
          created_at?: string | null
          duration_hours?: number | null
          entered_at?: string
          exited_at?: string | null
          id?: string
          lead_id?: number | null
          notes?: string | null
          org_id: string
          stage: string
          updated_at?: string | null
        }
        Update: {
          account_external_id?: string | null
          conversion_value?: number | null
          created_at?: string | null
          duration_hours?: number | null
          entered_at?: string
          exited_at?: string | null
          id?: string
          lead_id?: number | null
          notes?: string | null
          org_id?: string
          stage?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "Leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_summaries: {
        Row: {
          ai_model: string | null
          created_at: string | null
          generated_at: string | null
          id: string
          key_insights: Json | null
          metrics_snapshot: Json | null
          opportunities: Json | null
          org_id: string
          recommended_actions: Json | null
          risks: Json | null
          summary_text: string
          summary_type: string | null
        }
        Insert: {
          ai_model?: string | null
          created_at?: string | null
          generated_at?: string | null
          id?: string
          key_insights?: Json | null
          metrics_snapshot?: Json | null
          opportunities?: Json | null
          org_id: string
          recommended_actions?: Json | null
          risks?: Json | null
          summary_text: string
          summary_type?: string | null
        }
        Update: {
          ai_model?: string | null
          created_at?: string | null
          generated_at?: string | null
          id?: string
          key_insights?: Json | null
          metrics_snapshot?: Json | null
          opportunities?: Json | null
          org_id?: string
          recommended_actions?: Json | null
          risks?: Json | null
          summary_text?: string
          summary_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_summaries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_limits: {
        Row: {
          api_calls_monthly: number | null
          created_at: string
          display_name: string
          enrichment_credits_monthly: number | null
          features: Json
          history_months: number | null
          id: string
          is_active: boolean
          max_accounts: number | null
          max_icp_models: number | null
          max_integrations: number | null
          max_leads: number | null
          max_users: number | null
          plan_name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          api_calls_monthly?: number | null
          created_at?: string
          display_name: string
          enrichment_credits_monthly?: number | null
          features?: Json
          history_months?: number | null
          id?: string
          is_active?: boolean
          max_accounts?: number | null
          max_icp_models?: number | null
          max_integrations?: number | null
          max_leads?: number | null
          max_users?: number | null
          plan_name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          api_calls_monthly?: number | null
          created_at?: string
          display_name?: string
          enrichment_credits_monthly?: number | null
          features?: Json
          history_months?: number | null
          id?: string
          is_active?: boolean
          max_accounts?: number | null
          max_icp_models?: number | null
          max_integrations?: number | null
          max_leads?: number | null
          max_users?: number | null
          plan_name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      processing_locks: {
        Row: {
          expires_at: string
          id: string
          locked_at: string
          locked_by: string | null
          org_id: string
          process_name: string
        }
        Insert: {
          expires_at: string
          id?: string
          locked_at?: string
          locked_by?: string | null
          org_id: string
          process_name: string
        }
        Update: {
          expires_at?: string
          id?: string
          locked_at?: string
          locked_by?: string | null
          org_id?: string
          process_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_locks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_health: {
        Row: {
          avg_response_time_ms: number | null
          error_details: Json | null
          failed_requests: number | null
          id: string
          last_failure_at: string | null
          last_success_at: string | null
          org_id: string
          provider: string
          status: string
          success_rate: number | null
          total_requests: number | null
          updated_at: string
        }
        Insert: {
          avg_response_time_ms?: number | null
          error_details?: Json | null
          failed_requests?: number | null
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          org_id: string
          provider: string
          status: string
          success_rate?: number | null
          total_requests?: number | null
          updated_at?: string
        }
        Update: {
          avg_response_time_ms?: number | null
          error_details?: Json | null
          failed_requests?: number | null
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          org_id?: string
          provider?: string
          status?: string
          success_rate?: number | null
          total_requests?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      quiz_responses: {
        Row: {
          answers: Json
          budget_range: string | null
          company_size: string | null
          created_at: string
          current_tools: string | null
          email: string
          id: string
          industry: string | null
          marketing_lead_id: string | null
          qualification_score: number | null
          timeline: string | null
        }
        Insert: {
          answers?: Json
          budget_range?: string | null
          company_size?: string | null
          created_at?: string
          current_tools?: string | null
          email: string
          id?: string
          industry?: string | null
          marketing_lead_id?: string | null
          qualification_score?: number | null
          timeline?: string | null
        }
        Update: {
          answers?: Json
          budget_range?: string | null
          company_size?: string | null
          created_at?: string
          current_tools?: string | null
          email?: string
          id?: string
          industry?: string | null
          marketing_lead_id?: string | null
          qualification_score?: number | null
          timeline?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_responses_marketing_lead_id_fkey"
            columns: ["marketing_lead_id"]
            isOneToOne: false
            referencedRelation: "marketing_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          last_request_at: string | null
          max_requests_per_window: number | null
          org_id: string
          requests_count: number | null
          window_duration_seconds: number | null
          window_start: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          last_request_at?: string | null
          max_requests_per_window?: number | null
          org_id: string
          requests_count?: number | null
          window_duration_seconds?: number | null
          window_start?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          last_request_at?: string | null
          max_requests_per_window?: number | null
          org_id?: string
          requests_count?: number | null
          window_duration_seconds?: number | null
          window_start?: string | null
        }
        Relationships: []
      }
      recommendation_history: {
        Row: {
          acted_on: boolean | null
          acted_on_at: string | null
          created_at: string
          id: string
          impact_estimate: string | null
          org_id: string
          priority_score: number
          recommendation_data: Json
          recommendation_type: string
        }
        Insert: {
          acted_on?: boolean | null
          acted_on_at?: string | null
          created_at?: string
          id?: string
          impact_estimate?: string | null
          org_id: string
          priority_score: number
          recommendation_data: Json
          recommendation_type: string
        }
        Update: {
          acted_on?: boolean | null
          acted_on_at?: string | null
          created_at?: string
          id?: string
          impact_estimate?: string | null
          org_id?: string
          priority_score?: number
          recommendation_data?: Json
          recommendation_type?: string
        }
        Relationships: []
      }
      rejections: {
        Row: {
          created_at: string | null
          id: string
          job_id: string | null
          org_id: string
          raw: Json | null
          reason: string | null
          row_index: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id?: string | null
          org_id: string
          raw?: Json | null
          reason?: string | null
          row_index?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string | null
          org_id?: string
          raw?: Json | null
          reason?: string | null
          row_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rejections_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "sync_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rejections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_performance: {
        Row: {
          avg_deal_size: number | null
          avg_sales_cycle_days: number | null
          avg_talk_ratio: number | null
          calls_made: number | null
          closing_score: number | null
          computed_at: string | null
          created_at: string | null
          deals_lost: number | null
          deals_won: number | null
          discovery_score: number | null
          emails_sent: number | null
          id: string
          meetings_booked: number | null
          objection_handling_score: number | null
          org_id: string
          period_end: string
          period_start: string
          pipeline_generated: number | null
          revenue_closed: number | null
          user_id: string
          win_rate: number | null
        }
        Insert: {
          avg_deal_size?: number | null
          avg_sales_cycle_days?: number | null
          avg_talk_ratio?: number | null
          calls_made?: number | null
          closing_score?: number | null
          computed_at?: string | null
          created_at?: string | null
          deals_lost?: number | null
          deals_won?: number | null
          discovery_score?: number | null
          emails_sent?: number | null
          id?: string
          meetings_booked?: number | null
          objection_handling_score?: number | null
          org_id: string
          period_end: string
          period_start: string
          pipeline_generated?: number | null
          revenue_closed?: number | null
          user_id: string
          win_rate?: number | null
        }
        Update: {
          avg_deal_size?: number | null
          avg_sales_cycle_days?: number | null
          avg_talk_ratio?: number | null
          calls_made?: number | null
          closing_score?: number | null
          computed_at?: string | null
          created_at?: string | null
          deals_lost?: number | null
          deals_won?: number | null
          discovery_score?: number | null
          emails_sent?: number | null
          id?: string
          meetings_booked?: number | null
          objection_handling_score?: number | null
          org_id?: string
          period_end?: string
          period_start?: string
          pipeline_generated?: number | null
          revenue_closed?: number | null
          user_id?: string
          win_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rep_performance_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      report_schedules: {
        Row: {
          created_at: string
          enabled: boolean
          frequency: string
          id: string
          last_run_at: string | null
          next_run_at: string | null
          org_id: string
          recipients: string[]
          report_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          frequency: string
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          org_id: string
          recipients?: string[]
          report_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          frequency?: string
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          org_id?: string
          recipients?: string[]
          report_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_schedules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_schedules_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "custom_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      rescore_queue: {
        Row: {
          account_external_id: string
          changed_fields: string[] | null
          id: string
          org_id: string
          processed_at: string | null
          queued_at: string
          reason: string
        }
        Insert: {
          account_external_id: string
          changed_fields?: string[] | null
          id?: string
          org_id: string
          processed_at?: string | null
          queued_at?: string
          reason?: string
        }
        Update: {
          account_external_id?: string
          changed_fields?: string[] | null
          id?: string
          org_id?: string
          processed_at?: string | null
          queued_at?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "rescore_queue_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_assumptions: {
        Row: {
          acv_source: string
          acv_value: number
          created_at: string
          id: string
          org_id: string
          scenarios: Json
          updated_at: string
          win_rate_source: string
          win_rate_value: number
        }
        Insert: {
          acv_source?: string
          acv_value?: number
          created_at?: string
          id?: string
          org_id: string
          scenarios?: Json
          updated_at?: string
          win_rate_source?: string
          win_rate_value?: number
        }
        Update: {
          acv_source?: string
          acv_value?: number
          created_at?: string
          id?: string
          org_id?: string
          scenarios?: Json
          updated_at?: string
          win_rate_source?: string
          win_rate_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "revenue_assumptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_follow_ups: {
        Row: {
          account_external_id: string | null
          completed_at: string | null
          created_at: string | null
          current_step: number | null
          deal_id: string | null
          id: string
          last_error: string | null
          lead_id: number | null
          org_id: string
          scheduled_at: string
          sequence_id: string | null
          status: string | null
        }
        Insert: {
          account_external_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          deal_id?: string | null
          id?: string
          last_error?: string | null
          lead_id?: number | null
          org_id: string
          scheduled_at: string
          sequence_id?: string | null
          status?: string | null
        }
        Update: {
          account_external_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          deal_id?: string | null
          id?: string
          last_error?: string | null
          lead_id?: number | null
          org_id?: string
          scheduled_at?: string
          sequence_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_follow_ups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_follow_ups_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "follow_up_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      score_history: {
        Row: {
          account_external_id: string
          change_reason: string | null
          changed_by: string | null
          computed_at: string | null
          created_at: string | null
          icp_id: string | null
          id: string
          new_score: Json | null
          old_score: Json | null
          org_id: string
        }
        Insert: {
          account_external_id: string
          change_reason?: string | null
          changed_by?: string | null
          computed_at?: string | null
          created_at?: string | null
          icp_id?: string | null
          id?: string
          new_score?: Json | null
          old_score?: Json | null
          org_id: string
        }
        Update: {
          account_external_id?: string
          change_reason?: string | null
          changed_by?: string | null
          computed_at?: string | null
          created_at?: string | null
          icp_id?: string | null
          id?: string
          new_score?: Json | null
          old_score?: Json | null
          org_id?: string
        }
        Relationships: []
      }
      scores: {
        Row: {
          account_external_id: string | null
          computed_at: string | null
          fit: number | null
          icp_id: string | null
          id: string
          intent: number | null
          org_id: string
          overall: number | null
          reachability: number | null
          reasons: Json | null
          scoring_version: string | null
        }
        Insert: {
          account_external_id?: string | null
          computed_at?: string | null
          fit?: number | null
          icp_id?: string | null
          id?: string
          intent?: number | null
          org_id: string
          overall?: number | null
          reachability?: number | null
          reasons?: Json | null
          scoring_version?: string | null
        }
        Update: {
          account_external_id?: string | null
          computed_at?: string | null
          fit?: number | null
          icp_id?: string | null
          id?: string
          intent?: number | null
          org_id?: string
          overall?: number | null
          reachability?: number | null
          reasons?: Json | null
          scoring_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scores_icp_id_fkey"
            columns: ["icp_id"]
            isOneToOne: false
            referencedRelation: "icp_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      segments: {
        Row: {
          account_count: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          org_id: string
          query_config: Json
          status: string
          updated_at: string
        }
        Insert: {
          account_count?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          org_id: string
          query_config?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          account_count?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          query_config?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "segments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_health: {
        Row: {
          avg_response_time_ms: number | null
          circuit_state: string | null
          cooldown_until: string | null
          created_at: string | null
          failure_count: number | null
          id: string
          last_error_message: string | null
          last_failure_at: string | null
          last_success_at: string | null
          service_name: string
          state_changed_at: string | null
          success_count: number | null
          total_failures: number | null
          total_requests: number | null
          updated_at: string | null
        }
        Insert: {
          avg_response_time_ms?: number | null
          circuit_state?: string | null
          cooldown_until?: string | null
          created_at?: string | null
          failure_count?: number | null
          id?: string
          last_error_message?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          service_name: string
          state_changed_at?: string | null
          success_count?: number | null
          total_failures?: number | null
          total_requests?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_response_time_ms?: number | null
          circuit_state?: string | null
          cooldown_until?: string | null
          created_at?: string | null
          failure_count?: number | null
          id?: string
          last_error_message?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          service_name?: string
          state_changed_at?: string | null
          success_count?: number | null
          total_failures?: number | null
          total_requests?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      signals_raw: {
        Row: {
          account_external_id: string | null
          id: string
          observed_at: string | null
          org_id: string
          type: string | null
          value: Json | null
          vendor: string | null
        }
        Insert: {
          account_external_id?: string | null
          id?: string
          observed_at?: string | null
          org_id: string
          type?: string | null
          value?: Json | null
          vendor?: string | null
        }
        Update: {
          account_external_id?: string | null
          id?: string
          observed_at?: string | null
          org_id?: string
          type?: string | null
          value?: Json | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signals_raw_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppression_rules: {
        Row: {
          created_at: string | null
          created_by: string | null
          domain: string | null
          email: string | null
          id: string
          org_id: string
          reason: string
          suppression_type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          domain?: string | null
          email?: string | null
          id?: string
          org_id: string
          reason: string
          suppression_type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          domain?: string | null
          email?: string | null
          id?: string
          org_id?: string
          reason?: string
          suppression_type?: string
        }
        Relationships: []
      }
      sync_jobs: {
        Row: {
          completed_at: string | null
          current_offset: number | null
          direction: string | null
          finished_at: string | null
          id: string
          inserted: number | null
          job_type: string | null
          org_id: string
          processed_records: number | null
          received: number | null
          rejected: number | null
          source_system: string | null
          started_at: string | null
          status: string | null
          total_records: number | null
          updated: number | null
          updated_at: string | null
          updated_records: number | null
        }
        Insert: {
          completed_at?: string | null
          current_offset?: number | null
          direction?: string | null
          finished_at?: string | null
          id?: string
          inserted?: number | null
          job_type?: string | null
          org_id: string
          processed_records?: number | null
          received?: number | null
          rejected?: number | null
          source_system?: string | null
          started_at?: string | null
          status?: string | null
          total_records?: number | null
          updated?: number | null
          updated_at?: string | null
          updated_records?: number | null
        }
        Update: {
          completed_at?: string | null
          current_offset?: number | null
          direction?: string | null
          finished_at?: string | null
          id?: string
          inserted?: number | null
          job_type?: string | null
          org_id?: string
          processed_records?: number | null
          received?: number | null
          rejected?: number | null
          source_system?: string | null
          started_at?: string | null
          status?: string | null
          total_records?: number | null
          updated?: number | null
          updated_at?: string | null
          updated_records?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_health_checks: {
        Row: {
          check_type: string
          checked_at: string | null
          created_at: string | null
          details: Json | null
          id: string
          status: string
        }
        Insert: {
          check_type: string
          checked_at?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          status?: string
        }
        Update: {
          check_type?: string
          checked_at?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          status?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          calendly_url: string | null
          created_at: string | null
          full_name: string | null
          max_leads_per_day: number | null
          org_id: string
          role: string
          territory: string[] | null
          timezone: string | null
          user_id: string
          working_hours_end: string | null
          working_hours_start: string | null
        }
        Insert: {
          calendly_url?: string | null
          created_at?: string | null
          full_name?: string | null
          max_leads_per_day?: number | null
          org_id: string
          role: string
          territory?: string[] | null
          timezone?: string | null
          user_id: string
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Update: {
          calendly_url?: string | null
          created_at?: string | null
          full_name?: string | null
          max_leads_per_day?: number | null
          org_id?: string
          role?: string
          territory?: string[] | null
          timezone?: string | null
          user_id?: string
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      value_creation_milestones: {
        Row: {
          auto_detect: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          id: string
          manual_notes: string | null
          milestone_key: string
          org_id: string
          phase: string
          plan_id: string
          sort_order: number
          target_day: number
          title: string
          updated_at: string
        }
        Insert: {
          auto_detect?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          manual_notes?: string | null
          milestone_key: string
          org_id: string
          phase: string
          plan_id: string
          sort_order?: number
          target_day: number
          title: string
          updated_at?: string
        }
        Update: {
          auto_detect?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          manual_notes?: string | null
          milestone_key?: string
          org_id?: string
          phase?: string
          plan_id?: string
          sort_order?: number
          target_day?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "value_creation_milestones_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "value_creation_milestones_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "value_creation_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      value_creation_plans: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          org_id: string
          plan_name: string
          started_at: string
          status: string
          target_completion_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          org_id: string
          plan_name?: string
          started_at?: string
          status?: string
          target_completion_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          plan_name?: string
          started_at?: string
          status?: string
          target_completion_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "value_creation_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_log: {
        Row: {
          confidence_score: number | null
          contact_id: number | null
          id: string
          org_id: string
          provider: string | null
          provider_response: Json | null
          status: string | null
          value_checked: string
          verification_type: string | null
          verified_at: string | null
        }
        Insert: {
          confidence_score?: number | null
          contact_id?: number | null
          id?: string
          org_id: string
          provider?: string | null
          provider_response?: Json | null
          status?: string | null
          value_checked: string
          verification_type?: string | null
          verified_at?: string | null
        }
        Update: {
          confidence_score?: number | null
          contact_id?: number | null
          id?: string
          org_id?: string
          provider?: string | null
          provider_response?: Json | null
          status?: string | null
          value_checked?: string
          verification_type?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "Leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "leads_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          action: string
          created_at: string
          error_message: string | null
          failure_reason: string | null
          id: string
          last_retry_at: string | null
          max_retries: number | null
          next_retry_at: string | null
          object_type: string
          org_id: string
          payload: Json
          permanently_failed: boolean | null
          processed: boolean
          processed_at: string | null
          record_id: string
          retry_count: number | null
          webhook_type: string
        }
        Insert: {
          action: string
          created_at?: string
          error_message?: string | null
          failure_reason?: string | null
          id?: string
          last_retry_at?: string | null
          max_retries?: number | null
          next_retry_at?: string | null
          object_type: string
          org_id: string
          payload?: Json
          permanently_failed?: boolean | null
          processed?: boolean
          processed_at?: string | null
          record_id: string
          retry_count?: number | null
          webhook_type: string
        }
        Update: {
          action?: string
          created_at?: string
          error_message?: string | null
          failure_reason?: string | null
          id?: string
          last_retry_at?: string | null
          max_retries?: number | null
          next_retry_at?: string | null
          object_type?: string
          org_id?: string
          payload?: Json
          permanently_failed?: boolean | null
          processed?: boolean
          processed_at?: string | null
          record_id?: string
          retry_count?: number | null
          webhook_type?: string
        }
        Relationships: []
      }
      weekly_analytics_snapshots: {
        Row: {
          created_at: string | null
          data_completeness: number | null
          geography_distribution: Json | null
          high_fit_accounts: number
          high_fit_percentage: number | null
          id: string
          low_fit_accounts: number
          low_fit_percentage: number | null
          medium_fit_accounts: number
          medium_fit_percentage: number | null
          org_id: string
          sam_accounts: number | null
          snapshot_date: string
          som_accounts: number | null
          tam_accounts: number | null
          top_countries: Json | null
          total_accounts: number
        }
        Insert: {
          created_at?: string | null
          data_completeness?: number | null
          geography_distribution?: Json | null
          high_fit_accounts?: number
          high_fit_percentage?: number | null
          id?: string
          low_fit_accounts?: number
          low_fit_percentage?: number | null
          medium_fit_accounts?: number
          medium_fit_percentage?: number | null
          org_id: string
          sam_accounts?: number | null
          snapshot_date: string
          som_accounts?: number | null
          tam_accounts?: number | null
          top_countries?: Json | null
          total_accounts?: number
        }
        Update: {
          created_at?: string | null
          data_completeness?: number | null
          geography_distribution?: Json | null
          high_fit_accounts?: number
          high_fit_percentage?: number | null
          id?: string
          low_fit_accounts?: number
          low_fit_percentage?: number | null
          medium_fit_accounts?: number
          medium_fit_percentage?: number | null
          org_id?: string
          sam_accounts?: number | null
          snapshot_date?: string
          som_accounts?: number | null
          tam_accounts?: number | null
          top_countries?: Json | null
          total_accounts?: number
        }
        Relationships: []
      }
      zapier_webhooks: {
        Row: {
          created_at: string
          event_type: string
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          org_id: string
          updated_at: string
          webhook_url: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          org_id: string
          updated_at?: string
          webhook_url: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          org_id?: string
          updated_at?: string
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapier_webhooks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      account_processing_stats: {
        Row: {
          enriched_accounts: number | null
          icp_qualified_accounts: number | null
          org_id: string | null
          scored_accounts: number | null
          total_accounts: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_metrics_cache: {
        Row: {
          avg_score: number | null
          high_fit_accounts: number | null
          high_fit_crm_accounts: number | null
          high_fit_database_accounts: number | null
          low_fit_accounts: number | null
          low_fit_crm_accounts: number | null
          low_fit_database_accounts: number | null
          medium_fit_accounts: number | null
          medium_fit_crm_accounts: number | null
          medium_fit_database_accounts: number | null
          org_id: string | null
          refreshed_at: string | null
          scored_accounts: number | null
          scored_crm_accounts: number | null
          scored_database_accounts: number | null
          total_accounts: number | null
          total_crm_accounts: number | null
          total_database_accounts: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_cost_summary: {
        Row: {
          avg_cost_per_record: number | null
          date: string | null
          org_id: string | null
          record_type: string | null
          records_processed: number | null
          source: string | null
          successful: number | null
          total_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_costs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_metrics_cache: {
        Row: {
          campaign_ready: number | null
          high_fit_crm_leads: number | null
          high_fit_database_leads: number | null
          high_fit_leads: number | null
          low_fit_crm_leads: number | null
          low_fit_database_leads: number | null
          low_fit_leads: number | null
          medium_fit_crm_leads: number | null
          medium_fit_database_leads: number | null
          medium_fit_leads: number | null
          org_id: string | null
          refreshed_at: string | null
          total_crm_leads: number | null
          total_database_leads: number | null
          total_leads: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_summary: {
        Row: {
          account_external_id: string | null
          company: string | null
          country: string | null
          created_at: string | null
          data_source: string | null
          employee_count: number | null
          first_name: string | null
          icp_qualified: boolean | null
          id: number | null
          industry: string | null
          last_name: string | null
          level: string | null
          location_city: string | null
          location_region: string | null
          name: string | null
          org_id: string | null
          persona: string | null
          pipeline_stage: string | null
          priority_rank: number | null
          revenue_range: string | null
          state_province: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          account_external_id?: string | null
          company?: string | null
          country?: string | null
          created_at?: string | null
          data_source?: string | null
          employee_count?: number | null
          first_name?: string | null
          icp_qualified?: boolean | null
          id?: number | null
          industry?: string | null
          last_name?: string | null
          level?: string | null
          location_city?: string | null
          location_region?: string | null
          name?: string | null
          org_id?: string | null
          persona?: string | null
          pipeline_stage?: string | null
          priority_rank?: number | null
          revenue_range?: string | null
          state_province?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          account_external_id?: string | null
          company?: string | null
          country?: string | null
          created_at?: string | null
          data_source?: string | null
          employee_count?: number | null
          first_name?: string | null
          icp_qualified?: boolean | null
          id?: number | null
          industry?: string | null
          last_name?: string | null
          level?: string | null
          location_city?: string | null
          location_region?: string | null
          name?: string | null
          org_id?: string | null
          persona?: string | null
          pipeline_stage?: string | null
          priority_rank?: number | null
          revenue_range?: string | null
          state_province?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_leads_account"
            columns: ["org_id", "account_external_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["org_id", "external_id"]
          },
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_dashboard_metrics_by_org: {
        Row: {
          both_accounts: number | null
          campaign_ready_accounts: number | null
          campaign_ready_leads: number | null
          computed_at: string | null
          crm_accounts: number | null
          crm_leads: number | null
          database_accounts: number | null
          database_leads: number | null
          high_fit_accounts: number | null
          high_fit_crm: number | null
          high_fit_crm_leads: number | null
          high_fit_database: number | null
          high_fit_database_leads: number | null
          high_fit_leads_total: number | null
          low_fit_accounts: number | null
          medium_fit_accounts: number | null
          org_id: string | null
          scored_accounts: number | null
          total_accounts: number | null
          with_geo: number | null
          with_industry: number | null
          with_revenue: number | null
          with_size: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_geography_by_org: {
        Row: {
          account_count: number | null
          country: string | null
          org_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_leads_by_week: {
        Row: {
          org_id: string | null
          qualified_leads: number | null
          total_leads: number | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_score_distribution: {
        Row: {
          account_count: number | null
          org_id: string | null
          score_bucket: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: {
        Args: { p_token: string; p_user_id: string }
        Returns: Json
      }
      acquire_processing_lock: {
        Args: {
          p_duration_minutes?: number
          p_org_id: string
          p_process_name: string
        }
        Returns: boolean
      }
      activate_organization: {
        Args: { org_id_param: string }
        Returns: undefined
      }
      auto_score_account: {
        Args: { p_account_external_id: string; p_org_id: string }
        Returns: undefined
      }
      backfill_enrichment_field_scores: {
        Args: { p_org_id?: string }
        Returns: Json
      }
      batch_move_accounts_org: { Args: never; Returns: number }
      bidirectional_firmographic_sync: {
        Args: { p_org_id: string }
        Returns: Json
      }
      bulk_create_accounts: {
        Args: { p_accounts: Json; p_org_id: string }
        Returns: {
          account_ids: string[]
          created_count: number
          skipped_count: number
        }[]
      }
      bulk_match_all_leads: {
        Args: { p_batch_size?: number; p_org_id: string }
        Returns: Json
      }
      bulk_score_accounts_batch: {
        Args: { p_account_ids: string[]; p_icp_id: string; p_org_id: string }
        Returns: {
          failed_count: number
          processed_count: number
          success_count: number
        }[]
      }
      bulk_score_all_accounts: {
        Args: { p_icp_id?: string; p_org_id: string }
        Returns: Json
      }
      calculate_account_score:
        | {
            Args: {
              p_account_external_id: string
              p_icp_id: string
              p_org_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_account_external_id: string
              p_icp_id?: string
              p_org_id: string
            }
            Returns: Json
          }
      calculate_account_score_readonly:
        | {
            Args: {
              account_external_id: string
              icp_id: string
              org_id_param: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_account_external_id: string
              p_icp_id?: string
              p_org_id: string
            }
            Returns: Json
          }
      calculate_adaptive_overall_score: {
        Args: { p_fit: number; p_intent: number; p_reachability: number }
        Returns: number
      }
      calculate_data_completeness: {
        Args: { p_org_id: string }
        Returns: number
      }
      calculate_intent_score:
        | {
            Args: { p_account_external_id: string; p_org_id: string }
            Returns: number
          }
        | { Args: { p_account_id: string; p_org_id: string }; Returns: number }
      calculate_next_run: {
        Args: { last_run?: string; schedule: string }
        Returns: string
      }
      calculate_reachability_score: {
        Args: { p_account_external_id: string; p_org_id: string }
        Returns: number
      }
      calculate_weighted_account_score: {
        Args: {
          p_account_external_id: string
          p_icp_id: string
          p_org_id: string
        }
        Returns: Json
      }
      check_materialized_view_exists: {
        Args: { view_name: string }
        Returns: boolean
      }
      check_plan_limit: {
        Args: {
          p_limit_type: string
          p_org_id: string
          p_requested_amount?: number
        }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_max_requests?: number
          p_org_id: string
          p_window_seconds?: number
        }
        Returns: Json
      }
      cleanup_expired_cache: { Args: never; Returns: number }
      cleanup_expired_idempotency_keys: { Args: never; Returns: number }
      cleanup_expired_oauth_states: { Args: never; Returns: number }
      cleanup_stuck_enrichment_jobs: { Args: never; Returns: Json }
      count_accounts_with_leads: { Args: { p_org_id: string }; Returns: number }
      count_campaign_ready_accounts:
        | { Args: { p_org_id: string }; Returns: number }
        | {
            Args: { p_data_source?: string; p_org_id: string }
            Returns: number
          }
      count_campaign_ready_leads: {
        Args: { p_org_id: string }
        Returns: number
      }
      count_high_fit_accounts_by_source: {
        Args: { p_data_source: string; p_org_id: string }
        Returns: number
      }
      count_high_fit_leads: { Args: { p_org_id: string }; Returns: number }
      count_high_fit_leads_by_source: {
        Args: { p_data_source: string; p_org_id: string }
        Returns: number
      }
      count_high_fit_leads_total: {
        Args: { p_org_id: string }
        Returns: number
      }
      count_leads_by_account_source: {
        Args: { p_data_source: string; p_org_id: string }
        Returns: number
      }
      deactivate_organization: {
        Args: { org_id_param: string }
        Returns: undefined
      }
      detect_firmographic_conflicts: {
        Args: { p_org_id: string }
        Returns: Json
      }
      enrich_accounts_from_master: { Args: { p_org_id: string }; Returns: Json }
      estimate_icp_matches:
        | {
            Args: {
              p_countries?: string[]
              p_industries?: string[]
              p_org_id: string
              p_revenues?: string[]
              p_sizes?: number[]
            }
            Returns: Json
          }
        | {
            Args: {
              p_company_keywords?: string[]
              p_countries?: string[]
              p_industries?: string[]
              p_org_id: string
              p_revenues?: string[]
              p_sizes?: number[]
            }
            Returns: Json
          }
      expire_old_invitations: { Args: never; Returns: number }
      format_phone_to_e164: {
        Args: { country_input?: string; phone_input: string }
        Returns: string
      }
      gdpr_delete_user_data: { Args: { target_user_id: string }; Returns: Json }
      gdpr_export_user_data: { Args: { target_user_id: string }; Returns: Json }
      generate_invitation_token: { Args: never; Returns: string }
      generate_sample_data: { Args: never; Returns: Json }
      get_account_lineage: { Args: { p_account_id: string }; Returns: Json }
      get_active_icp_id: { Args: { p_org_id: string }; Returns: string }
      get_branded_config_by_org_id: {
        Args: { p_org_id: string }
        Returns: {
          brand_primary_color: string
          brand_secondary_color: string
          calendly_base_url: string
          company_name: string
          logo_url: string
          org_id: string
          target_persona_description: string
          value_proposition: string
        }[]
      }
      get_branded_config_by_slug: {
        Args: { p_slug: string }
        Returns: {
          brand_primary_color: string
          brand_secondary_color: string
          calendly_base_url: string
          company_name: string
          logo_url: string
          org_id: string
          target_persona_description: string
          value_proposition: string
        }[]
      }
      get_country_drilldown: {
        Args: { p_industry: string; p_org_id: string }
        Returns: {
          account_count: number
          avg_score: number
          id: string
          industries_count: number
          market_share: number
          name: string
        }[]
      }
      get_current_user_org_id: { Args: never; Returns: string }
      get_dashboard_metrics_cached: {
        Args: { p_org_id: string }
        Returns: Json
      }
      get_dashboard_metrics_fast: {
        Args: { p_org_id: string; p_source_filter?: string }
        Returns: Json
      }
      get_data_completeness: {
        Args: { p_child_org_id?: string; p_data_org_id: string }
        Returns: Json
      }
      get_data_org_id: { Args: { p_org_id: string }; Returns: string }
      get_deal_stage_duration_hours: {
        Args: { p_deal_id: string; p_stage: string }
        Returns: number
      }
      get_enriched_leads_metrics: {
        Args: { p_org_id: string }
        Returns: {
          email_verified_count: number
          high_confidence: number
          phone_discovered: number
          total_enriched: number
        }[]
      }
      get_enrichment_cache:
        | {
            Args: { p_cache_key: string; p_cache_type: string }
            Returns: {
              confidence: number
              enriched_data: Json
              hit: boolean
              sources: string[]
            }[]
          }
        | {
            Args: {
              p_cache_key: string
              p_cache_type: string
              p_org_id?: string
            }
            Returns: {
              confidence: number
              enriched_data: Json
              hit: boolean
              sources: string[]
            }[]
          }
      get_enrichment_page_stats: {
        Args: { p_org_id: string }
        Returns: {
          accounts_with_contacts: number
          data_completeness_pct: number
          enriched_accounts: number
          enriched_leads: number
          total_accounts: number
          total_leads: number
        }[]
      }
      get_enrichment_stats: {
        Args: { p_org_id: string }
        Returns: {
          enriched_leads: number
          leads_with_email: number
          leads_with_phone: number
          leads_with_title: number
          total_leads: number
        }[]
      }
      get_filtered_accounts:
        | {
            Args: {
              p_cursor_id?: string
              p_cursor_value?: string
              p_icp_qualified?: boolean
              p_industry?: string
              p_max_score?: number
              p_min_score?: number
              p_org_id: string
              p_page_size?: number
              p_search?: string
              p_sort_direction?: string
              p_sort_field?: string
            }
            Returns: {
              country: string
              domain: string
              employee_count: number
              enriched_at: string
              enrichment_confidence: number
              external_id: string
              icp_qualified: boolean
              id: string
              industry_norm: string
              name: string
              overall_score: number
              propensity_score: number
              revenue_range: string
              total_count: number
              updated_at: string
            }[]
          }
        | {
            Args: {
              p_campaign_ready?: boolean
              p_country?: string
              p_cursor?: string
              p_data_source?: string
              p_fit_max?: number
              p_fit_min?: number
              p_industry?: string
              p_limit?: number
              p_org_id: string
              p_search_term?: string
            }
            Returns: {
              country: string
              cursor: string
              domain: string
              external_id: string
              id: string
              industry_norm: string
              name: string
              overall_score: number
              total_count: number
            }[]
          }
        | {
            Args: {
              p_campaign_ready?: boolean
              p_country?: string
              p_cursor?: string
              p_data_source?: string
              p_fit_max?: number
              p_fit_min?: number
              p_industry?: string
              p_limit?: number
              p_org_id: string
              p_search_term?: string
              p_sort_direction?: string
              p_sort_field?: string
            }
            Returns: {
              city: string
              country: string
              data_source: string
              deep_research_completed_at: string
              deep_research_requested: boolean
              domain: string
              employee_count: number
              enriched_at: string
              enrichment_overall_score: number
              external_id: string
              icp_qualified: boolean
              industry_norm: string
              last_funding_date: string
              last_funding_round: string
              linkedin_url: string
              name: string
              revenue_range: string
              state_province: string
              tech_stack: string[]
              total_count: number
              total_raised_usd: number
              updated_at: string
            }[]
          }
      get_firmographic_sync_opportunities: {
        Args: { p_org_id: string }
        Returns: Json
      }
      get_geography_breakdown: {
        Args: { p_org_id: string; p_score_org_id: string }
        Returns: {
          account_count: number
          country_name: string
          scored_count: number
          total_score: number
        }[]
      }
      get_geography_distribution: {
        Args: { p_org_id: string; p_source_filter?: string }
        Returns: {
          count: number
          country: string
        }[]
      }
      get_industry_breakdown: {
        Args: { p_org_id: string; p_score_org_id: string }
        Returns: {
          account_count: number
          high_fit_count: number
          industry_name: string
          scored_count: number
          total_score: number
        }[]
      }
      get_industry_drilldown: {
        Args: { p_org_id: string }
        Returns: {
          account_count: number
          avg_score: number
          countries_count: number
          id: string
          name: string
          with_revenue_count: number
          with_size_count: number
        }[]
      }
      get_leads_metrics: {
        Args: { p_org_id: string }
        Returns: {
          avg_reachability: number
          campaign_ready_count: number
          enriched_count: number
          icp_qualified_count: number
          linked_to_accounts_count: number
          total_leads: number
        }[]
      }
      get_org_enrichment_credits: {
        Args: { org_uuid: string }
        Returns: {
          remaining: number
          total: number
          used: number
        }[]
      }
      get_persona_drilldown: {
        Args: { p_country: string; p_industry: string; p_org_id: string }
        Returns: {
          account_count: number
          avg_score: number
          contact_count: number
          coverage_rate: number
          id: string
          name: string
        }[]
      }
      get_revenue_range_breakdown: {
        Args: { p_org_id: string }
        Returns: {
          account_count: number
          range_name: string
        }[]
      }
      get_size_breakdown: {
        Args: { p_org_id: string }
        Returns: {
          account_count: number
          size_bucket: string
        }[]
      }
      get_top_lead_titles: {
        Args: { p_limit?: number; p_org_id: string }
        Returns: {
          count: number
          title: string
        }[]
      }
      get_user_accessible_org_ids: { Args: never; Returns: string[] }
      get_users_with_emails: {
        Args: { p_org_id?: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          org_id: string
          org_name: string
          profile_role: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_bulk_scoring_job_progress: {
        Args: {
          chunk_failed: number
          chunk_successful: number
          current_chunk_num: number
          is_last_chunk: boolean
          job_id_param: string
          processed_count: number
        }
        Returns: undefined
      }
      increment_enrichment_credits: {
        Args: { p_amount: number; p_org_id: string }
        Returns: undefined
      }
      initialize_automation_settings: {
        Args: { target_org_id: string }
        Returns: undefined
      }
      initialize_feature_flags: {
        Args: { target_org_id: string }
        Returns: undefined
      }
      insert_single_account: {
        Args: {
          p_country: string
          p_data_source: string
          p_domain: string
          p_employee_count: number
          p_external_id: string
          p_industry_norm: string
          p_mobile: string
          p_name: string
          p_org_id: string
          p_phone: string
          p_revenue_range: string
          p_state_province: string
        }
        Returns: string
      }
      is_current_user_admin: { Args: never; Returns: boolean }
      is_lead_campaign_ready: {
        Args: { p_email: string; p_persona: string; p_title: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      map_title_to_persona: { Args: { title_input: string }; Returns: string }
      match_leads_fuzzy: {
        Args: {
          p_base_domain: string
          p_company_name: string
          p_country?: string
          p_org_id: string
        }
        Returns: {
          account_external_id: string
          confidence: number
        }[]
      }
      match_leads_to_accounts_fast: {
        Args: { p_is_external_db?: boolean; p_org_id: string }
        Returns: Json
      }
      merge_duplicate_accounts: { Args: { p_org_id: string }; Returns: Json }
      normalize_account_industries: {
        Args: { p_org_id: string }
        Returns: Json
      }
      normalize_country: { Args: { country_input: string }; Returns: string }
      normalize_country_value: {
        Args: { country_input: string }
        Returns: string
      }
      normalize_domain_text: { Args: { domain_input: string }; Returns: string }
      normalize_revenue_to_range: {
        Args: { revenue_raw: number }
        Returns: string
      }
      pause_enrichment_job: { Args: { p_job_id: string }; Returns: Json }
      record_data_quality_snapshot: {
        Args: { org_id_param: string }
        Returns: undefined
      }
      refresh_all_materialized_views: { Args: never; Returns: undefined }
      refresh_dashboard_caches: { Args: never; Returns: undefined }
      refresh_dashboard_metrics: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      refresh_materialized_view_concurrently: {
        Args: { view_name: string }
        Returns: undefined
      }
      refresh_reporting_views: { Args: never; Returns: undefined }
      release_processing_lock: {
        Args: { p_org_id: string; p_process_name: string }
        Returns: boolean
      }
      resume_enrichment_job: { Args: { p_job_id: string }; Returns: Json }
      revenue_to_numeric: { Args: { revenue_range: string }; Returns: number }
      scheduled_auto_match_all_orgs: { Args: never; Returns: undefined }
      scheduled_quality_snapshot_all_orgs: { Args: never; Returns: undefined }
      search_embeddings: {
        Args: {
          filter_source_types?: string[]
          match_count?: number
          match_org_id: string
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
          source_id: string
          source_type: string
        }[]
      }
      search_list_builder:
        | {
            Args: {
              p_business_models?: string[]
              p_cities?: string[]
              p_countries?: string[]
              p_custom_attributes?: Json
              p_employee_max?: number
              p_employee_min?: number
              p_has_email?: boolean
              p_has_phone?: boolean
              p_industries?: string[]
              p_levels?: string[]
              p_org_id: string
              p_page_limit?: number
              p_page_offset?: number
              p_personas?: string[]
              p_revenue_buckets?: string[]
              p_states?: string[]
              p_title_keywords?: string
            }
            Returns: {
              account_id: string
              account_name: string
              business_model: string
              city: string
              country: string
              domain: string
              employee_count: number
              external_id: string
              icp_qualified: boolean
              industry: string
              lead_count: number
              revenue_bucket: string
              revenue_range: string
              state_province: string
              total_accounts: number
            }[]
          }
        | {
            Args: {
              p_business_models?: string[]
              p_cities?: string[]
              p_countries?: string[]
              p_custom_attributes?: Json
              p_employee_max?: number
              p_employee_min?: number
              p_fit_score_max?: number
              p_fit_score_min?: number
              p_has_email?: boolean
              p_has_phone?: boolean
              p_industries?: string[]
              p_levels?: string[]
              p_org_id: string
              p_page_limit?: number
              p_page_offset?: number
              p_personas?: string[]
              p_revenue_buckets?: string[]
              p_score_org_id?: string
              p_states?: string[]
              p_title_keywords?: string
            }
            Returns: {
              account_id: string
              account_name: string
              business_model: string
              city: string
              country: string
              domain: string
              employee_count: number
              external_id: string
              fit_score: number
              icp_qualified: boolean
              industry: string
              intent_score: number
              lead_count: number
              overall_score: number
              revenue_bucket: string
              revenue_range: string
              state_province: string
              total_accounts: number
            }[]
          }
        | {
            Args: {
              p_business_models?: string[]
              p_cities?: string[]
              p_countries?: string[]
              p_employee_max?: number
              p_employee_min?: number
              p_has_email?: boolean
              p_has_phone?: boolean
              p_industries?: string[]
              p_levels?: string[]
              p_org_id: string
              p_page_limit?: number
              p_page_offset?: number
              p_personas?: string[]
              p_revenue_buckets?: string[]
              p_states?: string[]
              p_title_keywords?: string
            }
            Returns: {
              account_id: string
              account_name: string
              business_model: string
              city: string
              country: string
              domain: string
              employee_count: number
              external_id: string
              icp_qualified: boolean
              industry: string
              lead_count: number
              revenue_bucket: string
              revenue_range: string
              state_province: string
              total_accounts: number
            }[]
          }
      seed_default_ai_agents: {
        Args: { target_org_id: string }
        Returns: undefined
      }
      seed_default_benchmarks: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      set_enrichment_cache:
        | {
            Args: {
              p_cache_key: string
              p_cache_type: string
              p_confidence: number
              p_enriched_data: Json
              p_sources: string[]
              p_total_cost?: number
              p_ttl_days?: number
            }
            Returns: string
          }
        | {
            Args: {
              p_cache_key: string
              p_cache_type: string
              p_confidence: number
              p_enriched_data: Json
              p_org_id?: string
              p_sources: string[]
              p_total_cost?: number
              p_ttl_days?: number
            }
            Returns: string
          }
      set_firmographic_auto_sync: {
        Args: { p_enabled: boolean; p_org_id: string }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_account_scores_from_scores_table: {
        Args: { p_org_id?: string }
        Returns: Json
      }
      sync_accounts_from_leads: { Args: { p_org_id: string }; Returns: Json }
      sync_firmographics_to_accounts: {
        Args: { p_account_external_id?: string; p_org_id: string }
        Returns: Json
      }
      sync_firmographics_to_accounts_batch: {
        Args: { p_batch_size?: number; p_offset?: number; p_org_id: string }
        Returns: Json
      }
      sync_firmographics_to_leads: {
        Args: { p_account_external_id?: string; p_org_id: string }
        Returns: Json
      }
      sync_firmographics_to_leads_batch: {
        Args: { p_batch_size?: number; p_offset?: number; p_org_id: string }
        Returns: Json
      }
      sync_industry_to_leads: { Args: { p_org_id: string }; Returns: Json }
      update_ai_provider_health: {
        Args: {
          p_error_message?: string
          p_latency_ms?: number
          p_provider: string
          p_success: boolean
        }
        Returns: undefined
      }
      update_enrichment_job_progress: {
        Args: {
          p_current_batch?: number
          p_enriched_records: number
          p_failed_records: number
          p_job_id: string
          p_processed_records: number
        }
        Returns: Json
      }
      validate_api_key: {
        Args: { key_to_validate: string }
        Returns: {
          is_valid: boolean
          org_id: string
          scopes: string[]
        }[]
      }
      validate_data_quality: {
        Args: { p_org_id: string }
        Returns: {
          details: Json
          issue_count: number
          issue_type: string
          severity: string
        }[]
      }
    }
    Enums: {
      agent_registry_status: "active" | "inactive" | "degraded" | "starting"
      app_role: "super_admin" | "org_admin" | "user"
      feedback_decision: "approved" | "rejected" | "modified" | "pending"
      lead_source_type:
        | "webinar"
        | "website_visitor"
        | "event_attendee"
        | "linkedin"
        | "manual"
        | "csv_import"
        | "crm_sync"
        | "apollo"
        | "pdl"
        | "unknown"
      task_priority: "low" | "normal" | "high" | "critical"
      task_queue_status:
        | "pending"
        | "claimed"
        | "running"
        | "completed"
        | "failed"
        | "timeout"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agent_registry_status: ["active", "inactive", "degraded", "starting"],
      app_role: ["super_admin", "org_admin", "user"],
      feedback_decision: ["approved", "rejected", "modified", "pending"],
      lead_source_type: [
        "webinar",
        "website_visitor",
        "event_attendee",
        "linkedin",
        "manual",
        "csv_import",
        "crm_sync",
        "apollo",
        "pdl",
        "unknown",
      ],
      task_priority: ["low", "normal", "high", "critical"],
      task_queue_status: [
        "pending",
        "claimed",
        "running",
        "completed",
        "failed",
        "timeout",
      ],
    },
  },
} as const
