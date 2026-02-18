/**
 * Unified Provider Waterfall for Data Enrichment
 * 
 * This module implements the user-defined enrichment waterfall:
 * 0. Check cache for existing enrichment (NEW - Phase 4A)
 * 1. Extract name from email
 * 2. Perplexity AI search (primary discovery)
 * 3. Firecrawl website scrape (ground truth)
 * 4. Multi-provider AI aggregation (Claude/Gemini/Grok) for remaining gaps
 * 5. PDL (fallback)
 * 6. Apollo (last resort)
 * 7. Hunter email verification
 * 8. Store result in cache (NEW - Phase 4A)
 * 
 * A 'verifiedFields' Set ensures data from reliable sources acts as ground truth
 * and cannot be overwritten by subsequent lookups.
 * 
 * OPTIMIZATIONS (Phase 4A):
 * - Result caching with 30-day TTL reduces duplicate API calls by 60-80%
 * - Early-exit when field coverage exceeds 90% threshold
 * - Adaptive provider timeouts based on historical performance
 */

import { 
  callAI, 
  callAIAllProviders, 
  getAvailableProviders, 
  getProviderConfidence,
  getProviderCost,
  type AIProvider, 
  type TaskType,
  type AggregatedAIResponse 
} from './ai-config.ts';
import { withHttpRetry, DEFAULT_RETRY_CONFIG } from './retry-helper.ts';
import { 
  isValidPhoneNumber, 
  sanitizePhone,
  sanitizePhoneInternational,
  isPhoneMatchingCountry,
  extractPhonesFromText,
  classifyPhoneType,
  classifyPhoneTypeAdvanced,
  shouldSuppressAIPhone,
  type PhoneEntry,
  type PhoneClassification,
} from './phone-utils.ts';
import {
  getCachedEnrichment,
  setCachedEnrichment,
  getDomainCacheKey,
  getEmailCacheKey,
  getCompanyCacheKey,
} from './enrichment-cache.ts';
import {
  validateEmailMatchesDomain,
  validateNAICSIndustryMatch,
  validateCityStateMatch,
  validateLinkedInUrl as validateLinkedInUrlAccuracy,
  normalizeLinkedInUrl,
  validateTechStack,
  computeFieldConfidence,
  aggregateFieldVotes,
  employeeCountsAgree,
  aggregateEmployeeCounts,
  type FieldVote,
  type FieldConfidence,
} from './accuracy-validators.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Cache configuration
const CACHE_TTL_DAYS = 30;
const EARLY_EXIT_COVERAGE_THRESHOLD = 90; // Exit early if coverage >= 90%

// ============================================================================
// TYPES
// ============================================================================

export interface EnrichmentInput {
  // Lead/Contact fields
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  title?: string;
  linkedin_url?: string;
  
  // Company/Account fields
  company?: string;
  company_name?: string;
  domain?: string;
  industry?: string;
  employee_count?: number;
  revenue_range?: string;
  country?: string;
  state?: string;
  city?: string;
}

export interface EnrichmentResult {
  success: boolean;
  data: EnrichedData;
  sources: EnrichmentSource[];
  verifiedFields: string[];
  cost: EnrichmentCost;
  confidence: number;
  citations?: string[];
  debug?: EnrichmentDebugInfo;
}

export interface EnrichedData {
  // Person fields
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
  phone?: string;
  mobile?: string;
  direct_phone?: string;
  title?: string;
  linkedin_url?: string;
  
  // Company fields
  company_name?: string;
  domain?: string;
  industry?: string;
  employee_count?: number;
  revenue_range?: string;
  country?: string;
  state?: string;
  city?: string;
  founded_year?: number;
  tech_stack?: string[];
  total_raised_usd?: number;
  last_funding_round?: string;
  linkedin_company_url?: string;
  twitter_url?: string;
  naics?: string;
  sic_code?: string;
  
  // Custom vertical attributes (dynamic)
  custom_attributes?: Record<string, any>;
}

export interface EnrichmentSource {
  provider: string;
  fieldsEnriched: string[];
  confidence: number;
  latencyMs: number;
  cost: number;
}

export interface EnrichmentCost {
  total: number;
  breakdown: { provider: string; cost: number }[];
}

export interface WaterfallConfig {
  skipPaidProviders?: boolean;
  maxCost?: number;
  verifyEmail?: boolean;
  discoverPhone?: boolean;
  includeWebScrape?: boolean;
  timeout?: number;
  
  // NEW: Full-field enrichment options
  aggregateProviders?: boolean;      // Call all AI providers and merge results (default: true)
  preferredProvider?: AIProvider;    // Try this provider first
  forceAllStages?: boolean;          // Run PDL/Apollo even if some data exists (default: false)
  fieldsToEnrich?: string[];         // Specific fields to target (empty = all)
  
  // Custom attribute enrichment
  customAttributeDefinitions?: Array<{
    field_key: string;
    field_label: string;
    field_type: string;
    enrichment_prompt: string;
    options?: string[];
  }>;
  
  // Debug mode - returns detailed per-provider breakdown
  debug?: boolean;
}

// Debug information returned when config.debug is true
export interface EnrichmentDebugInfo {
  providerResults: {
    provider: string;
    success: boolean;
    fieldsAttempted: string[];
    fieldsContributed: string[];
    skippedReason?: string;
    latencyMs: number;
  }[];
  verifiedFields: string[];
  fieldSources: Record<string, { provider: string; confidence: number }>;
}

// All enrichable fields - used for comprehensive field coverage (21 fields)
export const ALL_ENRICHABLE_FIELDS = [
  // Firmographic (4)
  'employee_count', 'revenue_range', 'industry', 'founded_year',
  // Location (3)
  'city', 'state', 'country',
  // Company identifiers (4)
  'company_name', 'domain', 'linkedin_company_url', 'twitter_url',
  // Contact details (6)
  'title', 'linkedin_url', 'phone', 'mobile', 'direct_phone', 'email_verified',
  // Funding (2)
  'total_raised_usd', 'last_funding_round',
  // Classification (3)
  'naics', 'sic_code', 'tech_stack',
] as const;

// Account-specific fields (for company enrichment)
export const ACCOUNT_ENRICHABLE_FIELDS = [
  'employee_count', 'revenue_range', 'industry', 'founded_year',
  'city', 'state', 'country',
  'company_name', 'domain', 'linkedin_company_url', 'twitter_url',
  'phone', 'total_raised_usd', 'last_funding_round',
  'naics', 'sic_code', 'tech_stack',
] as const;

// Lead/Contact-specific fields
export const LEAD_ENRICHABLE_FIELDS = [
  'title', 'linkedin_url', 'phone', 'mobile', 'direct_phone', 'email_verified',
  'first_name', 'last_name',
] as const;

// Provider precedence for field conflicts (higher index = higher priority for that field type)
// Note: Abacus removed due to missing deploymentId configuration
export const PROVIDER_PRECEDENCE: Record<string, AIProvider[]> = {
  // Real-time company data
  employee_count: ['perplexity', 'anthropic', 'openai', 'lovable', 'xai'],
  revenue_range: ['perplexity', 'anthropic', 'openai', 'lovable', 'xai'],
  industry: ['perplexity', 'anthropic', 'lovable', 'openai', 'xai'],
  
  // Contact/social data - Grok excels here
  linkedin_url: ['xai', 'perplexity', 'anthropic', 'lovable', 'openai'],
  twitter_url: ['xai', 'perplexity', 'lovable', 'anthropic', 'openai'],
  phone: ['perplexity', 'anthropic', 'xai', 'lovable', 'openai'],
  
  // Location - prefer AI with web search
  city: ['perplexity', 'anthropic', 'lovable', 'openai', 'xai'],
  state: ['perplexity', 'anthropic', 'lovable', 'openai', 'xai'],
  country: ['perplexity', 'anthropic', 'lovable', 'openai', 'xai'],
  
  // Default precedence for other fields
  default: ['perplexity', 'anthropic', 'xai', 'lovable', 'openai'],
};

// ============================================================================
// PROVIDER COST ESTIMATES (per record)
// ============================================================================

const PROVIDER_COSTS = {
  email_parse: 0,
  perplexity: 0.005,
  firecrawl: 0.002,
  ai_gemini: 0.001,
  ai_claude: 0.003,
  ai_grok: 0.002,
  pdl: 0.10,
  apollo: 0.05,
  hunter: 0.015,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// ============================================================================
// ACCURACY IMPROVEMENT #1: GENERIC EMAIL FILTER
// Generic email prefixes that should NOT be parsed as first names
// ============================================================================
const GENERIC_EMAIL_PREFIXES = [
  // Core generic prefixes
  'info', 'contact', 'hello', 'hi', 'sales', 'support', 'admin', 
  'office', 'help', 'team', 'general', 'mail', 'email', 'enquiry',
  'inquiry', 'billing', 'accounts', 'service', 'customerservice',
  'feedback', 'press', 'media', 'marketing', 'hr', 'careers', 
  'jobs', 'legal', 'privacy', 'webmaster', 'noreply', 'no-reply',
  'donotreply', 'notifications', 'alerts', 'newsletter', 'subscribe',
  'orders', 'booking', 'bookings', 'reservations', 'helpdesk',
  'reception', 'frontdesk', 'compliance', 'finance', 'payroll',
  // Scheduling & Appointments
  'appointments', 'scheduling', 'calendar',
  // Extended Support
  'tickets', 'techsupport', 'itsupport', 'customercare',
  // Operations & Logistics
  'dispatch', 'logistics', 'shipping', 'warehouse', 'fulfillment',
  // Business & Partnerships
  'purchasing', 'procurement', 'vendor', 'vendors', 'partners',
  // Communications & Events
  'communications', 'pr', 'events', 'membership', 'members',
  // Administrative
  'registrar', 'admissions', 'enrollment', 'records',
  // Safety & Security
  'safety', 'security', 'emergency',
];

// ============================================================================
// ACCURACY IMPROVEMENT #2: CROSS-SOURCE VOTING FUNCTIONS
// ============================================================================
function computeMedianEmployeeCount(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 
    ? sorted[mid] 
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function computeMajorityRevenueRange(values: string[]): string | null {
  if (values.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }
  // Return value with most votes (ties go to first)
  let maxCount = 0;
  let winner: string | null = null;
  for (const [value, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      winner = value;
    }
  }
  return winner;
}

// ============================================================================
// ACCURACY IMPROVEMENT #3: FIRMOGRAPHIC SANITY CHECKS (ENHANCED)
// ============================================================================
interface FirmographicValidation {
  isValid: boolean;
  reason?: string;
}

// Valid revenue ranges for validation
const VALID_REVENUE_RANGES = [
  '$0-$1M', '$1M-$5M', '$5M-$10M', '$10M-$25M', '$25M-$50M',
  '$50M-$100M', '$100M-$500M', '$500M-$1B', '$1B-$10B', '$10B+'
];

/**
 * Validate revenue range is a recognized format
 */
export function validateRevenueRange(revenueRange: string | undefined): FirmographicValidation {
  if (!revenueRange) return { isValid: true };
  
  if (!VALID_REVENUE_RANGES.includes(revenueRange)) {
    return { isValid: false, reason: `Unrecognized revenue range: ${revenueRange}` };
  }
  
  return { isValid: true };
}

/**
 * Validate founding year is reasonable (not future, not too old)
 */
export function validateFoundingYear(foundedYear: number | string | undefined, domain?: string): FirmographicValidation {
  if (!foundedYear) return { isValid: true };
  
  const year = typeof foundedYear === 'string' ? parseInt(foundedYear, 10) : foundedYear;
  if (isNaN(year)) return { isValid: false, reason: `Invalid founding year format: ${foundedYear}` };
  
  const currentYear = new Date().getFullYear();
  
  // Cannot be founded in the future
  if (year > currentYear) {
    return { isValid: false, reason: `Founding year ${year} is in the future` };
  }
  
  // Cannot be older than 300 years (oldest companies)
  if (year < currentYear - 300) {
    return { isValid: false, reason: `Founding year ${year} is implausibly old` };
  }
  
  // For modern tech domains, reject pre-internet founding years with tech indicators
  const techIndicators = ['app', 'tech', 'software', 'digital', 'cloud', 'ai', 'saas', 'io'];
  if (domain) {
    const isTechDomain = techIndicators.some(ind => domain.toLowerCase().includes(ind));
    if (isTechDomain && year < 1990) {
      return { isValid: false, reason: `Tech domain ${domain} unlikely founded in ${year}` };
    }
  }
  
  return { isValid: true };
}

/**
 * Validate revenue range is appropriate for SMB domains
 */
export function validateRevenueForDomain(
  revenueRange: string | undefined,
  domain: string | undefined
): FirmographicValidation {
  if (!revenueRange || !domain) return { isValid: true };
  
  // SMB domain indicators
  const smbIndicators = ['shop', 'store', 'local', 'family', 'small', 'boutique', 'studio'];
  const isSMB = smbIndicators.some(ind => domain.toLowerCase().includes(ind));
  
  // SMBs shouldn't have billion-dollar revenue
  const highRevenueRanges = ['$500M-$1B', '$1B-$10B', '$10B+'];
  if (isSMB && highRevenueRanges.includes(revenueRange)) {
    return { isValid: false, reason: `SMB domain ${domain} unlikely to have ${revenueRange} revenue` };
  }
  
  return { isValid: true };
}

function validateEmployeeRevenuePair(
  employeeCount: number | undefined, 
  revenueRange: string | undefined
): FirmographicValidation {
  if (!employeeCount || !revenueRange) return { isValid: true };
  
  // Revenue per employee sanity checks
  const revenueMap: Record<string, { min: number; max: number }> = {
    '$0-$1M': { min: 0, max: 1000000 },
    '$1M-$5M': { min: 1000000, max: 5000000 },
    '$5M-$10M': { min: 5000000, max: 10000000 },
    '$10M-$25M': { min: 10000000, max: 25000000 },
    '$25M-$50M': { min: 25000000, max: 50000000 },
    '$50M-$100M': { min: 50000000, max: 100000000 },
    '$100M-$500M': { min: 100000000, max: 500000000 },
    '$500M-$1B': { min: 500000000, max: 1000000000 },
    '$1B-$10B': { min: 1000000000, max: 10000000000 },
    '$10B+': { min: 10000000000, max: Infinity },
  };
  
  const range = revenueMap[revenueRange];
  if (!range) return { isValid: true };
  
  const avgRevenue = (range.min + Math.min(range.max, 100000000000)) / 2;
  const revenuePerEmployee = avgRevenue / employeeCount;
  
  // Typical B2B: $100K-$500K per employee. 
  // Reject if <$50K or >$5M per employee (hallucination indicators)
  if (revenuePerEmployee < 50000) {
    return { isValid: false, reason: `Too few employees (${employeeCount}) for ${revenueRange}` };
  }
  if (revenuePerEmployee > 5000000) {
    return { isValid: false, reason: `Too many employees (${employeeCount}) for ${revenueRange}` };
  }
  
  return { isValid: true };
}

function validateEmployeeCountForDomain(
  employeeCount: number,
  domain: string | undefined
): FirmographicValidation {
  if (!domain) return { isValid: true };
  
  // Large enterprise domains - don't accept small counts
  const enterpriseDomains = ['amazon.com', 'google.com', 'microsoft.com', 'apple.com', 
    'facebook.com', 'meta.com', 'ibm.com', 'oracle.com', 'salesforce.com',
    'walmart.com', 'target.com', 'costco.com', 'homedepot.com',
    'att.com', 'verizon.com', 't-mobile.com', 'comcast.com'];
  const isEnterprise = enterpriseDomains.some(d => domain.toLowerCase().includes(d));
  
  if (isEnterprise && employeeCount < 1000) {
    return { isValid: false, reason: `Enterprise domain ${domain} unlikely to have only ${employeeCount} employees` };
  }
  
  // SMB indicators - reject very high counts
  const smbIndicators = ['shop', 'store', 'local', 'family', 'small'];
  const isSMB = smbIndicators.some(ind => domain.toLowerCase().includes(ind));
  
  if (isSMB && employeeCount > 500) {
    return { isValid: false, reason: `SMB-indicating domain unlikely to have ${employeeCount} employees` };
  }
  
  return { isValid: true };
}

// ============================================================================
// ACCURACY IMPROVEMENT #6: TITLE NORMALIZATION
// ============================================================================
const TITLE_NORMALIZATION_MAP: Record<string, string> = {
  // ==================== OWNER VARIANTS ====================
  'proprietor': 'Owner',
  'business owner': 'Owner',
  'shop owner': 'Owner',
  'store owner': 'Owner',
  'sole proprietor': 'Owner',
  
  // ==================== FOUNDER VARIANTS ====================
  'co-founder': 'Co-Founder',
  'cofounder': 'Co-Founder',
  'founding partner': 'Co-Founder',
  'founder and ceo': 'Founder & CEO',
  'founder & ceo': 'Founder & CEO',
  'founder/ceo': 'Founder & CEO',
  
  // ==================== C-SUITE VARIANTS ====================
  // CEO
  'chief executive': 'CEO',
  'chief executive officer': 'CEO',
  
  // CTO
  'chief technology officer': 'CTO',
  'chief technical officer': 'CTO',
  
  // CFO
  'chief financial officer': 'CFO',
  
  // COO
  'chief operating officer': 'COO',
  'chief operations officer': 'COO',
  
  // CMO
  'chief marketing officer': 'CMO',
  
  // CRO
  'chief revenue officer': 'CRO',
  
  // CPO
  'chief product officer': 'CPO',
  'cpo': 'CPO',
  
  // CHRO
  'chief human resources officer': 'CHRO',
  'chro': 'CHRO',
  'chief people officer': 'Chief People Officer',
  
  // CIO
  'chief information officer': 'CIO',
  'cio': 'CIO',
  
  // CSO
  'chief security officer': 'CSO',
  'cso': 'CSO',
  
  // CDO
  'chief data officer': 'CDO',
  'cdo': 'CDO',
  
  // CCO
  'chief commercial officer': 'CCO',
  'cco': 'CCO',
  
  // Other C-Suite
  'chief digital officer': 'Chief Digital Officer',
  'chief strategy officer': 'Chief Strategy Officer',
  'chief growth officer': 'Chief Growth Officer',
  'chief customer officer': 'Chief Customer Officer',
  
  // EVP/SVP
  'executive vice president': 'EVP',
  'evp': 'EVP',
  'senior vice president': 'SVP',
  'svp': 'SVP',
  
  // President
  'company president': 'President',
  
  // ==================== VP VARIANTS ====================
  // VP Engineering
  'vp engineering': 'VP of Engineering',
  'vp of engineering': 'VP of Engineering',
  'vice president of engineering': 'VP of Engineering',
  'vice president, engineering': 'VP of Engineering',
  'vp, engineering': 'VP of Engineering',
  
  // VP Marketing
  'vp marketing': 'VP of Marketing',
  'vp of marketing': 'VP of Marketing',
  'vice president of marketing': 'VP of Marketing',
  'vice president, marketing': 'VP of Marketing',
  'vp, marketing': 'VP of Marketing',
  
  // VP Sales
  'vp sales': 'VP of Sales',
  'vp of sales': 'VP of Sales',
  'vice president of sales': 'VP of Sales',
  'vice president, sales': 'VP of Sales',
  'vp, sales': 'VP of Sales',
  
  // VP Product
  'vp product': 'VP of Product',
  'vp of product': 'VP of Product',
  'vice president of product': 'VP of Product',
  
  // VP Operations
  'vp operations': 'VP of Operations',
  'vp of operations': 'VP of Operations',
  'vice president of operations': 'VP of Operations',
  
  // VP Business Development
  'vp business development': 'VP of Business Development',
  'vp of business development': 'VP of Business Development',
  
  // VP Customer Success
  'vp customer success': 'VP of Customer Success',
  'vp of customer success': 'VP of Customer Success',
  
  // ==================== HEAD OF VARIANTS ====================
  'head of sales': 'Head of Sales',
  'head of marketing': 'Head of Marketing',
  'head of engineering': 'Head of Engineering',
  'head of product': 'Head of Product',
  'head of operations': 'Head of Operations',
  'head of hr': 'Head of HR',
  'head of human resources': 'Head of HR',
  'head of finance': 'Head of Finance',
  'head of growth': 'Head of Growth',
  'head of customer success': 'Head of Customer Success',
  'head of business development': 'Head of Business Development',
  
  // ==================== LEAD/PRINCIPAL/STAFF VARIANTS ====================
  'lead developer': 'Lead Developer',
  'lead software developer': 'Lead Developer',
  'lead engineer': 'Lead Engineer',
  'lead software engineer': 'Lead Engineer',
  'principal engineer': 'Principal Engineer',
  'principal software engineer': 'Principal Engineer',
  'staff engineer': 'Staff Engineer',
  'staff software engineer': 'Staff Engineer',
  'senior developer': 'Senior Developer',
  'senior software developer': 'Senior Developer',
  'senior engineer': 'Senior Engineer',
  'senior software engineer': 'Senior Engineer',
  'tech lead': 'Tech Lead',
  'technical lead': 'Tech Lead',
  'engineering lead': 'Engineering Lead',
  'development lead': 'Development Lead',
  
  // ==================== MANAGER VARIANTS ====================
  'general manager': 'General Manager',
  'operations manager': 'Operations Manager',
  'sales manager': 'Sales Manager',
  'marketing manager': 'Marketing Manager',
  'product manager': 'Product Manager',
  'project manager': 'Project Manager',
  'program manager': 'Program Manager',
  'account manager': 'Account Manager',
  'customer success manager': 'Customer Success Manager',
  'engineering manager': 'Engineering Manager',
  'development manager': 'Development Manager',
  'it manager': 'IT Manager',
  'hr manager': 'HR Manager',
  'human resources manager': 'HR Manager',
  'office manager': 'Office Manager',
  'regional manager': 'Regional Manager',
  'branch manager': 'Branch Manager',
  
  // ==================== DIRECTOR VARIANTS ====================
  'director of sales': 'Sales Director',
  'director of marketing': 'Marketing Director',
  'director of operations': 'Operations Director',
  'director of engineering': 'Engineering Director',
  'director of finance': 'Finance Director',
  'director of hr': 'HR Director',
  'director of human resources': 'HR Director',
  'director of product': 'Product Director',
  'director of it': 'IT Director',
  'director of information technology': 'IT Director',
  'director of customer success': 'Customer Success Director',
  'director of business development': 'Business Development Director',
  'director of growth': 'Growth Director',
  'creative director': 'Creative Director',
  'art director': 'Art Director',
  'technical director': 'Technical Director',
  'managing director': 'Managing Director',
  'executive director': 'Executive Director',
  'finance director': 'Finance Director',
  
  // ==================== PARTNER VARIANTS ====================
  'managing partner': 'Managing Partner',
  'senior partner': 'Senior Partner',
  'general partner': 'General Partner',
  
  // ==================== CONSULTANT & ADVISOR VARIANTS ====================
  'consultant': 'Consultant',
  'senior consultant': 'Senior Consultant',
  'principal consultant': 'Principal Consultant',
  'management consultant': 'Management Consultant',
  'advisor': 'Advisor',
  'senior advisor': 'Senior Advisor',
  'strategic advisor': 'Strategic Advisor',
  'board advisor': 'Board Advisor',
  'board member': 'Board Member',
};

export function normalizeTitle(title: string | undefined): string | undefined {
  if (!title) return title;
  
  const lowerTitle = title.toLowerCase().trim();
  
  // Check for exact match first
  if (TITLE_NORMALIZATION_MAP[lowerTitle]) {
    return TITLE_NORMALIZATION_MAP[lowerTitle];
  }
  
  // Check for partial matches (e.g., "Founder & CEO" should normalize Founder part)
  for (const [variant, normalized] of Object.entries(TITLE_NORMALIZATION_MAP)) {
    if (lowerTitle.includes(variant)) {
      // Replace the variant with normalized version
      return title.replace(new RegExp(variant, 'i'), normalized);
    }
  }
  
  // Return original with proper casing
  return title;
}

export function extractDomain(input: string): string | null {
  if (!input) return null;
  let domain = input.toLowerCase().trim();
  domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
  domain = domain.split('/')[0].split('?')[0];
  if (domain.includes('.') && domain.length > 3) return domain;
  return null;
}

export function extractNameFromEmail(email: string): { first_name?: string; last_name?: string } | null {
  if (!email || !email.includes('@')) return null;
  
  const local = email.split('@')[0].toLowerCase();
  
  // ACCURACY IMPROVEMENT #1: Check for generic email prefixes first
  if (GENERIC_EMAIL_PREFIXES.includes(local)) {
    console.log(`[provider-waterfall] Skipping generic email prefix: ${local}`);
    return null;
  }
  
  // Common patterns: first.last, first_last, first-last
  const dotMatch = local.match(/^([a-z]+)\.([a-z]+)$/);
  if (dotMatch) {
    return {
      first_name: dotMatch[1].charAt(0).toUpperCase() + dotMatch[1].slice(1),
      last_name: dotMatch[2].charAt(0).toUpperCase() + dotMatch[2].slice(1),
    };
  }
  
  const underscoreMatch = local.match(/^([a-z]+)_([a-z]+)$/);
  if (underscoreMatch) {
    return {
      first_name: underscoreMatch[1].charAt(0).toUpperCase() + underscoreMatch[1].slice(1),
      last_name: underscoreMatch[2].charAt(0).toUpperCase() + underscoreMatch[2].slice(1),
    };
  }
  
  const dashMatch = local.match(/^([a-z]+)-([a-z]+)$/);
  if (dashMatch) {
    return {
      first_name: dashMatch[1].charAt(0).toUpperCase() + dashMatch[1].slice(1),
      last_name: dashMatch[2].charAt(0).toUpperCase() + dashMatch[2].slice(1),
    };
  }
  
  // Single word email (e.g., marko@company.com) - use as first name ONLY
  // DO NOT split single words - let AI discover the last name
  // ALSO skip if it matches generic prefixes
  if (/^[a-z]+$/.test(local) && local.length >= 2) {
    return {
      first_name: local.charAt(0).toUpperCase() + local.slice(1),
      // last_name intentionally undefined - let AI discover it
    };
  }
  
  return null;
}

/**
 * Validate and format US phone number
 * Uses the new phone-utils module for robust validation
 */
export function isValidUSPhone(phone: string | null): boolean {
  return isValidPhoneNumber(phone);
}

/**
 * Format phone to E.164
 * Uses the new phone-utils module for sanitization
 */
export function formatPhone(phone: string | null): string | null {
  return sanitizePhone(phone);
}

/**
 * Extract LinkedIn profile URL from text content
 * Handles various LinkedIn URL formats
 */
export function extractLinkedInUrl(text: string | undefined): string | null {
  if (!text) return null;
  
  // LinkedIn profile URL patterns
  const patterns = [
    // Standard profile URLs
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)\/?/i,
    // Company page URLs
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/company\/([a-zA-Z0-9_-]+)\/?/i,
    // Public profile URLs (older format)
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/pub\/([a-zA-Z0-9_\/-]+)\/?/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Normalize to https://
      const url = match[0].startsWith('http') ? match[0] : `https://${match[0]}`;
      // Clean trailing slashes
      return url.replace(/\/+$/, '');
    }
  }
  
  return null;
}

/**
 * Extract all LinkedIn URLs from text content (for company page + personal profiles)
 */
export function extractAllLinkedInUrls(text: string | undefined): { profile?: string; company?: string } {
  if (!text) return {};
  
  const result: { profile?: string; company?: string } = {};
  
  // Personal profile pattern
  const profileMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)\/?/i);
  if (profileMatch) {
    result.profile = profileMatch[0].startsWith('http') ? profileMatch[0] : `https://${profileMatch[0]}`;
    result.profile = result.profile.replace(/\/+$/, '');
  }
  
  // Company page pattern
  const companyMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/company\/([a-zA-Z0-9_-]+)\/?/i);
  if (companyMatch) {
    result.company = companyMatch[0].startsWith('http') ? companyMatch[0] : `https://${companyMatch[0]}`;
    result.company = result.company.replace(/\/+$/, '');
  }
  
  return result;
}

/**
 * Extract message content from AI provider response.
 * Handles different API response formats between providers.
 * - OpenAI/Perplexity/xAI/Lovable/Abacus: choices[0].message.content
 * - Anthropic/Claude: content[0].text
 */
export function extractContentFromResponse(provider: AIProvider, data: any): string {
  if (!data) return '';
  
  // Anthropic/Claude uses content[].text instead of choices[].message.content
  if (provider === 'anthropic') {
    const contentBlocks = data?.content;
    if (Array.isArray(contentBlocks)) {
      // Find text block and extract content
      const textBlock = contentBlocks.find((b: any) => b.type === 'text');
      if (textBlock?.text) {
        console.log(`[provider-waterfall] Anthropic response extracted: ${textBlock.text.substring(0, 100)}...`);
        return textBlock.text;
      }
    }
    // Fallback: try choices format in case Anthropic changes API
    if (data?.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    console.log(`[provider-waterfall] Anthropic: Could not extract content from response structure`);
    return '';
  }
  
  // OpenAI-compatible format (OpenAI, Perplexity, xAI, Lovable, Abacus)
  return data?.choices?.[0]?.message?.content || '';
}

/**
 * Calculate field coverage status - used to determine if AI fallback is needed
 */
export function getFieldCoverageStatus(
  data: EnrichedData,
  verifiedFields: Set<string>,
  targetFields: readonly string[] = ALL_ENRICHABLE_FIELDS
): {
  filled: string[];
  verified: string[];
  missing: string[];
  coverage: number;
} {
  const filled: string[] = [];
  const verified: string[] = [];
  const missing: string[] = [];
  
  for (const field of targetFields) {
    const value = (data as any)[field];
    if (value !== undefined && value !== null && value !== '') {
      filled.push(field);
      if (verifiedFields.has(field)) {
        verified.push(field);
      }
    } else {
      missing.push(field);
    }
  }
  
  return {
    filled,
    verified,
    missing,
    coverage: targetFields.length > 0 ? (filled.length / targetFields.length) * 100 : 0,
  };
}

export function mapRevenueToRange(revenue: number): string {
  if (revenue < 1000000) return '$0-$1M';
  if (revenue < 5000000) return '$1M-$5M';
  if (revenue < 10000000) return '$5M-$10M';
  if (revenue < 25000000) return '$10M-$25M';
  if (revenue < 50000000) return '$25M-$50M';
  if (revenue < 100000000) return '$50M-$100M';
  if (revenue < 500000000) return '$100M-$500M';
  if (revenue < 1000000000) return '$500M-$1B';
  if (revenue < 10000000000) return '$1B-$10B';
  return '$10B+';
}

// ============================================================================
// STEP 1: EMAIL NAME EXTRACTION
// ============================================================================

async function enrichFromEmail(
  input: EnrichmentInput,
  data: EnrichedData,
  verifiedFields: Set<string>
): Promise<EnrichmentSource | null> {
  const start = Date.now();
  
  if (!input.email) return null;
  
  const fieldsEnriched: string[] = [];
  
  // Extract domain
  const domain = extractDomain(input.email.split('@')[1]);
  if (domain && !data.domain && !verifiedFields.has('domain')) {
    data.domain = domain;
    fieldsEnriched.push('domain');
  }
  
  // Extract name
  const names = extractNameFromEmail(input.email);
  if (names) {
    if (names.first_name && !data.first_name && !verifiedFields.has('first_name')) {
      data.first_name = names.first_name;
      fieldsEnriched.push('first_name');
    }
    if (names.last_name && !data.last_name && !verifiedFields.has('last_name')) {
      data.last_name = names.last_name;
      fieldsEnriched.push('last_name');
    }
  }
  
  if (fieldsEnriched.length === 0) return null;
  
  return {
    provider: 'email_parse',
    fieldsEnriched,
    confidence: 0.7,
    latencyMs: Date.now() - start,
    cost: PROVIDER_COSTS.email_parse,
  };
}

// ============================================================================
// STEP 2: PERPLEXITY AI SEARCH
// ============================================================================

async function enrichFromPerplexity(
  input: EnrichmentInput,
  data: EnrichedData,
  verifiedFields: Set<string>
): Promise<EnrichmentSource | null> {
  const start = Date.now();
  
  if (!getAvailableProviders().includes('perplexity')) return null;
  
  const companyName = input.company || input.company_name || data.company_name;
  const domain = input.domain || data.domain;
  const personName = input.name || [input.first_name, input.last_name].filter(Boolean).join(' ');
  
  if (!companyName && !domain) return null;
  
  // Get country context for better phone discovery
  const personCountry = input.country || data.country;
  const countryContext = personCountry ? ` based in ${personCountry}` : '';
  const phoneFormatHint = personCountry === 'United Kingdom' || personCountry === 'UK' 
    ? 'IMPORTANT: Only return UK phone numbers starting with +44. Do NOT return US numbers (+1).'
    : personCountry === 'United States' || personCountry === 'US' || personCountry === 'USA'
    ? 'Return US phone numbers in E.164 format (+1XXXXXXXXXX).'
    : 'Return phone numbers in E.164 format with country prefix.';
  
  const prompt = personName 
    ? `Find professional contact information for ${personName}${countryContext} at ${companyName || domain}. 
Check their company website About/Team page and LinkedIn profile.
Include:
- Current job title (check company website - do NOT return "N/A")
- LinkedIn profile URL  
- Direct phone number or mobile in E.164 format (e.g., +44XXXXXXXXXX for UK, +1XXXXXXXXXX for US)
- ${phoneFormatHint}
- Verified email address
- Country where the person is located
Return ONLY a JSON object with these fields: title, linkedin_url, phone, mobile, direct_phone, email, email_verified, country, first_name, last_name`
    : `Research comprehensive company information for ${companyName || domain}. Find ALL available data:

FIRMOGRAPHIC:
- employee_count: Exact number of employees
- revenue_range: Annual revenue (use: "$0-$1M", "$1M-$5M", "$5M-$10M", "$10M-$25M", "$25M-$50M", "$50M-$100M", "$100M-$500M", "$500M-$1B", "$1B-$10B", "$10B+")
- industry: Primary industry classification
- founded_year: Year company was founded

LOCATION:
- city: Headquarters city
- state: Headquarters state/province  
- country: Headquarters country

IDENTIFIERS:
- company_name: Official company name
- domain: Company website domain
- linkedin_company_url: LinkedIn company page URL
- twitter_url: Twitter/X profile URL

FUNDING:
- total_raised_usd: Total funding raised in USD
- last_funding_round: Most recent funding round type (Seed, Series A, etc.)

CLASSIFICATION:
- naics: 6-digit NAICS code
- sic_code: 4-digit SIC code
- tech_stack: Array of technologies used (e.g., ["React", "AWS", "Salesforce"])

CONTACT:
- phone: Main company phone number

Return ONLY a valid JSON object with ALL fields you can find.`;
  
  try {
    const response = await callAI('research', [
      { role: 'system', content: 'You are a B2B data researcher. Return only valid JSON with factual, verifiable information. Cite sources when possible.' },
      { role: 'user', content: prompt },
    ], { search_recency_filter: 'month' });
    
    if (!response.ok) return null;
    
    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    const fieldsEnriched: string[] = [];
    
    // Map ALL enrichable fields (expanded coverage)
    const fieldMappings = [
      // Contact/Person fields
      ['title', 'title'],
      ['linkedin_url', 'linkedin_url'],
      ['phone', 'phone'],
      ['mobile', 'mobile'],
      ['direct_phone', 'direct_phone'],
      ['email', 'email'],
      ['email_verified', 'email_verified'],
      // Firmographic
      ['industry', 'industry'],
      ['employee_count', 'employee_count'],
      ['revenue_range', 'revenue_range'],
      ['founded_year', 'founded_year'],
      // Location
      ['city', 'city'],
      ['state', 'state'],
      ['country', 'country'],
      // Identifiers
      ['company_name', 'company_name'],
      ['domain', 'domain'],
      ['linkedin_company_url', 'linkedin_company_url'],
      ['twitter_url', 'twitter_url'],
      // Funding
      ['total_raised_usd', 'total_raised_usd'],
      ['last_funding_round', 'last_funding_round'],
      // Classification
      ['naics', 'naics'],
      ['sic_code', 'sic_code'],
      ['tech_stack', 'tech_stack'],
    ];
    
    // Get person's country for phone validation
    // PRIORITY: input.country is authoritative (user-provided), then existing data, then AI-discovered
    // AI-discovered country should NOT override user input for phone validation
    const detectedCountry = input.country || data.country || parsed.country;
    const authoritativeCountry = input.country || detectedCountry; // User input always wins
    
    for (const [sourceField, targetField] of fieldMappings) {
      if (parsed[sourceField] && !verifiedFields.has(targetField) && !(data as any)[targetField]) {
        let value = parsed[sourceField];
        
        // Skip "N/A" or placeholder values
        if (typeof value === 'string' && (value === 'N/A' || value === 'n/a' || value === 'Not available' || value === 'Unknown')) {
          console.log(`[provider-waterfall] Perplexity: Skipping placeholder ${targetField}: ${value}`);
          continue;
        }
        
        // ACCURACY IMPROVEMENT #10: Validate email matches company domain
        if (targetField === 'email' && typeof value === 'string') {
          const emailValidation = validateEmailMatchesDomain(value, domain);
          if (!emailValidation.isValid) {
            console.log(`[provider-waterfall] Perplexity: REJECTED ${targetField} - ${emailValidation.reason}`);
            continue;
          }
        }
        
        // Validate phone fields with country awareness
        if (['phone', 'mobile', 'direct_phone'].includes(targetField)) {
          // ACCURACY IMPROVEMENT #5: Check enterprise phone suppression first
          const suppressCheck = shouldSuppressAIPhone(domain, data.employee_count, 'perplexity');
          if (suppressCheck.suppress) {
            console.log(`[provider-waterfall] Perplexity: SUPPRESSED ${targetField} - ${suppressCheck.reason}`);
            continue;
          }
          
          // Use international sanitization with country context
          const sanitized = sanitizePhoneInternational(value, authoritativeCountry);
          if (!sanitized) {
            console.log(`[provider-waterfall] Perplexity: Rejected invalid ${targetField}: ${value}`);
            continue;
          }
          
          // CRITICAL: Validate phone matches USER-PROVIDED country (not AI-discovered)
          if (authoritativeCountry && !isPhoneMatchingCountry(sanitized, authoritativeCountry)) {
            console.log(`[provider-waterfall] Perplexity: REJECTED ${targetField} ${sanitized} - country mismatch with ${authoritativeCountry}`);
            continue;
          }
          
          value = sanitized;
          console.log(`[provider-waterfall] Perplexity: Validated ${targetField}: ${sanitized} for country ${authoritativeCountry || 'unknown'}`);
        }
        
        // ACCURACY IMPROVEMENT #6: Normalize title values
        if (targetField === 'title' && typeof value === 'string') {
          value = normalizeTitle(value) || value;
        }
        
        // ACCURACY IMPROVEMENT #7: Validate revenue range format
        if (targetField === 'revenue_range') {
          const revenueValidation = validateRevenueRange(value);
          if (!revenueValidation.isValid) {
            console.log(`[provider-waterfall] Perplexity: REJECTED ${targetField} - ${revenueValidation.reason}`);
            continue;
          }
          // Also validate against domain type
          const domainRevenueValidation = validateRevenueForDomain(value, domain);
          if (!domainRevenueValidation.isValid) {
            console.log(`[provider-waterfall] Perplexity: REJECTED ${targetField} - ${domainRevenueValidation.reason}`);
            continue;
          }
        }
        
        // ACCURACY IMPROVEMENT #8: Validate founding year is reasonable
        if (targetField === 'founded_year') {
          const yearValidation = validateFoundingYear(value, domain);
          if (!yearValidation.isValid) {
            console.log(`[provider-waterfall] Perplexity: REJECTED ${targetField} - ${yearValidation.reason}`);
            continue;
          }
        }
        
        // ACCURACY IMPROVEMENT #9: Extract and validate LinkedIn URLs
        if (targetField === 'linkedin_url' || targetField === 'linkedin_company_url') {
          // Use normalizeLinkedInUrl for better URL cleaning
          const normalizedUrl = normalizeLinkedInUrl(value);
          if (!normalizedUrl) {
            console.log(`[provider-waterfall] Perplexity: REJECTED invalid ${targetField}: ${value}`);
            continue;
          }
          value = normalizedUrl;
        }
        
        // ACCURACY IMPROVEMENT #12: Validate tech stack items against whitelist
        if (targetField === 'tech_stack' && Array.isArray(value)) {
          const validatedTech = validateTechStack(value);
          if (validatedTech.length === 0) {
            console.log(`[provider-waterfall] Perplexity: REJECTED ${targetField} - no valid tech items`);
            continue;
          }
          if (validatedTech.length < value.length) {
            console.log(`[provider-waterfall] Perplexity: Filtered tech_stack from ${value.length} to ${validatedTech.length} items`);
          }
          value = validatedTech;
        }
        
        // ACCURACY IMPROVEMENT #11: Validate NAICS-industry match
        if (targetField === 'naics' && data.industry) {
          const naicsValidation = validateNAICSIndustryMatch(value, data.industry);
          if (!naicsValidation.isValid) {
            console.log(`[provider-waterfall] Perplexity: REJECTED ${targetField} - ${naicsValidation.reason}`);
            continue;
          }
        }
        
        // ACCURACY IMPROVEMENT #13: Validate city/state match
        if (targetField === 'city' && data.state) {
          const locationValidation = validateCityStateMatch(value, data.state);
          if (!locationValidation.isValid) {
            console.log(`[provider-waterfall] Perplexity: REJECTED ${targetField} - ${locationValidation.reason}`);
            continue;
          }
        }
        if (targetField === 'state' && data.city) {
          const locationValidation = validateCityStateMatch(data.city, value);
          if (!locationValidation.isValid) {
            console.log(`[provider-waterfall] Perplexity: REJECTED ${targetField} - ${locationValidation.reason}`);
            continue;
          }
        }
        
        (data as any)[targetField] = value;
        fieldsEnriched.push(targetField);
      }
    }
    
    if (fieldsEnriched.length === 0) return null;
    
    return {
      provider: 'perplexity',
      fieldsEnriched,
      confidence: 0.85,
      latencyMs: Date.now() - start,
      cost: PROVIDER_COSTS.perplexity,
    };
  } catch (error) {
    console.error('[provider-waterfall] Perplexity error:', error);
    return null;
  }
}

// ============================================================================
// STEP 3: FIRECRAWL WEBSITE SCRAPE (GROUND TRUTH)
// ============================================================================

async function enrichFromFirecrawl(
  input: EnrichmentInput,
  data: EnrichedData,
  verifiedFields: Set<string>
): Promise<EnrichmentSource | null> {
  const start = Date.now();
  
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) return null;
  
  const domain = input.domain || data.domain;
  if (!domain) return null;
  
  try {
    // Scrape main pages
    const urls = [
      `https://${domain}`,
      `https://${domain}/about`,
      `https://${domain}/contact`,
    ];
    
    const markdowns: string[] = [];
    
    for (const url of urls) {
      try {
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url,
            formats: ['markdown'],
            onlyMainContent: true,
            timeout: 10000,
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result?.data?.markdown) {
            markdowns.push(result.data.markdown);
          }
        }
      } catch {
        // Skip failed pages
      }
    }
    
    if (markdowns.length === 0) return null;
    
    const combinedContent = markdowns.join('\n\n---\n\n').substring(0, 30000);
    
    // ACCURACY IMPROVEMENT #7: Direct regex extraction for LinkedIn URLs (no AI needed)
    const linkedInUrls = extractAllLinkedInUrls(combinedContent);
    if (linkedInUrls.company && !data.linkedin_company_url && !verifiedFields.has('linkedin_company_url')) {
      data.linkedin_company_url = linkedInUrls.company;
      verifiedFields.add('linkedin_company_url');
      console.log(`[provider-waterfall] Firecrawl: Extracted linkedin_company_url directly: ${linkedInUrls.company}`);
    }
    
    // Extract data with AI - ask for ALL possible fields from website
    const extractPrompt = `Extract business information from this website content.
IMPORTANT: Only extract information that is EXPLICITLY stated on the website. This is ground truth data.

Return a JSON object with any of these fields found:

COMPANY INFO:
- company_name: Official company name
- phone: Main company phone number (in E.164 format if possible)
- employee_count: Number of employees (just the number)
- industry: Primary industry
- founded_year: Year founded

LOCATION:
- city: City location
- state: State/province
- country: Country

SOCIAL:
- linkedin_company_url: LinkedIn company page URL
- twitter_url: Twitter/X profile URL

CLASSIFICATION:
- tech_stack: Array of technologies mentioned (e.g., ["React", "AWS"])
- naics: NAICS code if mentioned
- sic_code: SIC code if mentioned

Website content:
${combinedContent}

Return ONLY valid JSON, no other text.`;

    const aiResponse = await callAI('enrichment', [
      { role: 'system', content: 'Extract only explicitly stated facts. Do not infer or guess.' },
      { role: 'user', content: extractPrompt },
    ]);
    
    if (!aiResponse.ok) return null;
    
    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    const fieldsEnriched: string[] = [];
    
    // Ground truth - fields extracted from official website are verified and locked
    // Expanded to include all directly observable website data
    const groundTruthFields = [
      'company_name', 'phone', 'city', 'state', 'country',
      'linkedin_company_url', 'twitter_url', // Social links from footer
      'founded_year', // If stated on about page
    ];
    
    for (const field of Object.keys(parsed)) {
      let value = parsed[field];
      // Skip empty values
      if (value === undefined || value === null || value === '') continue;
      // Skip if already filled
      if ((data as any)[field]) continue;
      
      // Validate phone fields before storing (prevent GPS coordinates and garbage)
      if (field === 'phone' || field === 'mobile' || field === 'direct_phone') {
        const sanitized = sanitizePhone(value);
        if (!sanitized) {
          console.log(`[provider-waterfall] Firecrawl: Rejected invalid ${field}: ${value}`);
          continue;
        }
        value = sanitized;
        console.log(`[provider-waterfall] Firecrawl: Validated ${field}: ${sanitized}`);
      }
      
      (data as any)[field] = value;
      fieldsEnriched.push(field);
      
      // Mark ground truth fields as verified (prevents AI overwrite)
      if (groundTruthFields.includes(field)) {
        verifiedFields.add(field);
        console.log(`[provider-waterfall] Firecrawl: ${field} marked as VERIFIED (ground truth)`);
      }
    }
    
    if (fieldsEnriched.length === 0) return null;
    
    return {
      provider: 'firecrawl',
      fieldsEnriched,
      confidence: 0.95, // High confidence - ground truth
      latencyMs: Date.now() - start,
      cost: PROVIDER_COSTS.firecrawl,
    };
  } catch (error) {
    console.error('[provider-waterfall] Firecrawl error:', error);
    return null;
  }
}

// ============================================================================
// STEP 4: AI FALLBACK (Single Provider - Legacy)
// ============================================================================

async function enrichFromAI(
  input: EnrichmentInput,
  data: EnrichedData,
  verifiedFields: Set<string>
): Promise<EnrichmentSource | null> {
  const start = Date.now();
  
  const providers = getAvailableProviders();
  if (providers.length === 0) return null;
  
  const companyName = input.company || input.company_name || data.company_name;
  const domain = input.domain || data.domain;
  
  if (!companyName && !domain) return null;
  
  // Identify ALL missing fields (expanded coverage)
  const missingFields: string[] = [];
  for (const field of ALL_ENRICHABLE_FIELDS) {
    if (!(data as any)[field] && !verifiedFields.has(field)) {
      missingFields.push(field);
    }
  }
  
  if (missingFields.length === 0) return null;
  
  const prompt = `Estimate the following business data for ${companyName || domain}:
${missingFields.map(f => `- ${f}`).join('\n')}

Based on company name, domain, and any public knowledge, provide reasonable estimates.
Return a JSON object with the requested fields and a 'confidence' score (0-100).
For revenue_range, use: "$0-$1M", "$1M-$5M", "$5M-$10M", "$10M-$25M", "$25M-$50M", "$50M-$100M", "$100M-$500M", "$500M-$1B", "$1B-$10B", "$10B+"`;

  try {
    const response = await callAI('enrichment', [
      { role: 'system', content: 'You are a B2B data analyst. Provide realistic estimates based on company context. Be conservative with confidence scores.' },
      { role: 'user', content: prompt },
    ]);
    
    if (!response.ok) return null;
    
    const aiData = await response.json();
    const content = extractContentFromResponse(providers[0] || 'lovable', aiData);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    const fieldsEnriched: string[] = [];
    
    // Only use estimates with decent confidence
    const minConfidence = 50;
    if (parsed.confidence && parsed.confidence < minConfidence) return null;
    
    for (const field of missingFields) {
      if (parsed[field] && !verifiedFields.has(field)) {
        (data as any)[field] = parsed[field];
        fieldsEnriched.push(field);
      }
    }
    
    if (fieldsEnriched.length === 0) return null;
    
    const usedProvider = providers.includes('anthropic') ? 'ai_claude' : 
                         providers.includes('lovable') ? 'ai_gemini' : 
                         providers.includes('xai') ? 'ai_grok' : 'ai_gemini';
    
    return {
      provider: usedProvider,
      fieldsEnriched,
      confidence: (parsed.confidence || 60) / 100,
      latencyMs: Date.now() - start,
      cost: PROVIDER_COSTS[usedProvider as keyof typeof PROVIDER_COSTS] || 0.002,
    };
  } catch (error) {
    console.error('[provider-waterfall] AI fallback error:', error);
    return null;
  }
}

// ============================================================================
// STEP 4b: MULTI-PROVIDER AI AGGREGATION (NEW - Full Coverage Mode)
// ============================================================================

/**
 * Call ALL available AI providers and merge their results.
 * Uses provider precedence to resolve conflicts and never overwrites verified fields.
 */
async function enrichFromMultipleAI(
  input: EnrichmentInput,
  data: EnrichedData,
  verifiedFields: Set<string>,
  config: WaterfallConfig
): Promise<EnrichmentSource[]> {
  const sources: EnrichmentSource[] = [];
  const start = Date.now();
  
  const companyName = input.company || input.company_name || data.company_name;
  const domain = input.domain || data.domain;
  const personName = input.name || [input.first_name, input.last_name].filter(Boolean).join(' ');
  
  if (!companyName && !domain && !personName) return [];
  
  // Identify ALL missing fields
  const fieldsToEnrich = config.fieldsToEnrich?.length 
    ? config.fieldsToEnrich 
    : ALL_ENRICHABLE_FIELDS;
  
  const missingFields: string[] = [];
  for (const field of fieldsToEnrich) {
    if (!(data as any)[field] && !verifiedFields.has(field)) {
      missingFields.push(field);
    }
  }
  
  if (missingFields.length === 0) {
    console.log('[provider-waterfall] No missing fields for AI enrichment');
    return [];
  }
  
  console.log(`[provider-waterfall] Multi-AI enrichment: ${missingFields.length} missing fields`);
  
  // Get country context for phone discovery
  const personCountry = input.country || data.country;
  const countryContext = personCountry ? ` based in ${personCountry}` : '';
  const phoneFormatHint = personCountry === 'United Kingdom' || personCountry === 'UK' 
    ? 'IMPORTANT: Only return UK phone numbers starting with +44. Do NOT return US numbers (+1).'
    : personCountry === 'United States' || personCountry === 'US' || personCountry === 'USA'
    ? 'Return US phone numbers in E.164 format (+1XXXXXXXXXX).'
    : 'Return phone numbers in E.164 format with country prefix.';
  
  // Build comprehensive prompt
  const targetInfo = personName 
    ? `${personName}${countryContext} at ${companyName || domain}`
    : `${companyName || domain}`;
    
  const prompt = `Research and provide data for ${targetInfo}.

Find information for these fields:
${missingFields.map(f => `- ${f}`).join('\n')}

Guidelines:
- For employee_count: provide exact number if known, or best estimate
- For revenue_range: use "$0-$1M", "$1M-$5M", "$5M-$10M", "$10M-$25M", "$25M-$50M", "$50M-$100M", "$100M-$500M", "$500M-$1B", "$1B-$10B", "$10B+"
- ${phoneFormatHint}
- For linkedin_url: use full URL
- Include a 'confidence' score (0-100) for the overall data quality

Return ONLY a valid JSON object with the requested fields.`;

  try {
    // Call all AI providers
    const responses = await callAIAllProviders('enrichment', [
      { role: 'system', content: 'You are a B2B data researcher. Provide accurate, verifiable information. Only include fields you have reasonable confidence about.' },
      { role: 'user', content: prompt },
    ], { preferredProvider: config.preferredProvider });
    
    console.log(`[provider-waterfall] Multi-AI: Called ${responses.length} providers`);
    
    // Track which provider filled each field (for precedence)
    const fieldProviders: Record<string, { provider: AIProvider; value: any; confidence: number }> = {};
    
    // ACCURACY IMPROVEMENT #2: Collect all values for voting on key firmographic fields
    const employeeCountVotes: number[] = [];
    const revenueRangeVotes: string[] = [];
    
    // ACCURACY IMPROVEMENT #14: Track field votes for source agreement scoring
    const allFieldVotes: Record<string, FieldVote[]> = {};
    
    // Track per-provider stats for logging
    const providerStats: Record<string, { fieldsAttempted: string[]; fieldsWon: string[]; fieldsLost: string[]; skipped: boolean; reason?: string }> = {};
    
    // Process each provider's response
    for (const response of responses) {
      const providerName = response.provider;
      providerStats[providerName] = { fieldsAttempted: [], fieldsWon: [], fieldsLost: [], skipped: false };
      
      if (!response.success) {
        providerStats[providerName].skipped = true;
        providerStats[providerName].reason = response.error || 'API call failed';
        console.log(`[provider-waterfall] Multi-AI (${providerName}): SKIPPED - ${response.error || 'failed'}`);
        continue;
      }
      
      if (!response.data) {
        providerStats[providerName].skipped = true;
        providerStats[providerName].reason = 'No data returned';
        continue;
      }
      
      // Use provider-specific content extraction
      const content = extractContentFromResponse(response.provider, response.data);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        providerStats[providerName].skipped = true;
        providerStats[providerName].reason = 'No valid JSON in response';
        console.log(`[provider-waterfall] Multi-AI (${providerName}): SKIPPED - no valid JSON`);
        continue;
      }
      
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        let providerConfidence = (parsed.confidence || 60) / 100;
        
        // Perplexity tends to under-report confidence for factual queries
        // If it provides substantive data but reports < 50%, boost to baseline
        if (response.provider === 'perplexity' && providerConfidence < 0.5) {
          const fieldsProvided = Object.keys(parsed).filter(k => 
            k !== 'confidence' && parsed[k] !== null && parsed[k] !== '' && parsed[k] !== undefined
          ).length;
          
          if (fieldsProvided >= 3) {
            const originalConfidence = providerConfidence;
            providerConfidence = Math.max(providerConfidence, 0.6);
            console.log(`[provider-waterfall] Perplexity: Boosted confidence from ${Math.round(originalConfidence * 100)}% to ${Math.round(providerConfidence * 100)}% (${fieldsProvided} fields provided)`);
          }
        }
        
        // Skip low confidence responses
        if (providerConfidence < 0.4) {
          providerStats[providerName].skipped = true;
          providerStats[providerName].reason = `Low confidence: ${Math.round(providerConfidence * 100)}%`;
          console.log(`[provider-waterfall] Multi-AI (${providerName}): SKIPPED - low confidence ${Math.round(providerConfidence * 100)}%`);
          continue;
        }
        
        // Use the authoritative country (captured BEFORE AI responses) for phone validation
        // personCountry is defined at the top of this function and uses input.country as priority
        // We should NOT use parsed.country here as AI may return wrong country
        const authoritativeCountry = personCountry || parsed.country; // personCountry = input.country || data.country
        
        for (const field of missingFields) {
          let value = parsed[field];
          if (value === undefined || value === null || value === '') continue;
          
          providerStats[providerName].fieldsAttempted.push(field);
          
          // Skip if this field is verified (ground truth)
          if (verifiedFields.has(field)) {
            console.log(`[provider-waterfall] Multi-AI (${providerName}): ${field} skipped - verified by prior provider`);
            continue;
          }
          
          // PHONE VALIDATION: Validate phone fields with country awareness
          if (['phone', 'mobile', 'direct_phone'].includes(field)) {
            // ACCURACY IMPROVEMENT #5: Check enterprise phone suppression first
            const suppressCheck = shouldSuppressAIPhone(domain, data.employee_count, providerName);
            if (suppressCheck.suppress) {
              console.log(`[provider-waterfall] Multi-AI (${providerName}): SUPPRESSED ${field} - ${suppressCheck.reason}`);
              continue;
            }
            
            // Use international sanitization with country context
            const sanitized = sanitizePhoneInternational(value, authoritativeCountry);
            if (!sanitized) {
              console.log(`[provider-waterfall] Multi-AI (${providerName}): Rejected invalid ${field}: ${value}`);
              continue;
            }
            
            // CRITICAL: Validate phone matches USER-PROVIDED country - reject mismatches
            if (authoritativeCountry && !isPhoneMatchingCountry(sanitized, authoritativeCountry)) {
              console.log(`[provider-waterfall] Multi-AI (${providerName}): REJECTED ${field} ${sanitized} - country mismatch with ${authoritativeCountry}`);
              continue;
            }
            
            value = sanitized;
            console.log(`[provider-waterfall] Multi-AI (${providerName}): Validated ${field}: ${sanitized} for country ${authoritativeCountry || 'unknown'}`);
          }
          
          // ACCURACY IMPROVEMENT #10: Validate email matches company domain
          if (field === 'email' && typeof value === 'string') {
            const emailValidation = validateEmailMatchesDomain(value, domain);
            if (!emailValidation.isValid) {
              console.log(`[provider-waterfall] Multi-AI (${providerName}): REJECTED ${field} - ${emailValidation.reason}`);
              continue;
            }
          }
          
          // ACCURACY IMPROVEMENT #6: Normalize title values
          if (field === 'title' && typeof value === 'string') {
            value = normalizeTitle(value) || value;
          }
          
          // ACCURACY IMPROVEMENT #9: Validate and normalize LinkedIn URLs
          if (field === 'linkedin_url' || field === 'linkedin_company_url') {
            const normalizedUrl = normalizeLinkedInUrl(value);
            if (!normalizedUrl) {
              console.log(`[provider-waterfall] Multi-AI (${providerName}): REJECTED invalid ${field}: ${value}`);
              continue;
            }
            value = normalizedUrl;
          }
          
          // ACCURACY IMPROVEMENT #12: Validate tech stack items
          if (field === 'tech_stack' && Array.isArray(value)) {
            const validatedTech = validateTechStack(value);
            if (validatedTech.length === 0) {
              console.log(`[provider-waterfall] Multi-AI (${providerName}): REJECTED ${field} - no valid tech items`);
              continue;
            }
            value = validatedTech;
          }
          
          // ACCURACY IMPROVEMENT #2: Collect votes for firmographic fields
          if (field === 'employee_count' && typeof value === 'number' && value > 0) {
            employeeCountVotes.push(value);
          }
          if (field === 'revenue_range' && typeof value === 'string') {
            revenueRangeVotes.push(value);
          }
          
          // ACCURACY IMPROVEMENT #14: Track all field votes for source agreement scoring
          if (!allFieldVotes[field]) allFieldVotes[field] = [];
          allFieldVotes[field].push({ source: providerName, value });
          
          // ACCURACY IMPROVEMENT #3: Validate firmographic combinations
          if (field === 'employee_count' && typeof value === 'number') {
            // Check domain-based validation
            const domainValidation = validateEmployeeCountForDomain(value, domain);
            if (!domainValidation.isValid) {
              console.log(`[provider-waterfall] Multi-AI (${providerName}): REJECTED ${field} ${value} - ${domainValidation.reason}`);
              continue;
            }
          }
          
          // ACCURACY IMPROVEMENT #11: Validate NAICS-industry match
          if (field === 'naics' && data.industry) {
            const naicsValidation = validateNAICSIndustryMatch(value, data.industry);
            if (!naicsValidation.isValid) {
              console.log(`[provider-waterfall] Multi-AI (${providerName}): REJECTED ${field} - ${naicsValidation.reason}`);
              continue;
            }
          }
          
          // ACCURACY IMPROVEMENT #13: Validate city/state match
          if (field === 'city' && data.state) {
            const locationValidation = validateCityStateMatch(value, data.state);
            if (!locationValidation.isValid) {
              console.log(`[provider-waterfall] Multi-AI (${providerName}): REJECTED ${field} - ${locationValidation.reason}`);
              continue;
            }
          }
          if (field === 'state' && data.city) {
            const locationValidation = validateCityStateMatch(data.city, value);
            if (!locationValidation.isValid) {
              console.log(`[provider-waterfall] Multi-AI (${providerName}): REJECTED ${field} - ${locationValidation.reason}`);
              continue;
            }
          }
          
          // Check if this provider has precedence for this field
          const precedence = PROVIDER_PRECEDENCE[field] || PROVIDER_PRECEDENCE.default;
          const existingEntry = fieldProviders[field];
          
          if (!existingEntry) {
            // First provider to supply this field
            fieldProviders[field] = { provider: response.provider, value, confidence: providerConfidence };
            providerStats[providerName].fieldsWon.push(field);
          } else {
            // Check precedence - lower index = higher priority
            const existingPriority = precedence.indexOf(existingEntry.provider);
            const newPriority = precedence.indexOf(response.provider);
            
            if (newPriority < existingPriority && newPriority !== -1) {
              // New provider has higher precedence
              const oldProvider = existingEntry.provider;
              fieldProviders[field] = { provider: response.provider, value, confidence: providerConfidence };
              providerStats[providerName].fieldsWon.push(field);
              // Mark the old provider as having lost this field
              if (providerStats[oldProvider]) {
                providerStats[oldProvider].fieldsLost.push(field);
                const wonIdx = providerStats[oldProvider].fieldsWon.indexOf(field);
                if (wonIdx !== -1) providerStats[oldProvider].fieldsWon.splice(wonIdx, 1);
              }
              console.log(`[provider-waterfall] Multi-AI (${providerName}): ${field} superseded ${oldProvider}`);
            } else {
              providerStats[providerName].fieldsLost.push(field);
            }
          }
        }
      } catch (parseError) {
        providerStats[providerName].skipped = true;
        providerStats[providerName].reason = 'JSON parse error';
        console.warn(`[provider-waterfall] Failed to parse ${response.provider} response`);
      }
    }
    
    // =========================================================================
    // ACCURACY IMPROVEMENT #14: Apply source agreement scoring
    // =========================================================================
    
    // Log agreement scores for fields with multiple sources
    for (const [field, votes] of Object.entries(allFieldVotes)) {
      if (votes.length >= 2) {
        const confidence = computeFieldConfidence(votes);
        console.log(`[provider-waterfall] SOURCE AGREEMENT for ${field}: ${confidence.agreementScore}% (${confidence.voteCount}/${votes.length} sources agree)`);
        
        // If agreement score is high (75%+), boost confidence in final field
        if (confidence.agreementScore >= 75 && fieldProviders[field]) {
          const boostedConfidence = Math.min(0.99, fieldProviders[field].confidence * 1.1);
          console.log(`[provider-waterfall] Boosted ${field} confidence from ${Math.round(fieldProviders[field].confidence * 100)}% to ${Math.round(boostedConfidence * 100)}% (high agreement)`);
          fieldProviders[field].confidence = boostedConfidence;
        }
      }
    }
    
    // =========================================================================
    // ACCURACY IMPROVEMENT #2: Apply cross-source voting for key firmographic fields
    // =========================================================================
    
    // Override employee_count with tolerance-aware aggregation if we have multiple sources
    if (employeeCountVotes.length >= 2 && !verifiedFields.has('employee_count')) {
      // ACCURACY IMPROVEMENT #15: Use tolerance-aware aggregation for employee counts
      const aggregatedCount = aggregateEmployeeCounts(employeeCountVotes);
      if (aggregatedCount) {
        // Check if votes agree within tolerance
        const agreementCount = employeeCountVotes.filter(v => employeeCountsAgree(v, aggregatedCount)).length;
        console.log(`[provider-waterfall] EMPLOYEE_COUNT aggregation: ${aggregatedCount} (${agreementCount}/${employeeCountVotes.length} agree within tolerance) from [${employeeCountVotes.join(', ')}]`);
        
        // Validate the aggregated value
        const domainValidation = validateEmployeeCountForDomain(aggregatedCount, domain);
        if (domainValidation.isValid) {
          // Override whatever single provider picked
          const highAgreement = agreementCount >= Math.ceil(employeeCountVotes.length * 0.6);
          const confidence = highAgreement ? 0.90 : 0.80;
          if (fieldProviders['employee_count']) {
            fieldProviders['employee_count'].value = aggregatedCount;
            fieldProviders['employee_count'].confidence = confidence;
          } else {
            fieldProviders['employee_count'] = { provider: 'perplexity' as AIProvider, value: aggregatedCount, confidence };
          }
        } else {
          console.log(`[provider-waterfall] Aggregated employee_count ${aggregatedCount} failed validation: ${domainValidation.reason}`);
        }
      }
    }
    
    // Override revenue_range with majority vote if we have multiple sources
    if (revenueRangeVotes.length >= 2 && !verifiedFields.has('revenue_range')) {
      const votedRevenueRange = computeMajorityRevenueRange(revenueRangeVotes);
      if (votedRevenueRange) {
        console.log(`[provider-waterfall] VOTED revenue_range: ${votedRevenueRange} from ${revenueRangeVotes.length} sources`);
        
        // Override whatever single provider picked
        if (fieldProviders['revenue_range']) {
          fieldProviders['revenue_range'].value = votedRevenueRange;
        } else {
          fieldProviders['revenue_range'] = { provider: 'perplexity', value: votedRevenueRange, confidence: 0.85 };
        }
      }
    }
    
    // ACCURACY IMPROVEMENT #3: Final firmographic validation before applying
    const finalEmployeeCount = fieldProviders['employee_count']?.value;
    const finalRevenueRange = fieldProviders['revenue_range']?.value;
    if (finalEmployeeCount && finalRevenueRange) {
      const pairValidation = validateEmployeeRevenuePair(finalEmployeeCount, finalRevenueRange);
      if (!pairValidation.isValid) {
        console.log(`[provider-waterfall] FIRMOGRAPHIC MISMATCH: ${pairValidation.reason}`);
        // Clear the less reliable field (revenue is often harder to verify than headcount)
        delete fieldProviders['revenue_range'];
        console.log(`[provider-waterfall] Removed revenue_range due to mismatch with employee_count`);
      }
    }
    
    // Log summary for each provider
    for (const [provider, stats] of Object.entries(providerStats)) {
      if (stats.skipped) {
        console.log(`[provider-waterfall] ${provider}: SKIPPED (${stats.reason})`);
      } else if (stats.fieldsWon.length > 0) {
        console.log(`[provider-waterfall] ${provider}: contributed ${stats.fieldsWon.join(', ')}${stats.fieldsLost.length > 0 ? ` (lost: ${stats.fieldsLost.join(', ')})` : ''}`);
      } else if (stats.fieldsAttempted.length > 0) {
        console.log(`[provider-waterfall] ${provider}: no new fields (all superseded by higher-precedence providers)`);
      } else {
        console.log(`[provider-waterfall] ${provider}: no fields returned`);
      }
    }
    
    // Group fields by provider for source tracking
    const providerFields: Record<string, string[]> = {};
    
    for (const [field, entry] of Object.entries(fieldProviders)) {
      // Apply the value to data
      (data as any)[field] = entry.value;
      
      // Group by provider
      const providerKey = `ai_${entry.provider}`;
      if (!providerFields[providerKey]) {
        providerFields[providerKey] = [];
      }
      providerFields[providerKey].push(field);
    }
    
    // Create source entries for each provider that contributed
    for (const [providerKey, fields] of Object.entries(providerFields)) {
      const baseProvider = providerKey.replace('ai_', '') as AIProvider;
      sources.push({
        provider: providerKey,
        fieldsEnriched: fields,
        confidence: getProviderConfidence(baseProvider),
        latencyMs: Date.now() - start,
        cost: getProviderCost(baseProvider),
      });
    }
    
    console.log(`[provider-waterfall] Multi-AI complete: ${Object.keys(fieldProviders).length} fields from ${Object.keys(providerFields).length} providers`);
    
    return sources;
  } catch (error) {
    console.error('[provider-waterfall] Multi-AI enrichment error:', error);
    return [];
  }
}

// ============================================================================
// STEP 5 & 6: PDL AND APOLLO (PAID FALLBACKS)
// ============================================================================

async function enrichFromPDL(
  input: EnrichmentInput,
  data: EnrichedData,
  verifiedFields: Set<string>,
  forceAllStages: boolean = false
): Promise<EnrichmentSource | null> {
  const start = Date.now();
  
  const apiKey = Deno.env.get('PDL_API_KEY');
  if (!apiKey) return null;
  
  const domain = input.domain || data.domain;
  if (!domain) return null;
  
  // Skip only if we have ALL key firmographic data AND forceAllStages is false
  if (!forceAllStages && data.employee_count && data.revenue_range && data.industry) {
    console.log('[provider-waterfall] PDL skipped - key data already present');
    return null;
  }
  
  try {
    const response = await withHttpRetry(
      () => fetch(`https://api.peopledatalabs.com/v5/company/enrich?website=${encodeURIComponent(domain)}`, {
        headers: { 'X-Api-Key': apiKey },
      }),
      { ...DEFAULT_RETRY_CONFIG, maxRetries: 2 }
    );
    
    if (!response.ok) return null;
    
    const pdlData = await response.json();
    const fieldsEnriched: string[] = [];
    
    if (pdlData.size && !data.employee_count && !verifiedFields.has('employee_count')) {
      data.employee_count = pdlData.size;
      fieldsEnriched.push('employee_count');
    }
    
    if (pdlData.estimated_annual_revenue && !data.revenue_range && !verifiedFields.has('revenue_range')) {
      data.revenue_range = mapRevenueToRange(pdlData.estimated_annual_revenue);
      fieldsEnriched.push('revenue_range');
    }
    
    if (pdlData.industry && !data.industry && !verifiedFields.has('industry')) {
      data.industry = pdlData.industry;
      fieldsEnriched.push('industry');
    }
    
    if (pdlData.location?.country && !data.country && !verifiedFields.has('country')) {
      data.country = pdlData.location.country;
      fieldsEnriched.push('country');
    }
    
    // Additional PDL fields for expanded coverage
    if (pdlData.linkedin_url && !data.linkedin_company_url) {
      data.linkedin_company_url = pdlData.linkedin_url;
      fieldsEnriched.push('linkedin_company_url');
    }
    
    if (pdlData.twitter_url && !data.twitter_url) {
      data.twitter_url = pdlData.twitter_url;
      fieldsEnriched.push('twitter_url');
    }
    
    if (pdlData.founded && !data.founded_year && !verifiedFields.has('founded_year')) {
      data.founded_year = pdlData.founded;
      fieldsEnriched.push('founded_year');
    }
    
    if (fieldsEnriched.length === 0) return null;
    
    return {
      provider: 'pdl',
      fieldsEnriched,
      confidence: 0.90,
      latencyMs: Date.now() - start,
      cost: PROVIDER_COSTS.pdl,
    };
  } catch (error) {
    console.error('[provider-waterfall] PDL error:', error);
    return null;
  }
}

async function enrichFromApollo(
  input: EnrichmentInput,
  data: EnrichedData,
  verifiedFields: Set<string>,
  forceAllStages: boolean = false
): Promise<EnrichmentSource | null> {
  const start = Date.now();
  
  const apiKey = Deno.env.get('APOLLO_API_KEY');
  if (!apiKey) return null;
  
  const domain = input.domain || data.domain;
  if (!domain) return null;
  
  // Skip only if we have ALL key firmographic data AND forceAllStages is false
  if (!forceAllStages && data.employee_count && data.revenue_range && data.industry) {
    console.log('[provider-waterfall] Apollo skipped - key data already present');
    return null;
  }
  
  try {
    const response = await withHttpRetry(
      () => fetch('https://api.apollo.io/v1/organizations/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ api_key: apiKey, domain }),
      }),
      { ...DEFAULT_RETRY_CONFIG, maxRetries: 2 }
    );
    
    if (!response.ok) return null;
    
    const apolloData = await response.json();
    const org = apolloData.organization;
    if (!org) return null;
    
    const fieldsEnriched: string[] = [];
    
    if (org.estimated_num_employees && !data.employee_count && !verifiedFields.has('employee_count')) {
      data.employee_count = org.estimated_num_employees;
      fieldsEnriched.push('employee_count');
    }
    
    if (org.estimated_annual_revenue && !data.revenue_range && !verifiedFields.has('revenue_range')) {
      data.revenue_range = mapRevenueToRange(org.estimated_annual_revenue);
      fieldsEnriched.push('revenue_range');
    }
    
    if (org.industry && !data.industry && !verifiedFields.has('industry')) {
      data.industry = org.industry;
      fieldsEnriched.push('industry');
    }
    
    if (org.country && !data.country && !verifiedFields.has('country')) {
      data.country = org.country;
      fieldsEnriched.push('country');
    }
    
    if (org.city && !data.city && !verifiedFields.has('city')) {
      data.city = org.city;
      fieldsEnriched.push('city');
    }
    
    if (org.state && !data.state && !verifiedFields.has('state')) {
      data.state = org.state;
      fieldsEnriched.push('state');
    }
    
    if (org.linkedin_url && !data.linkedin_company_url) {
      data.linkedin_company_url = org.linkedin_url;
      fieldsEnriched.push('linkedin_company_url');
    }
    
    if (org.twitter_url && !data.twitter_url) {
      data.twitter_url = org.twitter_url;
      fieldsEnriched.push('twitter_url');
    }
    
    if (org.founded_year && !data.founded_year && !verifiedFields.has('founded_year')) {
      data.founded_year = org.founded_year;
      fieldsEnriched.push('founded_year');
    }
    
    if (fieldsEnriched.length === 0) return null;
    
    return {
      provider: 'apollo',
      fieldsEnriched,
      confidence: 0.92,
      latencyMs: Date.now() - start,
      cost: PROVIDER_COSTS.apollo,
    };
  } catch (error) {
    console.error('[provider-waterfall] Apollo error:', error);
    return null;
  }
}

// ============================================================================
// STEP 7: HUNTER EMAIL VERIFICATION
// ============================================================================

async function verifyEmailWithHunter(
  data: EnrichedData
): Promise<EnrichmentSource | null> {
  const start = Date.now();
  
  const apiKey = Deno.env.get('HUNTER_API_KEY');
  if (!apiKey || !data.email) return null;
  
  try {
    const response = await fetch(
      `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(data.email)}&api_key=${apiKey}`
    );
    
    if (!response.ok) return null;
    
    const result = await response.json();
    const status = result.data?.status;
    
    if (status === 'valid' || status === 'accept_all') {
      data.email_verified = true;
      return {
        provider: 'hunter',
        fieldsEnriched: ['email_verified'],
        confidence: 0.95,
        latencyMs: Date.now() - start,
        cost: PROVIDER_COSTS.hunter,
      };
    }
    
    return null;
  } catch (error) {
    console.error('[provider-waterfall] Hunter error:', error);
    return null;
  }
}

// ============================================================================
// MAIN WATERFALL FUNCTION
// ============================================================================

export async function runEnrichmentWaterfall(
  input: EnrichmentInput,
  config: WaterfallConfig = {}
): Promise<EnrichmentResult> {
  const startTime = Date.now();
  const data: EnrichedData = {};
  const verifiedFields = new Set<string>();
  const sources: EnrichmentSource[] = [];
  const costs: { provider: string; cost: number }[] = [];
  
  // Debug tracking
  const debugResults: EnrichmentDebugInfo['providerResults'] = [];
  const fieldSources: Record<string, { provider: string; confidence: number }> = {};
  
  // Initialize Supabase client for caching
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  // Determine cache key based on input type
  const cacheKey = input.domain 
    ? getDomainCacheKey(input.domain)
    : input.email 
      ? getEmailCacheKey(input.email)
      : getCompanyCacheKey(input.company_name || input.company || '');
  const cacheType: 'domain' | 'email' | 'company' = input.domain 
    ? 'domain' 
    : input.email 
      ? 'email' 
      : 'company';
  
  // STEP 0: Check cache for existing enrichment (Phase 4A optimization)
  try {
    if (cacheKey && config.forceAllStages !== true) {
      const cached = await getCachedEnrichment(supabase, cacheKey, cacheType);
      if (cached && cached.hit) {
        console.log(`[provider-waterfall] CACHE HIT for ${cacheType}:${cacheKey.slice(0, 20)}...`);
        
        // Merge cached data into result
        const cachedData = cached.enriched_data as EnrichedData;
        return {
          success: true,
          data: cachedData,
          sources: [{
            provider: 'cache',
            fieldsEnriched: Object.keys(cachedData).filter(k => (cachedData as any)[k] != null),
            confidence: cached.confidence || 0.9,
            latencyMs: Date.now() - startTime,
            cost: 0,
          }],
          verifiedFields: [],
          cost: { total: 0, breakdown: [] },
          confidence: cached.confidence || 0.9,
        };
      }
    }
  } catch (cacheError) {
    console.warn('[provider-waterfall] Cache lookup failed, continuing without cache:', cacheError);
  }
  
  // Copy existing data
  if (input.first_name) data.first_name = input.first_name;
  if (input.last_name) data.last_name = input.last_name;
  if (input.name) data.name = input.name;
  if (input.email) data.email = input.email;
  if (input.phone) data.phone = input.phone;
  if (input.mobile) data.mobile = input.mobile;
  if (input.title) data.title = input.title;
  if (input.linkedin_url) data.linkedin_url = input.linkedin_url;
  if (input.company || input.company_name) data.company_name = input.company || input.company_name;
  if (input.domain) data.domain = input.domain;
  if (input.industry) data.industry = input.industry;
  if (input.employee_count) data.employee_count = input.employee_count;
  if (input.revenue_range) data.revenue_range = input.revenue_range;
  if (input.country) {
    data.country = input.country;
    // CRITICAL: User-provided country is authoritative for phone validation
    // Mark as verified so AI cannot overwrite it
    verifiedFields.add('country');
    console.log(`[provider-waterfall] User-provided country "${input.country}" marked as VERIFIED`);
  }
  if (input.state) data.state = input.state;
  if (input.city) data.city = input.city;
  
  let totalCost = 0;
  const maxCost = config.maxCost ?? 0.50;
  
  console.log(`[provider-waterfall] Starting enrichment for ${data.company_name || data.domain || data.email || 'unknown'}`);
  
  // Step 1: Email parsing (free)
  const emailResult = await enrichFromEmail(input, data, verifiedFields);
  if (emailResult) {
    sources.push(emailResult);
    costs.push({ provider: emailResult.provider, cost: emailResult.cost });
    totalCost += emailResult.cost;
    console.log(`[provider-waterfall] Step 1 (email): ${emailResult.fieldsEnriched.join(', ')}`);
  }
  
  // Step 2: Perplexity AI search
  const perplexityResult = await enrichFromPerplexity(input, data, verifiedFields);
  if (perplexityResult) {
    sources.push(perplexityResult);
    costs.push({ provider: perplexityResult.provider, cost: perplexityResult.cost });
    totalCost += perplexityResult.cost;
    console.log(`[provider-waterfall] Step 2 (perplexity): ${perplexityResult.fieldsEnriched.join(', ')}`);
  }
  
  // Step 3: Firecrawl website scrape (ground truth)
  if (config.includeWebScrape !== false) {
    const firecrawlResult = await enrichFromFirecrawl(input, data, verifiedFields);
    if (firecrawlResult) {
      sources.push(firecrawlResult);
      costs.push({ provider: firecrawlResult.provider, cost: firecrawlResult.cost });
      totalCost += firecrawlResult.cost;
      console.log(`[provider-waterfall] Step 3 (firecrawl): ${firecrawlResult.fieldsEnriched.join(', ')} [GROUND TRUTH]`);
    }
  }
  
  // ACCURACY IMPROVEMENT #8: EARLY-EXIT OPTIMIZATION
  // Check field coverage - if we already have 90%+ coverage, skip expensive AI fallback
  const priorCoverage = getFieldCoverageStatus(data, verifiedFields, ACCOUNT_ENRICHABLE_FIELDS);
  console.log(`[provider-waterfall] Pre-AI coverage: ${priorCoverage.coverage.toFixed(0)}% (${priorCoverage.filled.length}/${ACCOUNT_ENRICHABLE_FIELDS.length} fields)`);
  
  // Early exit if coverage is already high (saves API costs)
  if (priorCoverage.coverage >= EARLY_EXIT_COVERAGE_THRESHOLD && !config.forceAllStages) {
    console.log(`[provider-waterfall] EARLY EXIT: Coverage ${priorCoverage.coverage.toFixed(0)}% >= ${EARLY_EXIT_COVERAGE_THRESHOLD}% threshold. Skipping remaining providers.`);
    
    // Still cache the result and return
    const avgConfidence = sources.length > 0 
      ? sources.reduce((sum, s) => sum + s.confidence, 0) / sources.length 
      : 0;
    const totalFieldsEnriched = sources.reduce((sum, s) => sum + s.fieldsEnriched.length, 0);
    
    // Store in cache
    if (cacheKey && totalFieldsEnriched > 0) {
      const sourcesStr = sources.map(s => s.provider);
      await setCachedEnrichment(supabase, cacheKey, cacheType, data, sourcesStr, avgConfidence, totalCost, CACHE_TTL_DAYS)
        .catch(err => console.warn('[provider-waterfall] Cache write failed:', err));
    }
    
    return {
      success: totalFieldsEnriched > 0,
      data,
      sources,
      verifiedFields: Array.from(verifiedFields),
      cost: { total: totalCost, breakdown: costs },
      confidence: avgConfidence,
    };
  }
  
  if (priorCoverage.missing.length > 0) {
    console.log(`[provider-waterfall] Missing fields for AI: ${priorCoverage.missing.join(', ')}`);
  }
  if (priorCoverage.verified.length > 0) {
    console.log(`[provider-waterfall] Verified fields (protected): ${priorCoverage.verified.join(', ')}`);
  }
  
  // Step 4: AI enrichment (single or multi-provider based on config)
  // Default to aggregateProviders: true for maximum field coverage
  const useAggregation = config.aggregateProviders !== false;
  
  // Only invoke AI if there are missing fields
  if (priorCoverage.missing.length > 0 && useAggregation) {
    // NEW: Multi-provider AI aggregation for full field coverage
    const multiAIResults = await enrichFromMultipleAI(input, data, verifiedFields, config);
    for (const aiResult of multiAIResults) {
      sources.push(aiResult);
      costs.push({ provider: aiResult.provider, cost: aiResult.cost });
      totalCost += aiResult.cost;
    }
    if (multiAIResults.length > 0) {
      console.log(`[provider-waterfall] Step 4 (Multi-AI): ${multiAIResults.length} providers contributed`);
    }
  } else if (priorCoverage.missing.length > 0) {
    // Legacy: Single provider AI fallback
    const aiResult = await enrichFromAI(input, data, verifiedFields);
    if (aiResult) {
      sources.push(aiResult);
      costs.push({ provider: aiResult.provider, cost: aiResult.cost });
      totalCost += aiResult.cost;
      console.log(`[provider-waterfall] Step 4 (AI): ${aiResult.fieldsEnriched.join(', ')}`);
    }
  } else {
    console.log(`[provider-waterfall] Step 4 (AI): SKIPPED - all ${ACCOUNT_ENRICHABLE_FIELDS.length} fields already filled`);
  }
  
  // Check coverage after AI enrichment
  const postAICoverage = getFieldCoverageStatus(data, verifiedFields, ACCOUNT_ENRICHABLE_FIELDS);
  if (postAICoverage.coverage > priorCoverage.coverage) {
    console.log(`[provider-waterfall] Post-AI coverage: ${postAICoverage.coverage.toFixed(0)}% (+${(postAICoverage.coverage - priorCoverage.coverage).toFixed(0)}%)`);
  }
  
  // Step 4.5: Custom Attribute Enrichment (Vertical-specific data)
  if (config.customAttributeDefinitions && config.customAttributeDefinitions.length > 0) {
    const defsWithPrompts = config.customAttributeDefinitions.filter(d => d.enrichment_prompt);
    if (defsWithPrompts.length > 0) {
      console.log(`[provider-waterfall] Step 4.5 (Custom Attributes): Enriching ${defsWithPrompts.length} vertical fields`);
      try {
        const customAttrs: Record<string, any> = data.custom_attributes || {};
        const companyName = data.company_name || input.company_name || input.company || '';
        const domain = data.domain || input.domain || '';
        
        // Build a single prompt with all custom attribute questions
        const questionsBlock = defsWithPrompts.map((def, i) => 
          `${i + 1}. ${def.enrichment_prompt} (field: ${def.field_key}, type: ${def.field_type}${def.options && def.options.length > 0 ? `, valid options: ${def.options.join(', ')}` : ''})`
        ).join('\n');
        
        const customPrompt = `For the company "${companyName}" (domain: ${domain}), answer these specific questions. Return ONLY a JSON object with field keys as keys and the answers as values. For number types return numbers, for select/multi_select return the matching option(s) exactly as listed.\n\n${questionsBlock}`;
        
        // Use Perplexity for real-time web search if available
        const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
        if (perplexityKey && companyName) {
          console.log(`[provider-waterfall] Step 4.5: Perplexity prompt for "${companyName}" (${domain}): ${customPrompt}`);
          try {
            const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${perplexityKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'sonar-pro',
                messages: [
                  { role: 'system', content: 'You are a data extraction expert. Return ONLY valid JSON with the requested field keys and values. No markdown, no explanation.' },
                  { role: 'user', content: customPrompt }
                ],
              }),
            });
            
            if (perplexityResponse.ok) {
              const perplexityData = await perplexityResponse.json();
              const rawContent = perplexityData.choices?.[0]?.message?.content || '';
              console.log(`[provider-waterfall] Step 4.5: Perplexity raw response: ${rawContent}`);
              
              // Extract JSON from response
              const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                try {
                  const parsed = JSON.parse(jsonMatch[0]);
                  for (const def of defsWithPrompts) {
                    if (parsed[def.field_key] !== undefined && parsed[def.field_key] !== null) {
                      customAttrs[def.field_key] = parsed[def.field_key];
                    }
                  }
                  console.log(`[provider-waterfall] Step 4.5: Perplexity parsed values: ${JSON.stringify(parsed)}`);
                } catch (parseErr) {
                  console.warn('[provider-waterfall] Step 4.5: Failed to parse Perplexity custom attributes JSON');
                }
              } else {
                console.warn(`[provider-waterfall] Step 4.5: No JSON found in Perplexity response: ${rawContent.substring(0, 200)}`);
              }
              
              sources.push({
                provider: 'perplexity_custom',
                fieldsEnriched: Object.keys(customAttrs),
                confidence: 0.75,
                latencyMs: Date.now() - startTime,
                cost: PROVIDER_COSTS.perplexity,
              });
              totalCost += PROVIDER_COSTS.perplexity;
            } else {
              const errBody = await perplexityResponse.text().catch(() => '');
              console.warn(`[provider-waterfall] Step 4.5: Perplexity HTTP error: ${perplexityResponse.status} ${errBody}`);
            }
          } catch (perplexityErr) {
            console.warn('[provider-waterfall] Step 4.5: Perplexity custom attribute enrichment failed:', perplexityErr);
          }
        }
        
        // Use Lovable AI (Gemini) as validation/fallback for any missing fields
        const lovableKey = Deno.env.get('LOVABLE_API_KEY');
        const missingCustomFields = defsWithPrompts.filter(d => customAttrs[d.field_key] === undefined);
        
        if (lovableKey && missingCustomFields.length > 0 && companyName) {
          try {
            const fallbackQuestions = missingCustomFields.map((def, i) => 
              `${i + 1}. ${def.enrichment_prompt} (field: ${def.field_key}, type: ${def.field_type}${def.options && def.options.length > 0 ? `, options: ${def.options.join(', ')}` : ''})`
            ).join('\n');
            
            const geminiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${lovableKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [
                  { role: 'system', content: 'You are a data extraction expert. Return ONLY valid JSON. No markdown.' },
                  { role: 'user', content: `For "${companyName}" (${domain}), answer:\n${fallbackQuestions}` }
                ],
              }),
            });
            
            if (geminiResponse.ok) {
              const geminiData = await geminiResponse.json();
              const geminiContent = geminiData.choices?.[0]?.message?.content || '';
              console.log(`[provider-waterfall] Step 4.5: Gemini raw response: ${geminiContent}`);
              const geminiJson = geminiContent.match(/\{[\s\S]*\}/);
              if (geminiJson) {
                try {
                  const parsed = JSON.parse(geminiJson[0]);
                  for (const def of missingCustomFields) {
                    if (parsed[def.field_key] !== undefined && parsed[def.field_key] !== null) {
                      customAttrs[def.field_key] = parsed[def.field_key];
                    }
                  }
                  console.log(`[provider-waterfall] Step 4.5: Gemini filled ${Object.keys(parsed).length} missing custom attributes`);
                } catch (parseErr) {
                  console.warn('[provider-waterfall] Step 4.5: Failed to parse Gemini custom attributes');
                }
              }
              totalCost += PROVIDER_COSTS.ai_gemini;
            }
          } catch (geminiErr) {
            console.warn('[provider-waterfall] Step 4.5: Gemini custom attribute fallback failed:', geminiErr);
          }
        }
        
        if (Object.keys(customAttrs).length > 0) {
          data.custom_attributes = customAttrs;
          console.log(`[provider-waterfall] Step 4.5: Final custom_attributes: ${JSON.stringify(customAttrs)}`);
        }
      } catch (customErr) {
        console.warn('[provider-waterfall] Step 4.5: Custom attribute enrichment failed:', customErr);
      }
    }
  }
  
  // Steps 5-6: Paid providers
  // With forceAllStages, run even if some data exists; otherwise check key data
  const hasKeyData = data.employee_count && data.revenue_range && data.industry;
  const shouldRunPaid = !config.skipPaidProviders && totalCost < maxCost;
  const forceAll = config.forceAllStages ?? false;
  
  if (shouldRunPaid && (forceAll || !hasKeyData)) {
    // Step 5: PDL
    const pdlResult = await enrichFromPDL(input, data, verifiedFields, forceAll);
    if (pdlResult) {
      sources.push(pdlResult);
      costs.push({ provider: pdlResult.provider, cost: pdlResult.cost });
      totalCost += pdlResult.cost;
      console.log(`[provider-waterfall] Step 5 (PDL): ${pdlResult.fieldsEnriched.join(', ')}`);
    }
    
    // Step 6: Apollo - run if forceAll or still missing data
    const stillMissingData = !data.employee_count || !data.revenue_range;
    if (forceAll || stillMissingData) {
      const apolloResult = await enrichFromApollo(input, data, verifiedFields, forceAll);
      if (apolloResult) {
        sources.push(apolloResult);
        costs.push({ provider: apolloResult.provider, cost: apolloResult.cost });
        totalCost += apolloResult.cost;
        console.log(`[provider-waterfall] Step 6 (Apollo): ${apolloResult.fieldsEnriched.join(', ')}`);
      }
    }
  }
  
  // Step 7: Email verification
  if (config.verifyEmail && data.email) {
    const hunterResult = await verifyEmailWithHunter(data);
    if (hunterResult) {
      sources.push(hunterResult);
      costs.push({ provider: hunterResult.provider, cost: hunterResult.cost });
      totalCost += hunterResult.cost;
      console.log(`[provider-waterfall] Step 7 (Hunter): email verified`);
    }
  }
  
  // Calculate overall confidence
  const avgConfidence = sources.length > 0 
    ? sources.reduce((sum, s) => sum + s.confidence, 0) / sources.length 
    : 0;
  
  const totalFieldsEnriched = sources.reduce((sum, s) => sum + s.fieldsEnriched.length, 0);
  
  // STEP 8: Store result in cache for future lookups (Phase 4A)
  if (cacheKey && totalFieldsEnriched > 0) {
    const sourcesStr = sources.map(s => s.provider);
    await setCachedEnrichment(
      supabase,
      cacheKey,
      cacheType,
      data,
      sourcesStr,
      avgConfidence,
      totalCost,
      CACHE_TTL_DAYS
    ).catch(err => console.warn('[provider-waterfall] Cache write failed:', err));
  }
  
  // Build field sources from all sources
  for (const source of sources) {
    for (const field of source.fieldsEnriched) {
      if (!fieldSources[field]) {
        fieldSources[field] = { provider: source.provider, confidence: source.confidence };
      }
    }
    // Track each source for debug
    debugResults.push({
      provider: source.provider,
      success: true,
      fieldsAttempted: source.fieldsEnriched,
      fieldsContributed: source.fieldsEnriched,
      latencyMs: source.latencyMs,
    });
  }
  
  console.log(`[provider-waterfall] Complete: ${totalFieldsEnriched} fields from ${sources.length} providers, cost=$${totalCost.toFixed(4)}`);
  
  const result: EnrichmentResult = {
    success: totalFieldsEnriched > 0,
    data,
    sources,
    verifiedFields: Array.from(verifiedFields),
    cost: {
      total: totalCost,
      breakdown: costs,
    },
    confidence: avgConfidence,
  };
  
  // Add debug info if requested
  if (config.debug) {
    result.debug = {
      providerResults: debugResults,
      verifiedFields: Array.from(verifiedFields),
      fieldSources,
    };
    console.log(`[provider-waterfall] Debug: Field sources:`, JSON.stringify(fieldSources, null, 2));
  }
  
  return result;
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

export async function runBatchEnrichment(
  inputs: EnrichmentInput[],
  config: WaterfallConfig = {},
  onProgress?: (processed: number, total: number) => void
): Promise<{
  results: EnrichmentResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalCost: number;
    avgConfidence: number;
  };
}> {
  const results: EnrichmentResult[] = [];
  let totalCost = 0;
  let totalConfidence = 0;
  let successful = 0;
  
  for (let i = 0; i < inputs.length; i++) {
    const result = await runEnrichmentWaterfall(inputs[i], config);
    results.push(result);
    
    totalCost += result.cost.total;
    totalConfidence += result.confidence;
    if (result.success) successful++;
    
    if (onProgress) {
      onProgress(i + 1, inputs.length);
    }
  }
  
  return {
    results,
    summary: {
      total: inputs.length,
      successful,
      failed: inputs.length - successful,
      totalCost,
      avgConfidence: inputs.length > 0 ? totalConfidence / inputs.length : 0,
    },
  };
}
