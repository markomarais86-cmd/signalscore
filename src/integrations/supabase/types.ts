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
      accounts: {
        Row: {
          country: string | null
          data_source: string | null
          domain: string | null
          employee_count: number | null
          enriched_at: string | null
          enriched_from: string | null
          external_database_match: boolean | null
          external_id: string
          id: string
          industry_norm: string | null
          industry_raw: string | null
          mobile: string | null
          name: string | null
          org_id: string
          phone: string | null
          propensity_computed_at: string | null
          propensity_score: number | null
          revenue_range: string | null
          state_province: string | null
          updated_at: string | null
        }
        Insert: {
          country?: string | null
          data_source?: string | null
          domain?: string | null
          employee_count?: number | null
          enriched_at?: string | null
          enriched_from?: string | null
          external_database_match?: boolean | null
          external_id: string
          id?: string
          industry_norm?: string | null
          industry_raw?: string | null
          mobile?: string | null
          name?: string | null
          org_id: string
          phone?: string | null
          propensity_computed_at?: string | null
          propensity_score?: number | null
          revenue_range?: string | null
          state_province?: string | null
          updated_at?: string | null
        }
        Update: {
          country?: string | null
          data_source?: string | null
          domain?: string | null
          employee_count?: number | null
          enriched_at?: string | null
          enriched_from?: string | null
          external_database_match?: boolean | null
          external_id?: string
          id?: string
          industry_norm?: string | null
          industry_raw?: string | null
          mobile?: string | null
          name?: string | null
          org_id?: string
          phone?: string | null
          propensity_computed_at?: string | null
          propensity_score?: number | null
          revenue_range?: string | null
          state_province?: string | null
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
      campaign_snapshots: {
        Row: {
          campaign_ready_contacts: number
          created_at: string | null
          created_by: string | null
          deduplication_strategy: string | null
          export_filename: string | null
          export_type: string
          exported_at: string
          firmographic_filters: Json | null
          icp_id: string | null
          icp_name: string
          icp_version: number | null
          id: string
          max_contacts_per_account: number | null
          org_id: string
          persona_filters_applied: Json | null
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
          firmographic_filters?: Json | null
          icp_id?: string | null
          icp_name: string
          icp_version?: number | null
          id?: string
          max_contacts_per_account?: number | null
          org_id: string
          persona_filters_applied?: Json | null
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
          firmographic_filters?: Json | null
          icp_id?: string | null
          icp_name?: string
          icp_version?: number | null
          id?: string
          max_contacts_per_account?: number | null
          org_id?: string
          persona_filters_applied?: Json | null
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
      contacts: {
        Row: {
          account_external_id: string | null
          country: string | null
          data_source: string | null
          email: string | null
          enriched_at: string | null
          enriched_from: string | null
          external_database_match: boolean | null
          external_id: string
          first_name: string | null
          id: string
          last_name: string | null
          level: string | null
          mobile: string | null
          org_id: string
          persona: string | null
          phone: string | null
          state_province: string | null
          title_raw: string | null
          updated_at: string | null
        }
        Insert: {
          account_external_id?: string | null
          country?: string | null
          data_source?: string | null
          email?: string | null
          enriched_at?: string | null
          enriched_from?: string | null
          external_database_match?: boolean | null
          external_id: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          level?: string | null
          mobile?: string | null
          org_id: string
          persona?: string | null
          phone?: string | null
          state_province?: string | null
          title_raw?: string | null
          updated_at?: string | null
        }
        Update: {
          account_external_id?: string | null
          country?: string | null
          data_source?: string | null
          email?: string | null
          enriched_at?: string | null
          enriched_from?: string | null
          external_database_match?: boolean | null
          external_id?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          level?: string | null
          mobile?: string | null
          org_id?: string
          persona?: string | null
          phone?: string | null
          state_province?: string | null
          title_raw?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_org_id_fkey"
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
          id: string
          org_id: string
          overall_completeness: number
          scored_accounts: number
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
          id?: string
          org_id: string
          overall_completeness: number
          scored_accounts: number
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
          id?: string
          org_id?: string
          overall_completeness?: number
          scored_accounts?: number
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
      enrichment_jobs: {
        Row: {
          batch_size: number | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          credits_remaining: number | null
          credits_used: number | null
          enriched_records: number | null
          error_message: string | null
          failed_records: number | null
          filter_criteria: Json | null
          id: string
          job_type: string
          org_id: string
          processed_records: number | null
          provider: string
          started_at: string | null
          status: string | null
          total_records: number | null
        }
        Insert: {
          batch_size?: number | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          credits_remaining?: number | null
          credits_used?: number | null
          enriched_records?: number | null
          error_message?: string | null
          failed_records?: number | null
          filter_criteria?: Json | null
          id?: string
          job_type: string
          org_id: string
          processed_records?: number | null
          provider: string
          started_at?: string | null
          status?: string | null
          total_records?: number | null
        }
        Update: {
          batch_size?: number | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          credits_remaining?: number | null
          credits_used?: number | null
          enriched_records?: number | null
          error_message?: string | null
          failed_records?: number | null
          filter_criteria?: Json | null
          id?: string
          job_type?: string
          org_id?: string
          processed_records?: number | null
          provider?: string
          started_at?: string | null
          status?: string | null
          total_records?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_jobs_org_id_fkey"
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
          created_at: string | null
          id: string
          is_active: boolean | null
          last_synced_at: string | null
          org_id: string
          provider: string
          total_accounts: number | null
          total_contacts: number | null
          updated_at: string | null
        }
        Insert: {
          api_key_configured?: boolean | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          org_id: string
          provider: string
          total_accounts?: number | null
          total_contacts?: number | null
          updated_at?: string | null
        }
        Update: {
          api_key_configured?: boolean | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          org_id?: string
          provider?: string
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
      icp_profiles: {
        Row: {
          budget_indicators: string[] | null
          buying_signals: string[] | null
          buying_triggers: string[] | null
          cities: string[] | null
          company_sizes: number[] | null
          company_stages: string[] | null
          competitive_landscape: string[] | null
          confidence_score: number | null
          created_at: string | null
          decision_process: string | null
          description: string | null
          excluded_companies: string[] | null
          excluded_industries: string[] | null
          funding_status: string[] | null
          geographies: string[] | null
          growth_stage: string[] | null
          id: string
          industries: string[] | null
          intent_signals: string[] | null
          last_validated_at: string | null
          match_count: number | null
          name: string
          org_id: string
          pain_points: string[] | null
          persona_decision_roles: string[] | null
          persona_departments: string[] | null
          persona_job_titles: string[] | null
          persona_seniority_levels: string[] | null
          regions: string[] | null
          revenue_ranges: string[] | null
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
        }
        Insert: {
          budget_indicators?: string[] | null
          buying_signals?: string[] | null
          buying_triggers?: string[] | null
          cities?: string[] | null
          company_sizes?: number[] | null
          company_stages?: string[] | null
          competitive_landscape?: string[] | null
          confidence_score?: number | null
          created_at?: string | null
          decision_process?: string | null
          description?: string | null
          excluded_companies?: string[] | null
          excluded_industries?: string[] | null
          funding_status?: string[] | null
          geographies?: string[] | null
          growth_stage?: string[] | null
          id?: string
          industries?: string[] | null
          intent_signals?: string[] | null
          last_validated_at?: string | null
          match_count?: number | null
          name: string
          org_id: string
          pain_points?: string[] | null
          persona_decision_roles?: string[] | null
          persona_departments?: string[] | null
          persona_job_titles?: string[] | null
          persona_seniority_levels?: string[] | null
          regions?: string[] | null
          revenue_ranges?: string[] | null
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
        }
        Update: {
          budget_indicators?: string[] | null
          buying_signals?: string[] | null
          buying_triggers?: string[] | null
          cities?: string[] | null
          company_sizes?: number[] | null
          company_stages?: string[] | null
          competitive_landscape?: string[] | null
          confidence_score?: number | null
          created_at?: string | null
          decision_process?: string | null
          description?: string | null
          excluded_companies?: string[] | null
          excluded_industries?: string[] | null
          funding_status?: string[] | null
          geographies?: string[] | null
          growth_stage?: string[] | null
          id?: string
          industries?: string[] | null
          intent_signals?: string[] | null
          last_validated_at?: string | null
          match_count?: number | null
          name?: string
          org_id?: string
          pain_points?: string[] | null
          persona_decision_roles?: string[] | null
          persona_departments?: string[] | null
          persona_job_titles?: string[] | null
          persona_seniority_levels?: string[] | null
          regions?: string[] | null
          revenue_ranges?: string[] | null
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
        }
        Relationships: [
          {
            foreignKeyName: "icp_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      integration_configs: {
        Row: {
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
          error_message: string | null
          id: string
          integration_config_id: string | null
          metadata: Json | null
          org_id: string
          records_created: number | null
          records_failed: number | null
          records_processed: number | null
          records_updated: number | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          integration_config_id?: string | null
          metadata?: Json | null
          org_id: string
          records_created?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string | null
          status: string
        }
        Update: {
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          integration_config_id?: string | null
          metadata?: Json | null
          org_id?: string
          records_created?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string
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
      Leads: {
        Row: {
          account_external_id: string | null
          company: string | null
          contact_external_id: string | null
          country: string | null
          created_at: string
          email: string | null
          employee_count: number | null
          external_id: string | null
          first_name: string | null
          id: number
          industry: string | null
          last_name: string | null
          match_confidence: number | null
          mobile: string | null
          name: string | null
          org_id: string | null
          persona: string | null
          phone: string | null
          revenue_range: string | null
          state_province: string | null
          status: string | null
          title: string | null
          website: string | null
        }
        Insert: {
          account_external_id?: string | null
          company?: string | null
          contact_external_id?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          employee_count?: number | null
          external_id?: string | null
          first_name?: string | null
          id?: number
          industry?: string | null
          last_name?: string | null
          match_confidence?: number | null
          mobile?: string | null
          name?: string | null
          org_id?: string | null
          persona?: string | null
          phone?: string | null
          revenue_range?: string | null
          state_province?: string | null
          status?: string | null
          title?: string | null
          website?: string | null
        }
        Update: {
          account_external_id?: string | null
          company?: string | null
          contact_external_id?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          employee_count?: number | null
          external_id?: string | null
          first_name?: string | null
          id?: number
          industry?: string | null
          last_name?: string | null
          match_confidence?: number | null
          mobile?: string | null
          name?: string | null
          org_id?: string | null
          persona?: string | null
          phone?: string | null
          revenue_range?: string | null
          state_province?: string | null
          status?: string | null
          title?: string | null
          website?: string | null
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
      organizations: {
        Row: {
          created_at: string | null
          enrichment_credits_total: number | null
          enrichment_credits_used: number | null
          id: string
          name: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          enrichment_credits_total?: number | null
          enrichment_credits_used?: number | null
          id?: string
          name: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          enrichment_credits_total?: number | null
          enrichment_credits_used?: number | null
          id?: string
          name?: string
          status?: string | null
        }
        Relationships: []
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
            foreignKeyName: "pipeline_stages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            foreignKeyName: "fk_scores_account"
            columns: ["org_id", "account_external_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["org_id", "external_id"]
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
      sync_jobs: {
        Row: {
          finished_at: string | null
          id: string
          inserted: number | null
          job_type: string | null
          org_id: string
          received: number | null
          rejected: number | null
          source_system: string | null
          started_at: string | null
          status: string | null
          updated: number | null
        }
        Insert: {
          finished_at?: string | null
          id?: string
          inserted?: number | null
          job_type?: string | null
          org_id: string
          received?: number | null
          rejected?: number | null
          source_system?: string | null
          started_at?: string | null
          status?: string | null
          updated?: number | null
        }
        Update: {
          finished_at?: string | null
          id?: string
          inserted?: number | null
          job_type?: string | null
          org_id?: string
          received?: number | null
          rejected?: number | null
          source_system?: string | null
          started_at?: string | null
          status?: string | null
          updated?: number | null
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
      user_profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          org_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          org_id?: string
          role?: string
          user_id?: string
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
      activate_organization: {
        Args: { org_id_param: string }
        Returns: undefined
      }
      auto_score_account: {
        Args: { p_account_external_id: string; p_org_id: string }
        Returns: undefined
      }
      calculate_account_score: {
        Args: {
          account_external_id: string
          icp_id: string
          org_id_param: string
        }
        Returns: Json
      }
      calculate_data_completeness: {
        Args: { p_org_id: string }
        Returns: number
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
      cleanup_expired_oauth_states: { Args: never; Returns: number }
      cleanup_stuck_enrichment_jobs: { Args: never; Returns: number }
      count_campaign_ready_accounts: {
        Args: { p_org_id: string }
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
      expire_old_invitations: { Args: never; Returns: number }
      generate_invitation_token: { Args: never; Returns: string }
      generate_sample_data: { Args: never; Returns: Json }
      get_active_icp_id: { Args: { p_org_id: string }; Returns: string }
      get_current_user_org_id: { Args: never; Returns: string }
      get_dashboard_metrics_fast: { Args: { p_org_id: string }; Returns: Json }
      get_geography_distribution: {
        Args: { p_org_id: string }
        Returns: {
          count: number
          country: string
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
      normalize_country: { Args: { country_input: string }; Returns: string }
      normalize_domain_text: { Args: { domain_input: string }; Returns: string }
      record_data_quality_snapshot: {
        Args: { org_id_param: string }
        Returns: undefined
      }
      refresh_all_materialized_views: { Args: never; Returns: undefined }
      refresh_reporting_views: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      validate_api_key: {
        Args: { key_to_validate: string }
        Returns: {
          is_valid: boolean
          org_id: string
          scopes: string[]
        }[]
      }
    }
    Enums: {
      app_role: "super_admin" | "org_admin" | "user"
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
      app_role: ["super_admin", "org_admin", "user"],
    },
  },
} as const
