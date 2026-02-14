// Enhanced ICP Types and Interfaces

export interface ICPFieldWeight {
  value: number; // 1-10
  mandatory?: boolean;
  bonus?: boolean;
}

// Loose type for DB compatibility (Json columns)
export type ICPWeightsJson = Record<string, any>;
export type ICPDisqualifiersJson = Record<string, any>;
export type ICPScoringConfigJson = Record<string, any>;

export interface ICPWeights {
  industry?: ICPFieldWeight;
  sub_industry?: ICPFieldWeight;
  company_size?: ICPFieldWeight;
  revenue?: ICPFieldWeight;
  geography?: ICPFieldWeight;
  tech_stack?: ICPFieldWeight;
  funding?: ICPFieldWeight;
  persona?: ICPFieldWeight;
  [key: string]: ICPFieldWeight | undefined;
}

export interface ICPDisqualifiers {
  excluded_industries?: string[];
  excluded_geographies?: string[];
  excluded_size_bands?: string[];
  excluded_companies?: string[];
  hard_no_criteria?: string[];
}

export interface ICPScoringConfig {
  acv_override?: number;
  win_rate_override?: number;
  scenario?: 'conservative' | 'base' | 'aggressive';
}

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
  
  // Weighting & scoring (new) — use loose types for DB compat
  weights?: ICPWeightsJson;
  disqualifiers?: ICPDisqualifiersJson;
  scoring_config?: ICPScoringConfigJson;
  version_notes?: string;
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
  
  // Weighting & scoring (new)
  weights?: ICPWeights;
  disqualifiers?: ICPDisqualifiers;
  scoring_config?: ICPScoringConfig;
  version_notes?: string;
}

export interface ICPVersion {
  id: string;
  icp_id: string;
  org_id: string;
  version: number;
  snapshot: Record<string, any>;
  performance_delta?: Record<string, any>;
  created_at: string;
}

export interface RevenueAssumptions {
  id: string;
  org_id: string;
  acv_source: string;
  acv_value: number;
  win_rate_source: string;
  win_rate_value: number;
  scenarios: {
    conservative: number;
    base: number;
    aggressive: number;
  };
  created_at: string;
  updated_at: string;
}
