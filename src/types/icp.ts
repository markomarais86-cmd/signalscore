// Enhanced ICP Types and Interfaces

export interface ICPProfile {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  use_case?: string;
  
  // Basic targeting
  industries?: string[];
  sub_industries?: string[];
  company_sizes?: number[];
  revenue_ranges?: string[];
  geographies?: string[];
  
  // Persona targeting
  persona_job_titles?: string[];
  persona_seniority_levels?: string[];
  persona_departments?: string[];
  persona_decision_roles?: string[];
  
  // Company classification
  company_stages?: string[];
  tech_stack?: string[];
  growth_stage?: string[];
  funding_status?: string[];
  
  // Advanced geographic
  regions?: string[];
  cities?: string[];
  timezones?: string[];
  
  // Intent and signals
  intent_signals?: string[];
  buying_triggers?: string[];
  
  // Exclusions
  excluded_companies?: string[];
  excluded_industries?: string[];
  
  // Patterns and budget
  seasonal_patterns?: string[];
  budget_indicators?: string[];
  
  // Metadata
  tags?: string[];
  template_source?: string;
  confidence_score?: number;
  match_count?: number;
  tam_estimate?: number;
  version?: number;
  status?: 'draft' | 'active' | 'archived';
  last_validated_at?: string;
  created_at: string;
  
  // Vertical targeting
  vertical_filters?: Record<string, any>;
}

export interface ICPTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  industries?: string[];
  sub_industries?: string[];
  company_sizes?: number[];
  revenue_ranges?: string[];
  geographies?: string[];
  persona_job_titles?: string[];
  persona_seniority_levels?: string[];
  persona_departments?: string[];
  company_stages?: string[];
  tech_stack?: string[];
  use_cases?: string[];
  is_public: boolean;
  created_by?: string;
}

export interface ICPValidationResult {
  id: string;
  icp_id: string;
  org_id: string;
  validation_date: string;
  total_matches: number;
  data_quality_score: number;
  tam_estimate: number;
  top_matches?: any;
  validation_details?: any;
}

export interface ICPFormData {
  name: string;
  description: string;
  use_case: string;
  
  // Basic targeting
  industries: string[];
  sub_industries: string[];
  company_sizes: number[];
  revenue_ranges: string[];
  geographies: string[];
  
  // Persona targeting
  persona_job_titles: string[];
  persona_seniority_levels: string[];
  persona_departments: string[];
  persona_decision_roles: string[];
  
  // Company classification
  company_stages: string[];
  tech_stack: string[];
  growth_stage: string[];
  funding_status: string[];
  
  // Advanced geographic
  regions: string[];
  cities: string[];
  timezones: string[];
  
  // Intent and signals
  intent_signals: string[];
  buying_triggers: string[];
  
  // Exclusions
  excluded_companies: string[];
  excluded_industries: string[];
  
  // Patterns and budget
  seasonal_patterns: string[];
  budget_indicators: string[];
  
  // Metadata
  tags: string[];
  template_source?: string;
  status: 'draft' | 'active' | 'archived';
  
  // Vertical targeting
  vertical_filters?: Record<string, any>;
}