/**
 * Unified Provider Waterfall for Data Enrichment
 * 
 * This module implements the user-defined enrichment waterfall:
 * 1. Extract name from email
 * 2. Perplexity AI search (primary discovery)
 * 3. Firecrawl website scrape (ground truth)
 * 4. Multi-provider AI aggregation (Claude/Gemini/Grok) for remaining gaps
 * 5. PDL (fallback)
 * 6. Apollo (last resort)
 * 7. Hunter email verification
 * 
 * A 'verifiedFields' Set ensures data from reliable sources acts as ground truth
 * and cannot be overwritten by subsequent lookups.
 * 
 * NEW: aggregateProviders mode calls ALL available AI providers and merges results
 * with proper precedence to maximize field coverage.
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
  type PhoneEntry 
} from './phone-utils.ts';

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
    
    // Get person's country for phone validation (from input, existing data, or AI response)
    const detectedCountry = input.country || data.country || parsed.country;
    
    for (const [sourceField, targetField] of fieldMappings) {
      if (parsed[sourceField] && !verifiedFields.has(targetField) && !(data as any)[targetField]) {
        let value = parsed[sourceField];
        
        // Skip "N/A" or placeholder values
        if (typeof value === 'string' && (value === 'N/A' || value === 'n/a' || value === 'Not available' || value === 'Unknown')) {
          console.log(`[provider-waterfall] Perplexity: Skipping placeholder ${targetField}: ${value}`);
          continue;
        }
        
        // Validate phone fields with country awareness
        if (['phone', 'mobile', 'direct_phone'].includes(targetField)) {
          // Use international sanitization with country context
          const sanitized = sanitizePhoneInternational(value, detectedCountry);
          if (!sanitized) {
            console.log(`[provider-waterfall] Perplexity: Rejected invalid ${targetField}: ${value}`);
            continue;
          }
          
          // Validate phone matches detected country
          if (detectedCountry && !isPhoneMatchingCountry(sanitized, detectedCountry)) {
            console.log(`[provider-waterfall] Perplexity: Rejected ${targetField} ${sanitized} - doesn't match country ${detectedCountry}`);
            continue;
          }
          
          value = sanitized;
          console.log(`[provider-waterfall] Perplexity: Validated ${targetField}: ${sanitized} for country ${detectedCountry || 'unknown'}`);
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
        
        // Get country context for phone validation
        const detectedCountry = input.country || data.country || parsed.country;
        
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
            // Use international sanitization with country context
            const sanitized = sanitizePhoneInternational(value, detectedCountry);
            if (!sanitized) {
              console.log(`[provider-waterfall] Multi-AI (${providerName}): Rejected invalid ${field}: ${value}`);
              continue;
            }
            
            // CRITICAL: Validate phone matches detected country - reject mismatches
            if (detectedCountry && !isPhoneMatchingCountry(sanitized, detectedCountry)) {
              console.log(`[provider-waterfall] Multi-AI (${providerName}): REJECTED ${field} ${sanitized} - country mismatch with ${detectedCountry}`);
              continue;
            }
            
            value = sanitized;
            console.log(`[provider-waterfall] Multi-AI (${providerName}): Validated ${field}: ${sanitized} for country ${detectedCountry || 'unknown'}`);
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
  if (input.country) data.country = input.country;
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
  
  // Check field coverage before AI fallback
  const priorCoverage = getFieldCoverageStatus(data, verifiedFields, ACCOUNT_ENRICHABLE_FIELDS);
  console.log(`[provider-waterfall] Pre-AI coverage: ${priorCoverage.coverage.toFixed(0)}% (${priorCoverage.filled.length}/${ACCOUNT_ENRICHABLE_FIELDS.length} fields)`);
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
