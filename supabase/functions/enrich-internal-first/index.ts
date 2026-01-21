// Internal-First Enrichment - Check existing data before calling external APIs
// Reduces API costs by leveraging already-enriched accounts and leads
// Now includes domain discovery for company-name-only inputs
// UPDATED: Website-First Strategy for SMBs - Firecrawl runs BEFORE Apollo/PDL
// v3.0 - Fixed provider order: Perplexity → Firecrawl → Claude → Google → PDL → Apollo → Hunter

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { withHttpRetry, DEFAULT_RETRY_CONFIG } from '../_shared/retry-helper.ts';
import { callAI, getAvailableProviders } from '../_shared/ai-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnrichmentInput {
  email?: string;
  domain?: string;
  company_name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  source_type?: string;
}

interface EnrichmentResult {
  input: EnrichmentInput;
  matched_account?: any;
  matched_lead?: any;
  enriched_data: Record<string, any>;
  source: 'internal' | 'apollo' | 'pdl' | 'clearbit' | 'ai' | 'domain_discovery' | 'hunter' | 'firecrawl' | 'perplexity' | 'google_search';
  confidence: number;
  fields_filled: string[];
  api_calls_saved: boolean;
  domain_discovered?: boolean;
  verified_fields?: Set<string>;
}

// Extract domain from email
const extractDomain = (email: string): string => {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1].toLowerCase() : '';
};

// Normalize domain for matching
const normalizeDomain = (domain: string): string => {
  return domain.toLowerCase().replace(/^(www\.|https?:\/\/)/, '').split('/')[0];
};

// Calculate data completeness for an account
const calculateCompleteness = (account: any): number => {
  const keyFields = ['employee_count', 'revenue_range', 'industry_norm', 'country', 'linkedin_url'];
  const filled = keyFields.filter(f => account[f] != null).length;
  return (filled / keyFields.length) * 100;
};

// Extract name from email (e.g., "bill.smith@company.com" -> { first_name: "Bill", last_name: "Smith" })
const extractNameFromEmail = (email: string): { first_name?: string; last_name?: string } => {
  if (!email) return {};
  
  const localPart = email.split('@')[0];
  if (!localPart) return {};
  
  // Replace common separators with spaces
  const normalized = localPart.replace(/[._\-+]/g, ' ').trim();
  const parts = normalized.split(' ').filter(p => p.length > 0);
  
  if (parts.length === 0) return {};
  
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  
  // Filter out common noise (numbers, single chars except initials)
  const cleanParts = parts.filter(p => !/^\d+$/.test(p) && p.length > 1);
  
  if (cleanParts.length >= 2) {
    return {
      first_name: capitalize(cleanParts[0]),
      last_name: capitalize(cleanParts[cleanParts.length - 1])
    };
  } else if (cleanParts.length === 1) {
    return { first_name: capitalize(cleanParts[0]) };
  }
  
  return {};
};

// SMB Industry Keywords for domain-based detection
const SMB_INDUSTRY_KEYWORDS: Record<string, string[]> = {
  'Towing & Recovery': ['towing', 'tow', 'wrecker', 'recovery', 'roadside'],
  'Auto Repair & Service': ['auto', 'automotive', 'mechanic', 'tire', 'brake', 'muffler', 'transmission', 'carcare'],
  'Trucking & Transport': ['trucking', 'freight', 'hauling', 'transport', 'logistics', 'moving'],
  'HVAC': ['heating', 'cooling', 'hvac', 'airconditioning', 'furnace'],
  'Plumbing': ['plumbing', 'plumber', 'drain', 'pipe', 'sewer'],
  'Electrical Services': ['electric', 'electrical', 'electrician', 'wiring'],
  'Construction': ['construction', 'contractor', 'building', 'roofing', 'siding', 'remodeling'],
  'Landscaping': ['landscap', 'lawn', 'garden', 'tree', 'mowing', 'irrigation'],
  'Cleaning Services': ['cleaning', 'janitorial', 'maid', 'housekeep'],
  'Pest Control': ['pest', 'exterminator', 'termite'],
  'Garage Door Services': ['garagedoor', 'overhead', 'doorrepair'],
  'Locksmith': ['locksmith', 'lock', 'key', 'security'],
  'Restaurant & Food Service': ['restaurant', 'cafe', 'diner', 'grill', 'pizza', 'food', 'catering', 'bbq'],
  'Real Estate': ['realty', 'realtor', 'realestate', 'properties', 'homes'],
  'Insurance': ['insurance', 'insure'],
  'Legal Services': ['law', 'legal', 'attorney', 'lawyer'],
  'Dental': ['dental', 'dentist', 'orthodont'],
  'Medical': ['medical', 'clinic', 'health', 'doctor', 'physician', 'chiro'],
  'Veterinary': ['vet', 'animal', 'pet'],
  'Salon & Spa': ['salon', 'spa', 'beauty', 'hair', 'nail'],
  'Fitness': ['fitness', 'gym', 'crossfit', 'yoga', 'training'],
  'Photography': ['photo', 'photography', 'photographer', 'studio'],
  'Printing': ['print', 'printing', 'signs', 'graphics'],
};

// SMB indicators that suggest small business
const SMB_INDICATORS = [
  'family owned', 'family-owned', 'locally owned', 'locally-owned', 
  'small business', 'family business', 'local business',
  'owner operated', 'owner-operated', 'since 19', 'since 20',
  'serving the', 'proudly serving', 'family run', 'mom and pop'
];

// Detect industry from domain keywords
const detectIndustryFromDomain = (domain: string): string | null => {
  if (!domain) return null;
  const domainLower = domain.toLowerCase().replace(/\./g, '').replace(/-/g, '');
  
  for (const [industry, keywords] of Object.entries(SMB_INDUSTRY_KEYWORDS)) {
    if (keywords.some(kw => domainLower.includes(kw.replace(/\s/g, '')))) {
      return industry;
    }
  }
  return null;
};

// Detect SMB indicators from website content
const detectSMBFromContent = (markdown: string): { isSMB: boolean; employeeEstimate?: number } => {
  if (!markdown) return { isSMB: false };
  const lower = markdown.toLowerCase();
  
  for (const indicator of SMB_INDICATORS) {
    if (lower.includes(indicator)) {
      return { isSMB: true, employeeEstimate: 10 }; // Conservative SMB estimate
    }
  }
  return { isSMB: false };
};

// Detect if a company is likely an SMB based on name and domain
const isLikelySMB = (companyName?: string, domain?: string): boolean => {
  if (!companyName && !domain) return false;
  const combined = `${companyName || ''} ${domain || ''}`.toLowerCase();
  
  // Check for SMB industry keywords
  for (const keywords of Object.values(SMB_INDUSTRY_KEYWORDS)) {
    if (keywords.some(kw => combined.includes(kw.replace(/\s/g, '')))) {
      return true;
    }
  }
  
  // Check for local business patterns
  const smbPatterns = [
    'towing', 'repair', 'service', 'local', 'plumbing', 'lawn', 'roofing',
    'cleaning', 'moving', 'painting', 'flooring', 'fencing', 'landscaping',
    'electric', 'heating', 'cooling', 'hvac', 'pest', 'garage', 'locksmith'
  ];
  
  return smbPatterns.some(pattern => combined.includes(pattern));
};

// Validate employee count - reject hallucinated/unrealistic data
const validateEmployeeCount = (count: number | null | undefined, domain?: string, companyName?: string): number | null => {
  if (!count || count <= 0) return null;
  
  // Any count > 100,000 is suspicious for most companies
  if (count > 100000) {
    console.warn(`[validation] Rejecting unrealistic employee count: ${count} for ${domain || companyName}`);
    return null;
  }
  
  // For detected SMBs, reject counts > 500
  if (isLikelySMB(companyName, domain) && count > 500) {
    console.warn(`[validation] Rejecting suspicious SMB employee count: ${count} for ${domain || companyName}`);
    return null;
  }
  
  return count;
};

// Classify job title into Level and Persona - FIXED: Owner always C-Level
const classifyTitle = (title: string): { level: string; persona: string } => {
  if (!title) return { level: 'Unknown', persona: 'Unknown' };
  
  const t = title.toLowerCase();
  
  // Level classification - FIXED: Owner/Partner always C-Level for SMBs
  let level = 'Individual Contributor';
  
  // C-Level first - includes Owner/Partner/Principal for SMBs
  if (/\b(ceo|cfo|cto|coo|cmo|cio|ciso|chief|founder|co-founder|cofounder|owner|co-owner|president|partner|principal|proprietor)\b/.test(t)) {
    level = 'C-Level';
  } else if (/\b(vp|vice president|evp|svp)\b/.test(t)) {
    level = 'VP';
  } else if (/\b(director|head of)\b/.test(t)) {
    level = 'Director';
  } else if (/\b(manager|lead|supervisor|team lead)\b/.test(t)) {
    level = 'Manager';
  } else if (/\b(senior|sr\.?|principal)\b/.test(t)) {
    level = 'Senior';
  }
  
  // Persona classification - FIXED: Owner -> Executive persona
  let persona = 'Other';
  
  // Check Executive first (owner/founder roles)
  if (/\b(ceo|cto|cfo|coo|cmo|founder|co-founder|cofounder|owner|co-owner|president|partner|principal|proprietor|managing)\b/.test(t)) {
    persona = 'Executive';
  } else if (/\b(sales|account executive|ae|business development|bdr|sdr|revenue)\b/.test(t)) {
    persona = 'Sales';
  } else if (/\b(marketing|growth|demand gen|content|brand|pr|communications)\b/.test(t)) {
    persona = 'Marketing';
  } else if (/\b(engineer|developer|software|devops|sre|architect|technical|tech lead)\b/.test(t)) {
    persona = 'Engineering';
  } else if (/\b(product|pm|product manager|product owner)\b/.test(t)) {
    persona = 'Product';
  } else if (/\b(hr|human resources|people|talent|recruiting|recruiter)\b/.test(t)) {
    persona = 'HR';
  } else if (/\b(finance|accounting|controller|treasurer|bookkeeper)\b/.test(t)) {
    persona = 'Finance';
  } else if (/\b(operations|ops|logistics|supply chain|procurement|dispatch)\b/.test(t)) {
    persona = 'Operations';
  } else if (/\b(legal|counsel|compliance|attorney|lawyer)\b/.test(t)) {
    persona = 'Legal';
  } else if (/\b(it|information technology|systems|network|security|infosec)\b/.test(t)) {
    persona = 'IT';
  } else if (/\b(customer success|cs|support|service|client)\b/.test(t)) {
    persona = 'Customer Success';
  }
  
  return { level, persona };
};

// Generic email domains to skip for company enrichment
const GENERIC_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
  'aol.com', 'icloud.com', 'protonmail.com', 'mail.com',
  'sbcglobal.net', 'comcast.net', 'att.net', 'verizon.net',
  'live.com', 'msn.com', 'me.com', 'mac.com', 'ymail.com',
  'rocketmail.com', 'cox.net', 'charter.net', 'earthlink.net',
  // Additional personal domains
  'gmx.com', 'gmx.net', 'zoho.com', 'fastmail.com', 'tutanota.com',
  'inbox.com', 'hushmail.com', 'mailfence.com', 'startmail.com'
];

const isGenericEmailDomain = (domain: string): boolean => {
  return GENERIC_EMAIL_DOMAINS.includes(domain.toLowerCase());
};

// Retry wrapper with exponential backoff for rate-limited APIs
const callWithRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 5,
  baseDelayMs: number = 2000,
  operationName: string = 'API call'
): Promise<T | null> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      const isRateLimited = error.message?.includes('429') || 
                            error.message?.toLowerCase().includes('rate') ||
                            error.message?.toLowerCase().includes('limit');
      
      if (isRateLimited && attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(3, attempt) + Math.random() * 1000;
        console.log(`[enrich-internal-first] ${operationName} rate limited, waiting ${Math.round(delay/1000)}s before retry ${attempt + 1}/${maxRetries}`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      
      console.error(`[enrich-internal-first] ${operationName} failed after ${attempt + 1} attempts:`, error.message);
      return null;
    }
  }
  return null;
};

// Track failure reasons for better analytics
interface FailureTracking {
  rate_limited: number;
  personal_domain: number;
  not_in_database: number;
  api_error: number;
  no_data_found: number;
  validation_rejected: number;
  smb_apollo_skip: number;
  smb_pdl_skip: number;
}

// Validate phone number - filter out coordinates and garbage data
const isValidPhone = (phone: string): boolean => {
  if (!phone) return false;
  const digits = String(phone).replace(/\D/g, '');
  // Must be 7-15 digits
  if (digits.length < 7 || digits.length > 15) return false;
  // Reject decimals (coordinates like 117.3601186)
  if (String(phone).includes('.') && /^\d+\.\d+$/.test(String(phone).trim())) return false;
  // Reject all same digit (1111111)
  if (/^(\d)\1+$/.test(digits)) return false;
  // Reject if looks like a year or small number
  if (digits.length <= 4) return false;
  return true;
};

// Sanitize phone number to E.164 format
const sanitizePhone = (phone: any): string | null => {
  if (!phone) return null;
  if (!isValidPhone(String(phone))) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 7) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return null;
};

// ============= NEW: Direct regex extraction from markdown =============

// Extract phone number directly from markdown (regex-based, before AI)
const extractPhoneFromMarkdown = (markdown: string): string | null => {
  if (!markdown) return null;
  
  const phonePatterns = [
    // Standard US formats: (918) 438-0288, 918-438-0288, 918.438.0288
    /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    // With country code: +1 918 438 0288, +1-918-438-0288
    /\+1[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g,
    // Toll-free: 1-800-123-4567
    /1[-.\s]?8\d{2}[-.\s]?\d{3}[-.\s]?\d{4}/g
  ];
  
  for (const pattern of phonePatterns) {
    const matches = markdown.match(pattern);
    if (matches && matches.length > 0) {
      // Filter out fake numbers (555-xxxx)
      const validMatch = matches.find(m => !m.includes('555'));
      if (validMatch) {
        const sanitized = sanitizePhone(validMatch);
        if (sanitized) {
          console.log(`[extractPhoneFromMarkdown] Found phone via regex: ${sanitized}`);
          return sanitized;
        }
      }
    }
  }
  return null;
};

// Extract address directly from markdown (regex-based)
const extractAddressFromMarkdown = (markdown: string): { 
  address?: string; 
  city?: string; 
  state?: string; 
  zip?: string; 
} | null => {
  if (!markdown) return null;
  
  // US state abbreviations
  const stateAbbrs = 'AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY';
  
  // Pattern: 123 Main St, City, ST 12345
  const addressPattern = new RegExp(
    `(\\d+\\s+[A-Za-z0-9\\s,]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Circle|Cir|Court|Ct|Place|Pl)[\\.,]?\\s*,?\\s*[A-Za-z\\s]+,\\s*(${stateAbbrs})\\s*(\\d{5}(?:-\\d{4})?))`,
    'i'
  );
  
  const match = markdown.match(addressPattern);
  if (match) {
    const fullAddress = match[1].trim();
    const state = match[2]?.toUpperCase();
    const zip = match[3];
    
    // Try to extract city from the address
    const cityPattern = new RegExp(`,\\s*([A-Za-z\\s]+),\\s*${state}`, 'i');
    const cityMatch = fullAddress.match(cityPattern);
    const city = cityMatch ? cityMatch[1].trim() : undefined;
    
    console.log(`[extractAddressFromMarkdown] Found address via regex: ${fullAddress}`);
    
    return {
      address: fullAddress,
      city,
      state,
      zip
    };
  }
  
  return null;
};

// Get list of missing required fields
const getMissingFields = (data: Record<string, any>): string[] => {
  const required = ['employee_count', 'industry_norm', 'phone', 'hq_city', 'hq_state', 'hq_address'];
  return required.filter(f => !data[f] || data[f] === '');
};

// ============= NEW: Firecrawl Google Search =============

const searchWithFirecrawl = async (query: string): Promise<any[]> => {
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlKey) return [];
  
  try {
    console.log(`[searchWithFirecrawl] Searching: ${query}`);
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query, 
        limit: 5,
        scrapeOptions: { formats: ['markdown'] }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`[searchWithFirecrawl] Got ${data.data?.length || 0} results`);
      return data.data || [];
    }
  } catch (e) {
    console.error('[searchWithFirecrawl] Error:', e);
  }
  return [];
};

// ============= NEW: Multi-page Firecrawl scraping =============

const scrapeMultiplePagesWithFirecrawl = async (domain: string): Promise<string> => {
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlKey) return '';
  
  const pagesToScrape = [
    `https://${domain}`,
    `https://${domain}/contact`,
    `https://${domain}/about`,
    `https://${domain}/about-us`
  ];
  
  let combinedMarkdown = '';
  let successCount = 0;
  
  for (const url of pagesToScrape) {
    if (successCount >= 2) break; // Stop after 2 successful pages
    
    try {
      console.log(`[scrapeMultiplePagesWithFirecrawl] Scraping: ${url}`);
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
          onlyMainContent: false,
          waitFor: 2000
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const markdown = data.data?.markdown || data.markdown || '';
        if (markdown && markdown.length > 100) {
          combinedMarkdown += `\n\n--- ${url} ---\n${markdown}`;
          successCount++;
          console.log(`[scrapeMultiplePagesWithFirecrawl] Got ${markdown.length} chars from ${url}`);
        }
      }
    } catch (e) {
      console.log(`[scrapeMultiplePagesWithFirecrawl] Error on ${url}:`, e);
    }
  }
  
  return combinedMarkdown;
};

// ============= AI Provider Functions =============

// Verify email using Hunter.io
const verifyEmailWithHunter = async (email: string): Promise<{ status: string; score: number } | null> => {
  const hunterKey = Deno.env.get('HUNTER_API_KEY');
  if (!hunterKey) return null;
  
  try {
    const response = await fetch(
      `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${hunterKey}`,
      { method: 'GET' }
    );
    
    if (response.ok) {
      const data = await response.json();
      return {
        status: data.data?.status || 'unknown',
        score: data.data?.score || 0
      };
    }
  } catch (e) {
    console.error('[enrich-internal-first] Hunter verification error:', e);
  }
  
  return null;
};

// Use AI for phone discovery with multi-provider fallback
const discoverPhoneWithAI = async (
  personName: string,
  companyName: string,
  domain: string
): Promise<{ phone?: string; mobile?: string; direct_phone?: string; phones?: any[]; citations?: string[]; provider?: string } | null> => {
  const prompt = `Find phone numbers for ${personName} at ${companyName} (${domain}).

Search for:
1. Direct business phone/extension
2. Mobile/cell phone number
3. Company main line

Return ONLY valid JSON:
{
  "phone": "main direct phone or null",
  "mobile": "mobile/cell phone or null", 
  "direct_phone": "direct line with extension or null",
  "all_phones": [
    {"number": "+1...", "type": "mobile|direct|office", "confidence": 0-100}
  ]
}`;

  try {
    // Use callAI which falls back: Perplexity → Claude → Grok → Gemini → GPT
    const response = await callAI('research', [
      { role: 'system', content: 'You are a B2B contact researcher. Find verified phone numbers from web sources. Return only JSON.' },
      { role: 'user', content: prompt }
    ], {
      maxTokens: 500,
      search_recency_filter: 'year'
    });

    if (!response.ok) {
      console.error(`[enrich-internal-first] All AI providers failed for phone discovery`);
      return null;
    }

    const data = await response.json();
    
    // Handle different response formats (Anthropic vs OpenAI-style)
    let content = '';
    if (data.content && Array.isArray(data.content)) {
      // Anthropic format
      content = data.content.find((c: any) => c.type === 'text')?.text || '';
    } else {
      // OpenAI format
      content = data.choices?.[0]?.message?.content || '';
    }
    
    const citations = data.citations || [];
    
    console.log('[enrich-internal-first] AI phone response:', content.substring(0, 200));
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        phone: sanitizePhone(parsed.phone) || undefined,
        mobile: sanitizePhone(parsed.mobile) || undefined,
        direct_phone: sanitizePhone(parsed.direct_phone) || undefined,
        phones: (parsed.all_phones || []).map((p: any) => ({
          number: sanitizePhone(p.number),
          type: p.type,
          confidence: p.confidence,
          source: 'ai-fallback'
        })).filter((p: any) => p.number),
        citations,
        provider: 'ai-fallback'
      };
    }
    
    return null;
  } catch (error: any) {
    console.error('[enrich-internal-first] AI phone discovery error:', error.message);
    return null;
  }
};

// Use AI for SMB firmographic discovery with multi-provider fallback
const discoverFirmographicsWithAI = async (
  companyName: string,
  domain: string
): Promise<{ 
  industry?: string; 
  employee_estimate?: number; 
  city?: string; 
  state?: string;
  phone?: string;
  address?: string;
  zip?: string;
  naics?: string;
  sic?: string;
  revenue_hint?: string;
  citations?: string[];
  provider?: string;
} | null> => {
  console.log(`[enrich-internal-first] AI firmographic discovery for ${companyName} (${domain})`);
  
  const prompt = `Find business information for ${companyName} (${domain}).

Search Google, Yelp, LinkedIn, BBB, Yellow Pages, ZoomInfo, and company website for:
1. Industry/business type
2. Company size (employees)
3. Location (full street address, city, state, zip)
4. Phone number
5. Revenue (if available)
6. NAICS/SIC codes

Return ONLY valid JSON:
{
  "industry": "Primary industry (e.g., Towing & Recovery, Auto Repair, Restaurant)",
  "employee_count": number or null,
  "employee_range": "1-10 | 11-50 | 51-200 | 201-500 | 500+",
  "city": "headquarters city or null",
  "state": "headquarters state (2-letter code) or null",
  "address": "full street address or null",
  "zip": "zip code or null",
  "phone": "main business phone or null",
  "revenue_hint": "any revenue mentioned (e.g., '$7.9M', '$5M-$10M') or null",
  "naics": "6-digit NAICS code or null",
  "sic": "4-digit SIC code or null",
  "business_type": "local_service | retail | restaurant | professional_service | other"
}`;

  try {
    // Use callAI which falls back: Perplexity → Claude → Grok → Gemini → GPT
    const response = await callAI('research', [
      { role: 'system', content: 'You are a business researcher. Find company information from public sources. Return only JSON.' },
      { role: 'user', content: prompt }
    ], {
      maxTokens: 800,
      search_recency_filter: 'year'
    });

    if (!response.ok) {
      console.error(`[enrich-internal-first] All AI providers failed for firmographic discovery`);
      return null;
    }

    const data = await response.json();
    
    // Handle different response formats (Anthropic vs OpenAI-style)
    let content = '';
    if (data.content && Array.isArray(data.content)) {
      content = data.content.find((c: any) => c.type === 'text')?.text || '';
    } else {
      content = data.choices?.[0]?.message?.content || '';
    }
    
    const citations = data.citations || [];
    
    console.log('[enrich-internal-first] AI firmographic response:', content.substring(0, 300));
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Map employee range to estimate
      const employeeMap: Record<string, number> = {
        '1-10': 5, '11-50': 25, '51-200': 100, '201-500': 350, '500+': 750
      };
      
      return {
        industry: parsed.industry || undefined,
        employee_estimate: parsed.employee_count || employeeMap[parsed.employee_range] || undefined,
        city: parsed.city || undefined,
        state: parsed.state || undefined,
        phone: sanitizePhone(parsed.phone) || undefined,
        address: parsed.address || undefined,
        zip: parsed.zip || undefined,
        naics: parsed.naics || undefined,
        sic: parsed.sic || undefined,
        revenue_hint: parsed.revenue_hint || undefined,
        citations,
        provider: 'ai-fallback'
      };
    }
    
    return null;
  } catch (error: any) {
    console.error('[enrich-internal-first] AI firmographic discovery error:', error.message);
    return null;
  }
};

// Use AI to discover person details (title, phone, linkedin)
const discoverPersonWithAI = async (
  email: string, 
  domain: string, 
  firstName?: string, 
  lastName?: string,
  companyName?: string
): Promise<{ title?: string; phone?: string; mobile?: string; linkedin_url?: string; level?: string; persona?: string } | null> => {
  const providers = getAvailableProviders();
  if (providers.length === 0) return null;
  
  const personName = [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0];
  
  const prompt = `Find professional details for this person. Return ONLY valid JSON, no other text.

Person: ${personName}
Email: ${email}
Company: ${companyName || 'Unknown'}
Company Domain: ${domain}

Return JSON format:
{
  "title": "Job Title or null",
  "phone": "Direct phone number or null",
  "mobile": "Mobile phone or null",
  "linkedin_url": "LinkedIn profile URL or null"
}

If you cannot find reliable information for a field, use null. Be conservative - only include verified data.`;

  try {
    const aiResponse = await callAI('research', [
      { role: 'system', content: 'You are a B2B researcher. Find professional contact details. Return only valid JSON.' },
      { role: 'user', content: prompt }
    ]);

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || '';
      
      console.log('[enrich-internal-first] AI person response:', content.substring(0, 200));
      
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const title = parsed.title || undefined;
        const classification = title ? classifyTitle(title) : { level: undefined, persona: undefined };
        
        return {
          title,
          phone: sanitizePhone(parsed.phone) || undefined,
          mobile: sanitizePhone(parsed.mobile) || undefined,
          linkedin_url: parsed.linkedin_url || undefined,
          level: classification.level,
          persona: classification.persona
        };
      }
    }
  } catch (e) {
    console.error('[enrich-internal-first] AI person discovery error:', e);
  }
  
  return null;
};

// Discover domain for company name using AI
const discoverDomainForCompany = async (companyName: string, supabase: any, orgId: string): Promise<string | null> => {
  // First check internal accounts
  const { data: existingAccounts } = await supabase
    .from('accounts')
    .select('domain, name')
    .eq('org_id', orgId)
    .not('domain', 'is', null);

  // Fuzzy match against existing accounts
  const normalized = companyName.toLowerCase().trim()
    .replace(/\s+(inc\.?|llc|ltd\.?|corp\.?|corporation|company|co\.?)$/i, '')
    .trim();

  for (const account of existingAccounts || []) {
    if (!account.name) continue;
    const accountNormalized = account.name.toLowerCase().trim()
      .replace(/\s+(inc\.?|llc|ltd\.?|corp\.?|corporation|company|co\.?)$/i, '')
      .trim();
    
    if (accountNormalized === normalized || 
        accountNormalized.includes(normalized) || 
        normalized.includes(accountNormalized)) {
      return account.domain;
    }
  }

  // Try AI discovery
  const providers = getAvailableProviders();
  if (providers.length > 0) {
    try {
      const aiResponse = await callAI('research', [
        { role: 'system', content: 'You are a business researcher. Return ONLY the domain name (e.g., "microsoft.com") for the company. No explanation, just the domain.' },
        { role: 'user', content: `What is the official website domain for "${companyName}"?` }
      ]);

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content?.trim() || '';
        // Clean the response - should be just a domain
        const cleanDomain = content.toLowerCase()
          .replace(/^(https?:\/\/)?(www\.)?/, '')
          .replace(/['"]/g, '')
          .split('/')[0]
          .split(' ')[0]; // Take first word if AI returned extra text
        
        if (cleanDomain && cleanDomain.includes('.') && !cleanDomain.includes(' ')) {
          return cleanDomain;
        }
      }
    } catch (e) {
      console.error('[enrich-internal-first] AI domain discovery error:', e);
    }
  }

  return null;
};

// Map revenue to standard ranges
const mapRevenueToRange = (revenue: number | string | null | undefined): string | null => {
  if (!revenue) return null;
  
  let value: number;
  if (typeof revenue === 'string') {
    // Parse string like "$7.9M" or "5000000"
    const match = revenue.match(/\$?(\d+(?:\.\d+)?)\s*(million|billion|M|B|K)?/i);
    if (!match) return null;
    value = parseFloat(match[1]);
    const unit = (match[2] || '').toLowerCase();
    if (unit === 'b' || unit === 'billion') value *= 1000000000;
    else if (unit === 'm' || unit === 'million') value *= 1000000;
    else if (unit === 'k') value *= 1000;
  } else {
    value = revenue;
  }
  
  if (value < 1000000) return '$0-$1M';
  if (value < 5000000) return '$1M-$5M';
  if (value < 10000000) return '$5M-$10M';
  if (value < 25000000) return '$10M-$25M';
  if (value < 50000000) return '$25M-$50M';
  if (value < 100000000) return '$50M-$100M';
  if (value < 500000000) return '$100M-$500M';
  if (value < 1000000000) return '$500M-$1B';
  if (value < 10000000000) return '$1B-$10B';
  return '$10B+';
};

// Threshold for async processing
const ASYNC_THRESHOLD = 10;
const CHUNK_SIZE = 20;
const CONCURRENCY_LIMIT = 3;
const HEARTBEAT_INTERVAL_MS = 15000;
const INTER_CHUNK_DELAY_MS = 500;

// Simple concurrency limiter (p-limit pattern)
function createLimiter(concurrency: number) {
  let running = 0;
  const queue: (() => void)[] = [];
  
  const next = () => {
    if (queue.length > 0 && running < concurrency) {
      running++;
      const fn = queue.shift()!;
      fn();
    }
  };
  
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
      queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (e) {
          reject(e);
        } finally {
          running--;
          next();
        }
      });
      next();
    });
  };
}

// ============= MAIN ENRICHMENT FUNCTION - WEBSITE-FIRST STRATEGY =============

// Process a single input through all enrichment phases - NEW ORDER
async function processSingleInput(
  input: EnrichmentInput,
  supabase: any,
  orgId: string,
  forceExternal: boolean,
  skipAi: boolean
): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    input,
    enriched_data: {},
    source: 'internal',
    confidence: 0,
    fields_filled: [],
    api_calls_saved: false,
    domain_discovered: false,
    verified_fields: new Set<string>()
  };
  
  const verifiedFields = new Set<string>(); // Track fields from website (ground truth)

  console.log(`[processSingleInput] Starting WEBSITE-FIRST for ${input.email || input.domain || 'unknown'}`);

  // ============= STEP 1: Extract basic data from input =============
  const domain = input.domain || extractDomain(input.email || '');
  const extractedName = extractNameFromEmail(input.email || '');
  
  result.enriched_data.email = input.email;
  result.enriched_data.domain = domain || undefined;
  result.enriched_data.first_name = input.first_name || extractedName.first_name;
  result.enriched_data.last_name = input.last_name || extractedName.last_name;
  result.enriched_data.title = input.title;
  
  if (input.title) {
    const classification = classifyTitle(input.title);
    result.enriched_data.level = classification.level;
    result.enriched_data.persona = classification.persona;
  }

  // Skip personal email domains
  if (domain && isGenericEmailDomain(domain)) {
    result.source = 'internal';
    result.enriched_data.skip_reason = 'personal_email_domain';
    console.log(`[processSingleInput] Skipping personal domain: ${domain}`);
    return result;
  }

  // ============= STEP 2: Internal lookup (only if not force_external) =============
  if (!forceExternal && domain) {
    const { data: existingAccount } = await supabase
      .from('accounts')
      .select('*')
      .eq('org_id', orgId)
      .ilike('domain', `%${domain}%`)
      .limit(1)
      .single();
    
    if (existingAccount && calculateCompleteness(existingAccount) >= 60) {
      result.enriched_data = {
        ...result.enriched_data,
        employee_count: existingAccount.employee_count,
        revenue_range: existingAccount.revenue_range,
        industry_norm: existingAccount.industry_norm,
        country: existingAccount.country,
        linkedin_url: result.enriched_data.linkedin_url || existingAccount.linkedin_url,
        company_name: existingAccount.name,
        hq_city: existingAccount.hq_city,
        hq_state: existingAccount.hq_state,
        hq_address: existingAccount.hq_address,
        phone: existingAccount.phone || existingAccount.company_main_phone
      };
      result.source = 'internal';
      result.confidence = existingAccount.enrichment_confidence || 0.8;
      result.api_calls_saved = true;
      console.log(`[processSingleInput] Found complete internal data for ${domain}`);
      
      // Still continue to verify with website if possible, but we have fallback
    }
  }

  // ============= STEP 3: Perplexity/AI Search FIRST (free/cheap) =============
  const hasCompanyData = result.enriched_data.employee_count || result.enriched_data.industry_norm;
  
  if (!hasCompanyData && domain && !skipAi) {
    console.log(`[processSingleInput] Step 3: Perplexity AI search for ${domain}`);
    
    const companyName = input.company_name || result.enriched_data.company_name || domain.split('.')[0];
    const aiData = await discoverFirmographicsWithAI(companyName, domain);
    
    if (aiData) {
      // Store AI data but it can be overwritten by website data
      result.enriched_data.company_name = result.enriched_data.company_name || aiData.industry;
      result.enriched_data.industry_norm = result.enriched_data.industry_norm || aiData.industry;
      result.enriched_data.employee_count = result.enriched_data.employee_count || aiData.employee_estimate;
      result.enriched_data.hq_city = result.enriched_data.hq_city || aiData.city;
      result.enriched_data.hq_state = result.enriched_data.hq_state || aiData.state;
      result.enriched_data.hq_address = result.enriched_data.hq_address || aiData.address;
      result.enriched_data.hq_postal_code = result.enriched_data.hq_postal_code || aiData.zip;
      result.enriched_data.naics = result.enriched_data.naics || aiData.naics;
      result.enriched_data.sic_code = result.enriched_data.sic_code || aiData.sic;
      result.enriched_data.revenue_range = result.enriched_data.revenue_range || mapRevenueToRange(aiData.revenue_hint);
      
      // Phone from AI is LOW confidence - can be overwritten
      if (aiData.phone && !result.enriched_data.phone) {
        result.enriched_data.phone = aiData.phone;
      }
      
      result.source = 'perplexity';
      result.confidence = 0.7;
      console.log(`[processSingleInput] Perplexity found: industry=${aiData.industry}, employees=${aiData.employee_estimate}`);
    }
  }

  // ============= STEP 4: Firecrawl Website Scrape SECOND (ground truth) =============
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  
  if (firecrawlKey && domain) {
    console.log(`[processSingleInput] Step 4: Firecrawl website scrape for ${domain} (multiple pages)`);
    
    // Scrape homepage + /contact + /about
    const combinedMarkdown = await scrapeMultiplePagesWithFirecrawl(domain);
    
    if (combinedMarkdown && combinedMarkdown.length > 100) {
      // FIRST: Extract phone and address DIRECTLY from markdown (regex)
      // This is GROUND TRUTH - takes precedence over AI
      const websitePhone = extractPhoneFromMarkdown(combinedMarkdown);
      const websiteAddress = extractAddressFromMarkdown(combinedMarkdown);
      
      if (websitePhone) {
        result.enriched_data.phone = websitePhone;
        result.enriched_data.company_main_phone = websitePhone;
        verifiedFields.add('phone');
        console.log(`[processSingleInput] Website phone (VERIFIED): ${websitePhone}`);
      }
      
      if (websiteAddress) {
        if (websiteAddress.address) {
          result.enriched_data.hq_address = websiteAddress.address;
          verifiedFields.add('hq_address');
        }
        if (websiteAddress.city) {
          result.enriched_data.hq_city = websiteAddress.city;
          verifiedFields.add('hq_city');
        }
        if (websiteAddress.state) {
          result.enriched_data.hq_state = websiteAddress.state;
          verifiedFields.add('hq_state');
        }
        if (websiteAddress.zip) {
          result.enriched_data.hq_postal_code = websiteAddress.zip;
          verifiedFields.add('hq_postal_code');
        }
        console.log(`[processSingleInput] Website address (VERIFIED): ${websiteAddress.address}`);
      }
      
      // SECOND: Use AI to extract additional info from website content
      if (!skipAi) {
        const extractPrompt = `Extract company information from this website content. Return ONLY valid JSON:

{
  "company_name": "Official company name",
  "industry": "Primary industry/service type (e.g., Towing & Recovery, Restaurant, Retail)",
  "sub_industry": "More specific category or null",
  "city": "City from address on website or null",
  "state": "State (2-letter code) from address or null",
  "address": "Full street address or null",
  "zip": "Zip code or null",
  "phone": "Main phone number found on website or null",
  "employee_estimate": "1-10 | 11-50 | 51-200 | 201-500 | 500+ | null",
  "services": ["list of services or products offered"],
  "sic_code": "4-digit SIC code based on industry or null",
  "naics": "6-digit NAICS code based on industry or null",
  "revenue_hint": "any revenue mentioned or null",
  "year_founded": "year if mentioned or null"
}

Look carefully for:
- Phone numbers in header, footer, or contact page
- Full address in footer or contact section
- "About Us" content for company size/history
- Industry from services offered

Website (${domain}):
${combinedMarkdown.substring(0, 6000)}`;

        try {
          const extractResponse = await callAI('enrichment', [
            { role: 'system', content: 'Extract business information from website content. Be thorough - look for address in footer, phone numbers, industry keywords. Return only valid JSON.' },
            { role: 'user', content: extractPrompt }
          ]);
          
          if (extractResponse.ok) {
            const extractData = await extractResponse.json();
            const extractContent = extractData.choices?.[0]?.message?.content || '';
            
            const jsonMatch = extractContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const extracted = JSON.parse(jsonMatch[0]);
              
              // Map employee estimate to count
              const employeeMap: Record<string, number> = {
                '1-10': 5, '11-50': 25, '51-200': 100, '201-500': 350, '500+': 750
              };
              
              // Update fields ONLY if not already verified from regex extraction
              if (!verifiedFields.has('phone') && extracted.phone) {
                const sanitized = sanitizePhone(extracted.phone);
                if (sanitized) {
                  result.enriched_data.phone = sanitized;
                  result.enriched_data.company_main_phone = sanitized;
                }
              }
              
              if (!verifiedFields.has('hq_address') && extracted.address) {
                result.enriched_data.hq_address = extracted.address;
              }
              
              if (!verifiedFields.has('hq_city') && extracted.city) {
                result.enriched_data.hq_city = extracted.city;
              }
              
              if (!verifiedFields.has('hq_state') && extracted.state) {
                result.enriched_data.hq_state = extracted.state;
              }
              
              if (!verifiedFields.has('hq_postal_code') && extracted.zip) {
                result.enriched_data.hq_postal_code = extracted.zip;
              }
              
              // These fields don't need regex verification
              result.enriched_data.company_name = result.enriched_data.company_name || extracted.company_name;
              result.enriched_data.industry_norm = result.enriched_data.industry_norm || extracted.industry;
              result.enriched_data.sub_industry = result.enriched_data.sub_industry || extracted.sub_industry;
              result.enriched_data.employee_count = result.enriched_data.employee_count || employeeMap[extracted.employee_estimate];
              result.enriched_data.sic_code = result.enriched_data.sic_code || extracted.sic_code;
              result.enriched_data.naics = result.enriched_data.naics || extracted.naics;
              result.enriched_data.founded_year = result.enriched_data.founded_year || extracted.year_founded;
              
              if (extracted.revenue_hint && !result.enriched_data.revenue_range) {
                result.enriched_data.revenue_range = mapRevenueToRange(extracted.revenue_hint);
              }
              
              result.source = 'firecrawl';
              result.confidence = 0.85;
              
              console.log(`[processSingleInput] Firecrawl AI extracted: company=${extracted.company_name}, industry=${extracted.industry}, phone=${extracted.phone}`);
            }
          }
        } catch (e) {
          console.error(`[processSingleInput] Firecrawl AI extraction error:`, e);
        }
      }
      
      // Check for SMB indicators
      const smbDetection = detectSMBFromContent(combinedMarkdown);
      if (smbDetection.isSMB && !result.enriched_data.employee_count) {
        result.enriched_data.employee_count = smbDetection.employeeEstimate || 10;
        console.log(`[processSingleInput] SMB detected from content, estimating employees: 10`);
      }
      
      // Domain-based industry detection as fallback
      if (!result.enriched_data.industry_norm) {
        const domainIndustry = detectIndustryFromDomain(domain);
        if (domainIndustry) {
          result.enriched_data.industry_norm = domainIndustry;
          console.log(`[processSingleInput] Industry from domain: ${domainIndustry}`);
        }
      }
    }
  }

  // ============= STEP 5: Google Search via Firecrawl (for additional data) =============
  const stillMissingRevenue = !result.enriched_data.revenue_range;
  const stillMissingEmployees = !result.enriched_data.employee_count;
  
  if (firecrawlKey && domain && (stillMissingRevenue || stillMissingEmployees)) {
    console.log(`[processSingleInput] Step 5: Google search for ${domain} (missing: revenue=${stillMissingRevenue}, employees=${stillMissingEmployees})`);
    
    const companyName = result.enriched_data.company_name || domain.split('.')[0];
    const searchResults = await searchWithFirecrawl(`"${companyName}" ${domain} revenue employees company size`);
    
    if (searchResults.length > 0 && !skipAi) {
      // Combine search results for AI analysis
      const searchContent = searchResults.map(r => r.markdown || r.description || '').join('\n\n').substring(0, 4000);
      
      if (searchContent.length > 100) {
        try {
          const searchPrompt = `Extract company information from these search results for ${companyName} (${domain}). Return ONLY valid JSON:

{
  "employee_count": number or null,
  "revenue_estimate": "dollar amount like $7.9M or null",
  "industry": "industry or null",
  "year_founded": number or null
}

Search results:
${searchContent}`;

          const searchAiResponse = await callAI('enrichment', [
            { role: 'system', content: 'Extract business information from search results. Return only valid JSON.' },
            { role: 'user', content: searchPrompt }
          ]);
          
          if (searchAiResponse.ok) {
            const searchData = await searchAiResponse.json();
            const content = searchData.choices?.[0]?.message?.content || '';
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
              const extracted = JSON.parse(jsonMatch[0]);
              
              if (extracted.employee_count && !result.enriched_data.employee_count) {
                const validated = validateEmployeeCount(extracted.employee_count, domain, companyName);
                if (validated) {
                  result.enriched_data.employee_count = validated;
                  console.log(`[processSingleInput] Google search found employees: ${validated}`);
                }
              }
              
              if (extracted.revenue_estimate && !result.enriched_data.revenue_range) {
                const revenueRange = mapRevenueToRange(extracted.revenue_estimate);
                if (revenueRange) {
                  result.enriched_data.revenue_range = revenueRange;
                  console.log(`[processSingleInput] Google search found revenue: ${revenueRange}`);
                }
              }
              
              result.source = 'google_search';
            }
          }
        } catch (e) {
          console.error(`[processSingleInput] Google search AI error:`, e);
        }
      }
    }
  }

  // ============= STEP 6: PDL (only if still missing key data) =============
  const hasKeyData = result.enriched_data.employee_count || result.enriched_data.industry_norm;
  const PDL_API_KEY = Deno.env.get('PDL_API_KEY');
  
  // Skip PDL for SMBs - they won't be in PDL's B2B database
  const companyName = result.enriched_data.company_name || input.company_name || '';
  const isSMB = isLikelySMB(companyName, domain);
  
  if (!hasKeyData && PDL_API_KEY && domain && !isSMB) {
    console.log(`[processSingleInput] Step 6: PDL fallback for ${domain}`);
    
    try {
      const response = await withHttpRetry(
        () => fetch(`https://api.peopledatalabs.com/v5/company/enrich?website=${encodeURIComponent(domain)}`, {
          method: 'GET',
          headers: { 'X-Api-Key': PDL_API_KEY }
        }),
        { ...DEFAULT_RETRY_CONFIG, maxRetries: 2 }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.name && (data.size || data.industry)) {
          const validatedEmployeeCount = validateEmployeeCount(data.size, domain, data.name);
          
          // Only fill fields not already verified from website
          if (!verifiedFields.has('phone') && data.phone) {
            result.enriched_data.phone = sanitizePhone(data.phone);
          }
          
          result.enriched_data.employee_count = result.enriched_data.employee_count || validatedEmployeeCount;
          result.enriched_data.revenue_range = result.enriched_data.revenue_range || mapRevenueToRange(data.estimated_annual_revenue);
          result.enriched_data.industry_norm = result.enriched_data.industry_norm || data.industry;
          result.enriched_data.country = result.enriched_data.country || data.location?.country;
          result.enriched_data.company_name = result.enriched_data.company_name || data.name;
          result.enriched_data.linkedin_url = result.enriched_data.linkedin_url || data.linkedin_url;
          
          result.source = 'pdl';
          result.confidence = 0.85;
          console.log(`[processSingleInput] PDL found: ${data.name}, employees=${validatedEmployeeCount}`);
        }
      }
    } catch (e) {
      console.error('[processSingleInput] PDL error:', e);
    }
  } else if (isSMB) {
    console.log(`[processSingleInput] Skipping PDL for SMB: ${domain}`);
  }

  // ============= STEP 7: Apollo (LAST resort) =============
  const stillMissingKeyData = !result.enriched_data.employee_count && !result.enriched_data.industry_norm;
  const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
  
  if (stillMissingKeyData && APOLLO_API_KEY && domain && !isSMB) {
    console.log(`[processSingleInput] Step 7: Apollo LAST RESORT for ${domain}`);
    
    try {
      const response = await withHttpRetry(
        () => fetch('https://api.apollo.io/v1/organizations/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: APOLLO_API_KEY, domain })
        }),
        { ...DEFAULT_RETRY_CONFIG, maxRetries: 2 }
      );
      
      if (response.ok) {
        const data = await response.json();
        const org = data.organization;
        if (org && (org.estimated_num_employees || org.industry)) {
          const validatedEmployeeCount = validateEmployeeCount(org.estimated_num_employees, domain, org.name);
          
          // Only fill fields not already verified from website
          if (!verifiedFields.has('phone') && org.phone) {
            result.enriched_data.phone = sanitizePhone(org.phone);
          }
          
          result.enriched_data.employee_count = result.enriched_data.employee_count || validatedEmployeeCount;
          result.enriched_data.revenue_range = result.enriched_data.revenue_range || mapRevenueToRange(org.estimated_annual_revenue);
          result.enriched_data.industry_norm = result.enriched_data.industry_norm || org.industry;
          result.enriched_data.country = result.enriched_data.country || org.country;
          result.enriched_data.company_name = result.enriched_data.company_name || org.name;
          result.enriched_data.linkedin_url = result.enriched_data.linkedin_url || org.linkedin_url;
          
          result.source = 'apollo';
          result.confidence = 0.95;
          console.log(`[processSingleInput] Apollo found: ${org.name}, employees=${validatedEmployeeCount}`);
        }
      }
    } catch (e) {
      console.error('[processSingleInput] Apollo error:', e);
    }
  } else if (isSMB) {
    console.log(`[processSingleInput] Skipping Apollo for SMB: ${domain}`);
  }

  // ============= STEP 8: Person enrichment (if email provided) =============
  if (input.email && (!result.enriched_data.title || !result.enriched_data.phone) && !skipAi) {
    console.log(`[processSingleInput] Step 8: Person enrichment for ${input.email}`);
    
    const personData = await discoverPersonWithAI(
      input.email,
      domain,
      result.enriched_data.first_name,
      result.enriched_data.last_name,
      result.enriched_data.company_name
    );
    
    if (personData) {
      if (personData.title && !result.enriched_data.title) {
        result.enriched_data.title = personData.title;
        result.enriched_data.level = personData.level;
        result.enriched_data.persona = personData.persona;
      }
      // Only use AI phone if we don't have a verified website phone
      if (personData.phone && !verifiedFields.has('phone') && !result.enriched_data.phone) {
        result.enriched_data.phone = personData.phone;
      }
      if (personData.mobile && !result.enriched_data.mobile) {
        result.enriched_data.mobile = personData.mobile;
      }
      if (personData.linkedin_url && !result.enriched_data.linkedin_url) {
        result.enriched_data.linkedin_url = personData.linkedin_url;
      }
    }
  }

  // ============= STEP 9: Hunter Email verification =============
  const hunterKey = Deno.env.get('HUNTER_API_KEY');
  if (hunterKey && input.email && !result.enriched_data.email_status) {
    console.log(`[processSingleInput] Step 9: Hunter email verification for ${input.email}`);
    const verification = await verifyEmailWithHunter(input.email);
    if (verification) {
      result.enriched_data.email_status = verification.status;
      result.enriched_data.email_score = verification.score;
    }
  }

  // Calculate fields filled
  result.fields_filled = Object.keys(result.enriched_data).filter(k => 
    result.enriched_data[k] != null && result.enriched_data[k] !== ''
  );
  
  // Add source tracking for debugging
  result.enriched_data._enrichment_source = result.source;
  result.enriched_data._verified_fields = Array.from(verifiedFields);

  console.log(`[processSingleInput] DONE for ${domain}: source=${result.source}, fields=${result.fields_filled.length}, verified=${Array.from(verifiedFields).join(',')}`);

  return result;
}

// ============= Background processing function =============

async function processLeadsInBackground(
  jobId: string,
  inputs: EnrichmentInput[],
  supabase: any,
  orgId: string,
  forceExternal: boolean,
  skipAi: boolean,
  saveToDb: boolean,
  sourceType: string
): Promise<void> {
  console.log(`[enrich-internal-first] Background processing started for job ${jobId} with ${inputs.length} inputs`);
  
  let processed = 0;
  let completed = 0;
  let failed = 0;
  const results: EnrichmentResult[] = [];
  
  // Track enrichment sources for stats breakdown
  let internalMatches = 0;
  let apolloEnriched = 0;
  let pdlEnriched = 0;
  let aiEnriched = 0;
  let firecrawlEnriched = 0;
  
  // Domain cache to avoid redundant API calls for same company
  const domainCache = new Map<string, any>();
  
  // Set up heartbeat interval
  const heartbeatInterval = setInterval(async () => {
    try {
      await supabase.from('enrichment_jobs').update({
        last_heartbeat: new Date().toISOString(),
        processed_records: processed,
        rows_completed: completed,
        rows_failed: failed,
        enriched_records: completed,
        failed_records: failed,
        last_progress_update: new Date().toISOString()
      }).eq('id', jobId);
    } catch (e) {
      console.warn(`[enrich-internal-first] Heartbeat update failed:`, e);
    }
  }, HEARTBEAT_INTERVAL_MS);
  
  const limit = createLimiter(CONCURRENCY_LIMIT);
  
  try {
    for (let i = 0; i < inputs.length; i += CHUNK_SIZE) {
      const chunk = inputs.slice(i, i + CHUNK_SIZE);
      const chunkStartTime = Date.now();
      
      const chunkPromises = chunk.map((input) => 
        limit(async () => {
          try {
            const result = await processSingleInput(input, supabase, orgId, forceExternal, skipAi);
            
            if (saveToDb && result.enriched_data) {
              await saveEnrichmentResult(result, supabase, orgId, sourceType);
            }
            
            return { success: true, result };
          } catch (e) {
            console.error(`[enrich-internal-first] Error processing input:`, e);
            return {
              success: false,
              result: {
                input,
                enriched_data: { error: (e as Error).message },
                source: 'internal' as const,
                confidence: 0,
                fields_filled: [],
                api_calls_saved: false
              }
            };
          }
        })
      );
      
      const chunkResults = await Promise.allSettled(chunkPromises);
      
      for (const settledResult of chunkResults) {
        processed++;
        if (settledResult.status === 'fulfilled') {
          const { success, result } = settledResult.value;
          results.push(result);
          
          const isActualSuccess = success && (
            result.enriched_data?.employee_count || 
            result.enriched_data?.industry_norm ||
            (result.fields_filled?.length || 0) >= 3 ||
            (result.enriched_data?.company_name && (result.fields_filled?.length || 0) >= 2) ||
            (result.source && result.source !== 'none')
          );
          
          if (isActualSuccess) {
            completed++;
            const source = result.source?.toLowerCase() || 'none';
            
            if (source === 'internal' || source === 'domain_discovery') {
              internalMatches++;
            } else if (source === 'apollo' || source === 'hunter') {
              apolloEnriched++;
            } else if (source === 'pdl' || source === 'clearbit') {
              pdlEnriched++;
            } else if (source === 'firecrawl') {
              firecrawlEnriched++;
            } else if (source === 'ai' || source === 'perplexity' || source === 'google_search') {
              aiEnriched++;
            } else {
              internalMatches++;
            }
          } else {
            failed++;
          }
        } else {
          failed++;
          results.push({
            input: chunk[chunkResults.indexOf(settledResult)],
            enriched_data: { error: settledResult.reason?.message || 'Unknown error' },
            source: 'internal',
            confidence: 0,
            fields_filled: [],
            api_calls_saved: false
          });
        }
      }
      
      const chunkTime = ((Date.now() - chunkStartTime) / 1000).toFixed(1);
      console.log(`[enrich-internal-first] Job ${jobId}: processed ${processed}/${inputs.length} (chunk took ${chunkTime}s)`);
      
      await supabase.from('enrichment_jobs').update({
        processed_records: processed,
        rows_completed: completed,
        rows_failed: failed,
        enriched_records: completed,
        failed_records: failed,
        last_heartbeat: new Date().toISOString(),
        last_progress_update: new Date().toISOString()
      }).eq('id', jobId);
      
      if (i + CHUNK_SIZE < inputs.length) {
        await new Promise(r => setTimeout(r, INTER_CHUNK_DELAY_MS));
      }
    }
    
    const sourceBreakdown = {
      internal_matches: internalMatches,
      apollo_enriched: apolloEnriched,
      pdl_enriched: pdlEnriched,
      ai_enriched: aiEnriched,
      firecrawl_enriched: firecrawlEnriched
    };
    
    await supabase.from('enrichment_jobs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      processed_records: processed,
      rows_completed: completed,
      rows_failed: failed,
      enriched_records: completed,
      failed_records: failed,
      total_records: inputs.length,
      source_breakdown: sourceBreakdown
    }).eq('id', jobId);
    
    console.log(`[enrich-internal-first] Job ${jobId} completed: ${completed} success, ${failed} failed (internal: ${internalMatches}, apollo: ${apolloEnriched}, pdl: ${pdlEnriched}, ai: ${aiEnriched}, firecrawl: ${firecrawlEnriched})`);
    
  } catch (error) {
    console.error(`[enrich-internal-first] Job ${jobId} failed:`, error);
    await supabase.from('enrichment_jobs').update({
      status: 'failed',
      error_message: (error as Error).message,
      processed_records: processed,
      rows_completed: completed,
      rows_failed: failed,
      enriched_records: completed,
      failed_records: failed
    }).eq('id', jobId);
  } finally {
    clearInterval(heartbeatInterval);
  }
}

// Save enrichment result to database
async function saveEnrichmentResult(
  result: EnrichmentResult,
  supabase: any,
  orgId: string,
  sourceType: string
): Promise<void> {
  const email = result.input.email;
  const domain = result.enriched_data.domain || result.input.domain;
  const data = result.enriched_data;
  
  const isGenericDomain = domain && isGenericEmailDomain(domain);
  
  // Upsert lead if we have email
  if (email) {
    const leadData: any = {
      org_id: orgId,
      email: email.toLowerCase(),
      first_name: data.first_name,
      last_name: data.last_name,
      title: data.title,
      phone: isValidPhone(data.phone) ? data.phone : null,
      mobile: isValidPhone(data.mobile) ? data.mobile : null,
      direct_phone: isValidPhone(data.direct_phone) ? data.direct_phone : null,
      linkedin_url: data.linkedin_url,
      level: data.level,
      persona: data.persona,
      email_status: data.email_status,
      email_score: data.email_score,
      data_source: sourceType,
      enriched_at: new Date().toISOString()
    };
    
    // Add domain-linked data for company-domain leads
    if (!isGenericDomain && domain) {
      leadData.domain = domain.toLowerCase();
      leadData.company_name = data.company_name;
      leadData.industry = data.industry_norm || data.industry;
      leadData.employee_count = data.employee_count;
      leadData.revenue_range = data.revenue_range;
      leadData.country = data.country;
      leadData.state_province = data.hq_state;
      leadData.location_city = data.hq_city;
    }
    
    // Check if lead exists first
    const { data: existing } = await supabase
      .from('Leads')
      .select('id')
      .eq('org_id', orgId)
      .eq('email', email.toLowerCase())
      .maybeSingle();
    
    if (existing?.id) {
      const { error } = await supabase.from('Leads').update(leadData).eq('id', existing.id);
      if (error) {
        console.error(`[enrich-internal-first] Lead update failed for ${email}:`, error);
      }
    } else {
      const { error } = await supabase.from('Leads').insert(leadData);
      if (error) {
        console.error(`[enrich-internal-first] Lead insert failed for ${email}:`, error);
      }
    }
  }
  
  // Upsert account if we have domain AND it's not a generic domain
  if (domain && data.company_name && !isGenericDomain) {
    const accountData = {
      org_id: orgId,
      domain: domain.toLowerCase(),
      name: data.company_name,
      employee_count: data.employee_count,
      revenue_range: data.revenue_range,
      industry_norm: data.industry_norm,
      sub_industry: data.sub_industry,
      country: data.country,
      hq_city: data.hq_city,
      hq_state: data.hq_state,
      hq_address: data.hq_address,
      hq_postal_code: data.hq_postal_code,
      sic_code: data.sic_code,
      naics: data.naics,
      company_main_phone: isValidPhone(data.company_main_phone) ? data.company_main_phone : null,
      linkedin_url: data.linkedin_url,
      enriched_at: new Date().toISOString(),
      enriched_from: result.source,
      enrichment_confidence: result.confidence,
      data_source: sourceType
    };
    
    await supabase.from('accounts').upsert(accountData, {
      onConflict: 'domain,org_id',
      ignoreDuplicates: false
    });
  }
}

// ============= MAIN HTTP HANDLER =============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { inputs, org_id, source_type, force_external = false, skip_ai = false, save_to_db = false, async_mode = false } = await req.json();

    if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
      return new Response(JSON.stringify({ error: 'inputs array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!org_id) {
      return new Response(JSON.stringify({ error: 'org_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if we should use async processing
    const shouldUseAsync = async_mode || inputs.length >= ASYNC_THRESHOLD;
    
    if (shouldUseAsync) {
      console.log(`[enrich-internal-first] Large batch (${inputs.length} inputs) - using async processing`);
      
      const { data: job, error: jobError } = await supabase
        .from('enrichment_jobs')
        .insert({
          org_id,
          status: 'processing',
          total_records: inputs.length,
          processed_records: 0,
          rows_completed: 0,
          rows_failed: 0,
          job_type: 'contacts',
          provider: 'internal',
          source_type: 'edge_function',
          source_reference: 'enrich-internal-first',
          last_heartbeat: new Date().toISOString(),
          started_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (jobError) {
        console.error('[enrich-internal-first] Failed to create job:', jobError);
        throw new Error(`Failed to create enrichment job: ${jobError.message}`);
      }
      
      console.log(`[enrich-internal-first] Created job ${job.id}, starting background processing`);
      
      EdgeRuntime.waitUntil(
        processLeadsInBackground(
          job.id,
          inputs as EnrichmentInput[],
          supabase,
          org_id,
          force_external,
          skip_ai,
          save_to_db,
          source_type
        )
      );
      
      return new Response(JSON.stringify({
        async: true,
        job_id: job.id,
        total_records: inputs.length,
        message: `Enrichment job started. Processing ${inputs.length} records in background.`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Synchronous processing for small batches
    console.log(`[enrich-internal-first] Processing ${inputs.length} inputs for org ${org_id}, force_external=${force_external}`);

    const results: EnrichmentResult[] = [];
    const stats = {
      total: inputs.length,
      internal_matches: 0,
      apollo_enriched: 0,
      pdl_enriched: 0,
      ai_enriched: 0,
      firecrawl_enriched: 0,
      person_enriched: 0,
      email_verified: 0,
      failed: 0,
      api_calls_saved: 0
    };

    for (const input of inputs as EnrichmentInput[]) {
      try {
        const result = await processSingleInput(input, supabase, org_id, force_external, skip_ai);
        results.push(result);
        
        // Update stats based on source
        const source = result.source?.toLowerCase() || 'none';
        if (source === 'internal') {
          stats.internal_matches++;
          stats.api_calls_saved++;
        } else if (source === 'apollo') {
          stats.apollo_enriched++;
        } else if (source === 'pdl') {
          stats.pdl_enriched++;
        } else if (source === 'firecrawl') {
          stats.firecrawl_enriched++;
        } else if (source === 'ai' || source === 'perplexity' || source === 'google_search') {
          stats.ai_enriched++;
        }
        
        if (result.enriched_data.title) stats.person_enriched++;
        if (result.enriched_data.email_status) stats.email_verified++;
        
        // Save to DB if requested
        if (save_to_db && result.enriched_data) {
          await saveEnrichmentResult(result, supabase, org_id, source_type);
        }
      } catch (e) {
        console.error(`[enrich-internal-first] Error processing:`, e);
        stats.failed++;
        results.push({
          input,
          enriched_data: { error: (e as Error).message },
          source: 'internal',
          confidence: 0,
          fields_filled: [],
          api_calls_saved: false
        });
      }
    }

    return new Response(JSON.stringify({
      results,
      stats,
      message: `Enriched ${results.length} records. Flow: Perplexity → Firecrawl → Google → PDL → Apollo → Hunter`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[enrich-internal-first] Fatal error:', error);
    return new Response(JSON.stringify({ 
      error: (error as Error).message,
      stack: (error as Error).stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
