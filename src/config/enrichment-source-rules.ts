/**
 * Enrichment Source Rules Configuration
 * 
 * Defines how to prioritize fields and when to skip external API calls
 * based on the source of the lead (webinar, website, event, etc.)
 */

export type LeadSourceType = 
  | 'webinar'
  | 'website_visitor'
  | 'event_attendee'
  | 'linkedin'
  | 'manual'
  | 'csv_import'
  | 'crm_sync'
  | 'apollo'
  | 'pdl'
  | 'unknown';

export interface EnrichmentSourceRule {
  source_type: LeadSourceType;
  label: string;
  description: string;
  
  // Fields to prioritize enriching for this source
  priority_fields: string[];
  
  // Conditions under which to skip external API calls
  skip_external_if: {
    has_company?: boolean;
    email_verified?: boolean;
    domain_enriched?: boolean;
    crm_is_source_of_truth?: boolean;
    minimum_completeness?: number; // 0-100%
  };
  
  // Fields that must be present
  require_fields: string[];
  
  // Maximum cost per record for external enrichment
  max_api_cost_per_record: number;
  
  // Whether to auto-match to existing accounts
  auto_match_accounts: boolean;
  
  // Trust level for data from this source (affects confidence scoring)
  trust_level: 'high' | 'medium' | 'low';
}

export const DEFAULT_SOURCE_RULES: Record<LeadSourceType, EnrichmentSourceRule> = {
  webinar: {
    source_type: 'webinar',
    label: 'Webinar',
    description: 'Attendees from webinar registration',
    priority_fields: ['employee_count', 'revenue_range', 'industry_norm', 'title'],
    skip_external_if: {
      has_company: true,
      email_verified: true,
      minimum_completeness: 60
    },
    require_fields: ['email'],
    max_api_cost_per_record: 0.05,
    auto_match_accounts: true,
    trust_level: 'medium'
  },
  
  website_visitor: {
    source_type: 'website_visitor',
    label: 'Website Visitor',
    description: 'Visitors identified on your website',
    priority_fields: ['employee_count', 'industry_norm', 'country', 'tech_stack'],
    skip_external_if: {
      domain_enriched: true,
      minimum_completeness: 50
    },
    require_fields: [],
    max_api_cost_per_record: 0.03,
    auto_match_accounts: true,
    trust_level: 'low'
  },
  
  event_attendee: {
    source_type: 'event_attendee',
    label: 'Event Attendee',
    description: 'Leads from conferences or events',
    priority_fields: ['title', 'linkedin_url', 'employee_count', 'revenue_range'],
    skip_external_if: {
      minimum_completeness: 70
    },
    require_fields: ['email', 'name'],
    max_api_cost_per_record: 0.08,
    auto_match_accounts: true,
    trust_level: 'high'
  },
  
  linkedin: {
    source_type: 'linkedin',
    label: 'LinkedIn',
    description: 'Contacts from LinkedIn',
    priority_fields: ['industry_norm', 'employee_count', 'revenue_range'],
    skip_external_if: {
      minimum_completeness: 80 // LinkedIn data is usually good
    },
    require_fields: ['linkedin_url'],
    max_api_cost_per_record: 0.02,
    auto_match_accounts: true,
    trust_level: 'high'
  },
  
  manual: {
    source_type: 'manual',
    label: 'Manual Entry',
    description: 'Manually entered leads',
    priority_fields: ['employee_count', 'revenue_range', 'industry_norm', 'country', 'linkedin_url'],
    skip_external_if: {},
    require_fields: [],
    max_api_cost_per_record: 0.10,
    auto_match_accounts: true,
    trust_level: 'medium'
  },
  
  csv_import: {
    source_type: 'csv_import',
    label: 'CSV Import',
    description: 'Imported from spreadsheet',
    priority_fields: ['employee_count', 'revenue_range', 'industry_norm'],
    skip_external_if: {
      minimum_completeness: 60
    },
    require_fields: [],
    max_api_cost_per_record: 0.05,
    auto_match_accounts: true,
    trust_level: 'medium'
  },
  
  crm_sync: {
    source_type: 'crm_sync',
    label: 'CRM Sync',
    description: 'Synced from CRM system',
    priority_fields: ['industry_norm', 'country'], // CRM usually has size/revenue
    skip_external_if: {
      crm_is_source_of_truth: true,
      minimum_completeness: 70
    },
    require_fields: [],
    max_api_cost_per_record: 0.02,
    auto_match_accounts: false, // CRM is source of truth
    trust_level: 'high'
  },
  
  apollo: {
    source_type: 'apollo',
    label: 'Apollo',
    description: 'Imported from Apollo',
    priority_fields: [], // Already enriched
    skip_external_if: {
      minimum_completeness: 90
    },
    require_fields: [],
    max_api_cost_per_record: 0.01,
    auto_match_accounts: true,
    trust_level: 'high'
  },
  
  pdl: {
    source_type: 'pdl',
    label: 'People Data Labs',
    description: 'Imported from PDL',
    priority_fields: [],
    skip_external_if: {
      minimum_completeness: 85
    },
    require_fields: [],
    max_api_cost_per_record: 0.01,
    auto_match_accounts: true,
    trust_level: 'high'
  },
  
  unknown: {
    source_type: 'unknown',
    label: 'Unknown',
    description: 'Source not specified',
    priority_fields: ['employee_count', 'revenue_range', 'industry_norm', 'country'],
    skip_external_if: {},
    require_fields: [],
    max_api_cost_per_record: 0.05,
    auto_match_accounts: true,
    trust_level: 'low'
  }
};

/**
 * Get enrichment rules for a specific source type
 */
export function getSourceRules(sourceType: LeadSourceType): EnrichmentSourceRule {
  return DEFAULT_SOURCE_RULES[sourceType] || DEFAULT_SOURCE_RULES.unknown;
}

/**
 * Check if external enrichment should be skipped based on current data
 */
export function shouldSkipExternalEnrichment(
  sourceType: LeadSourceType,
  currentData: {
    has_company?: boolean;
    email_verified?: boolean;
    domain_enriched?: boolean;
    completeness?: number;
  }
): { skip: boolean; reason?: string } {
  const rules = getSourceRules(sourceType);
  const conditions = rules.skip_external_if;

  if (conditions.has_company && currentData.has_company) {
    return { skip: true, reason: 'Company already identified' };
  }

  if (conditions.email_verified && currentData.email_verified) {
    return { skip: true, reason: 'Email already verified' };
  }

  if (conditions.domain_enriched && currentData.domain_enriched) {
    return { skip: true, reason: 'Domain already enriched' };
  }

  if (conditions.minimum_completeness && currentData.completeness) {
    if (currentData.completeness >= conditions.minimum_completeness) {
      return { skip: true, reason: `Data completeness already at ${currentData.completeness}%` };
    }
  }

  return { skip: false };
}

/**
 * Calculate estimated cost for enriching records from a specific source
 */
export function estimateEnrichmentCost(
  sourceType: LeadSourceType,
  recordCount: number,
  expectedSkipRate: number = 0.3 // Default 30% skip rate
): {
  estimated_cost: number;
  max_cost: number;
  records_needing_enrichment: number;
} {
  const rules = getSourceRules(sourceType);
  const recordsNeedingEnrichment = Math.ceil(recordCount * (1 - expectedSkipRate));
  
  return {
    estimated_cost: recordsNeedingEnrichment * rules.max_api_cost_per_record * 0.7, // Assume 70% actually use APIs
    max_cost: recordsNeedingEnrichment * rules.max_api_cost_per_record,
    records_needing_enrichment: recordsNeedingEnrichment
  };
}

/**
 * Get priority fields for a source type
 */
export function getPriorityFields(sourceType: LeadSourceType): string[] {
  return getSourceRules(sourceType).priority_fields;
}

/**
 * Map source type to confidence multiplier
 */
export function getSourceConfidenceMultiplier(sourceType: LeadSourceType): number {
  const rules = getSourceRules(sourceType);
  switch (rules.trust_level) {
    case 'high': return 1.0;
    case 'medium': return 0.85;
    case 'low': return 0.7;
    default: return 0.8;
  }
}
