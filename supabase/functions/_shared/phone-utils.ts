/**
 * Phone Number Validation and Sanitization Utilities
 * 
 * This module provides robust phone number validation to filter out:
 * - GPS coordinates (e.g., "117.3601186")
 * - Repeating digit patterns (e.g., "6136999999")
 * - Invalid area codes (000-199)
 * - Numbers too short or too long
 * - CSS values, data attributes, and other garbage
 */

// ============================================================================
// TYPES
// ============================================================================

// ACCURACY IMPROVEMENT #4: Enhanced phone classification types
export interface PhoneClassification {
  type: 'direct' | 'mobile' | 'office' | 'main' | 'switchboard';
  confidence: number;
  reason: string;
}

export interface PhoneEntry {
  number: string;
  type: 'direct' | 'mobile' | 'office' | 'main' | 'switchboard';
  source: string;
  confidence: number;
  classification?: PhoneClassification;
  citation?: string;
}

export interface ValidatedPhone {
  number: string;          // E.164 format
  type: 'direct' | 'mobile' | 'office' | 'main' | 'switchboard';
  source: string;
  confidence: number;
  is_valid: boolean;
  rejection_reason?: string;
}

// ============================================================================
// VALIDATION RULES
// ============================================================================

// Invalid US area codes (0XX, 1XX are invalid for NANP)
const INVALID_AREA_CODE_PREFIXES = ['0', '1'];

// Suspicious patterns that indicate garbage data
const GARBAGE_PATTERNS = [
  /^\d+\.\d+$/,                    // Decimal numbers (GPS coordinates)
  /^(\d)\1{6,}$/,                  // 7+ repeating digits (e.g., 9999999)
  /^(\d{2,3})\1{3,}$/,             // Repeating 2-3 digit patterns
  /^0{3,}/,                        // Starts with 3+ zeros
  /^1{10,}$/,                      // All ones
  /^123456/,                       // Sequential test pattern
  /^000/,                          // Starts with 000
];

// Toll-free prefixes (US)
const TOLL_FREE_PREFIXES = ['800', '888', '877', '866', '855', '844', '833'];

// ============================================================================
// INTERNATIONAL PHONE SUPPORT
// ============================================================================

// Country code prefixes mapping
const COUNTRY_PHONE_PREFIXES: Record<string, string[]> = {
  'United Kingdom': ['+44', '44'],
  'UK': ['+44', '44'],
  'Great Britain': ['+44', '44'],
  'England': ['+44', '44'],
  'Scotland': ['+44', '44'],
  'Wales': ['+44', '44'],
  'United States': ['+1', '1'],
  'US': ['+1', '1'],
  'USA': ['+1', '1'],
  'Canada': ['+1', '1'],
  'Germany': ['+49', '49'],
  'France': ['+33', '33'],
  'Australia': ['+61', '61'],
  'Ireland': ['+353', '353'],
  'Netherlands': ['+31', '31'],
  'Spain': ['+34', '34'],
  'Italy': ['+39', '39'],
  'Sweden': ['+46', '46'],
  'Norway': ['+47', '47'],
  'Denmark': ['+45', '45'],
  'Switzerland': ['+41', '41'],
  'Austria': ['+43', '43'],
  'Belgium': ['+32', '32'],
  'Poland': ['+48', '48'],
  'Portugal': ['+351', '351'],
  'India': ['+91', '91'],
  'Singapore': ['+65', '65'],
  'Hong Kong': ['+852', '852'],
  'Japan': ['+81', '81'],
  'South Korea': ['+82', '82'],
  'China': ['+86', '86'],
  'Brazil': ['+55', '55'],
  'Mexico': ['+52', '52'],
  'South Africa': ['+27', '27'],
  'UAE': ['+971', '971'],
  'Israel': ['+972', '972'],
  'New Zealand': ['+64', '64'],
};

/**
 * Check if a phone number matches the expected country
 * Returns true if the phone prefix matches the country, or if country is unknown
 */
export function isPhoneMatchingCountry(phone: string, country: string | null | undefined): boolean {
  if (!country) return true; // No country to validate against
  if (!phone) return false;
  
  const digits = phone.replace(/\D/g, '');
  const normalized = phone.startsWith('+') ? phone : `+${digits}`;
  
  const expectedPrefixes = COUNTRY_PHONE_PREFIXES[country];
  if (!expectedPrefixes) return true; // Unknown country, allow any
  
  return expectedPrefixes.some(prefix => 
    normalized.startsWith(prefix) || digits.startsWith(prefix.replace('+', ''))
  );
}

/**
 * Sanitize and normalize phone number with country context
 * Supports international formats: UK (+44), US (+1), etc.
 * Returns null if invalid
 */
export function sanitizePhoneInternational(
  phone: string | null | undefined, 
  country?: string | null
): string | null {
  if (!phone) return null;
  
  const original = String(phone).trim();
  const digits = original.replace(/\D/g, '');
  
  // Check for GPS/garbage first
  if (isGPSCoordinate(original)) return null;
  for (const pattern of GARBAGE_PATTERNS) {
    if (pattern.test(original)) return null;
  }
  if (hasRepeatingPattern(digits)) return null;
  if (digits.length < 7 || digits.length > 15) return null;
  
  // If already has + prefix, preserve it
  if (original.startsWith('+')) {
    return original.replace(/[^\d+]/g, '');
  }
  
  // UK numbers: Handle UK-specific formats
  const isUKCountry = country === 'United Kingdom' || country === 'UK' || 
                      country === 'Great Britain' || country === 'England' ||
                      country === 'Scotland' || country === 'Wales';
  
  if (isUKCountry) {
    // Already has 44 prefix
    if (digits.startsWith('44')) {
      return `+${digits}`;
    }
    // UK domestic format: 07XXX XXXXXX (11 digits starting with 0)
    if (digits.startsWith('0') && digits.length === 11) {
      return `+44${digits.slice(1)}`;
    }
    // 10 digit UK number without leading 0 (e.g., 7XXX XXXXXX)
    if (digits.length === 10 && digits.startsWith('7')) {
      return `+44${digits}`;
    }
  }
  
  // US/Canada numbers: 10 digits with valid area code
  if (digits.length === 10) {
    const areaCode = digits.substring(0, 3);
    if (isValidNANPAreaCode(areaCode)) {
      // Only add +1 if country matches or is unknown
      const isNorthAmerican = !country || country === 'United States' || 
                              country === 'US' || country === 'USA' || country === 'Canada';
      if (isNorthAmerican) {
        return `+1${digits}`;
      }
    }
  }
  
  // 11-digit number with country code 1 (US/Canada)
  if (digits.length === 11 && digits.startsWith('1')) {
    const areaCode = digits.substring(1, 4);
    if (isValidNANPAreaCode(areaCode)) {
      return `+${digits}`;
    }
  }
  
  // Other international - assume includes country code if > 10 digits
  if (digits.length > 10) {
    return `+${digits}`;
  }
  
  // Short number - don't assume country
  return null;
}

// ============================================================================
// CORE VALIDATION FUNCTIONS
// ============================================================================

/**
 * Check if a string looks like a GPS coordinate
 */
export function isGPSCoordinate(value: string): boolean {
  // Contains decimal point with digits on both sides
  if (/^\-?\d+\.\d+$/.test(value)) return true;
  
  // Typical GPS range check (latitude: -90 to 90, longitude: -180 to 180)
  const num = parseFloat(value);
  if (!isNaN(num) && (
    (Math.abs(num) <= 90 && value.includes('.')) ||  // Likely latitude
    (Math.abs(num) <= 180 && value.includes('.'))    // Likely longitude
  )) {
    return true;
  }
  
  return false;
}

/**
 * Check if a string has repeating digit patterns indicating garbage
 */
export function hasRepeatingPattern(digits: string): boolean {
  if (digits.length < 7) return false;
  
  // Check for same digit repeated 6+ times
  for (let i = 0; i <= digits.length - 6; i++) {
    const char = digits[i];
    let count = 1;
    for (let j = i + 1; j < digits.length && digits[j] === char; j++) {
      count++;
    }
    if (count >= 6) return true;
  }
  
  // Check for 2-digit pattern repeated 3+ times (e.g., "121212")
  if (digits.length >= 6) {
    const twoDigit = digits.substring(0, 2);
    const pattern = new RegExp(`^(${twoDigit}){3,}`);
    if (pattern.test(digits)) return true;
  }
  
  return false;
}

/**
 * Validate US/Canada area code (NANP)
 */
export function isValidNANPAreaCode(areaCode: string): boolean {
  if (areaCode.length !== 3) return false;
  
  const firstDigit = areaCode[0];
  
  // Area codes cannot start with 0 or 1
  if (INVALID_AREA_CODE_PREFIXES.includes(firstDigit)) return false;
  
  // Area codes cannot be N11 (e.g., 411, 911)
  if (areaCode[1] === '1' && areaCode[2] === '1') return false;
  
  return true;
}

/**
 * Core phone number validation
 * Returns true if the phone number appears to be valid
 */
export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  if (!phone) return false;
  
  const original = String(phone).trim();
  
  // Check for GPS coordinates first
  if (isGPSCoordinate(original)) {
    return false;
  }
  
  // Check against garbage patterns
  for (const pattern of GARBAGE_PATTERNS) {
    if (pattern.test(original)) {
      return false;
    }
  }
  
  // Extract digits only
  const digits = original.replace(/\D/g, '');
  
  // Check length (US: 10-11, International: 7-15)
  if (digits.length < 7 || digits.length > 15) {
    return false;
  }
  
  // Check for repeating patterns
  if (hasRepeatingPattern(digits)) {
    return false;
  }
  
  // For US/Canada numbers (10-11 digits starting with 1)
  if (digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))) {
    const areaCode = digits.length === 11 ? digits.substring(1, 4) : digits.substring(0, 3);
    if (!isValidNANPAreaCode(areaCode)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Sanitize and normalize phone number to E.164 format
 * Returns null if invalid
 */
export function sanitizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  const original = String(phone).trim();
  
  // Validate first
  if (!isValidPhoneNumber(original)) {
    return null;
  }
  
  // Extract digits
  const digits = original.replace(/\D/g, '');
  
  // Normalize to E.164
  if (digits.length === 10) {
    // US number without country code
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // US number with country code
    return `+${digits}`;
  } else if (digits.length >= 7 && digits.length <= 15) {
    // International number - assume has country code if > 10 digits
    if (digits.length > 10) {
      return `+${digits}`;
    }
    // Short number - assume US
    return `+1${digits}`;
  }
  
  return null;
}

/**
 * Validate and sanitize a PhoneEntry
 * Returns the validated phone or null if invalid
 */
export function validatePhoneEntry(entry: PhoneEntry): ValidatedPhone | null {
  const sanitized = sanitizePhone(entry.number);
  
  if (!sanitized) {
    console.log(`[phone-utils] Rejected invalid phone: ${entry.number} from ${entry.source}`);
    return null;
  }
  
  return {
    number: sanitized,
    type: entry.type,
    source: entry.source,
    confidence: entry.confidence,
    is_valid: true,
  };
}

/**
 * Filter an array of phone entries, keeping only valid ones
 */
export function filterValidPhones(phones: PhoneEntry[]): ValidatedPhone[] {
  const validated: ValidatedPhone[] = [];
  const seen = new Set<string>();
  
  for (const phone of phones) {
    const result = validatePhoneEntry(phone);
    if (result && !seen.has(result.number)) {
      validated.push(result);
      seen.add(result.number);
    }
  }
  
  return validated;
}

/**
 * Classify phone type based on context keywords
 * Legacy function - use classifyPhoneTypeAdvanced for enhanced classification
 */
export function classifyPhoneType(context: string): 'direct' | 'mobile' | 'office' | 'main' | 'switchboard' {
  const result = classifyPhoneTypeAdvanced(context, context);
  return result.type;
}

/**
 * Check if a phone number is toll-free
 */
export function isTollFree(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  const areaCode = digits.length === 11 ? digits.substring(1, 4) : digits.substring(0, 3);
  return TOLL_FREE_PREFIXES.includes(areaCode);
}

// ============================================================================
// ACCURACY IMPROVEMENT #4: ENHANCED PHONE CLASSIFICATION
// ============================================================================

/**
 * Enhanced phone classification with confidence scoring
 * Distinguishes between direct dials, mobiles, and switchboard numbers
 */
export function classifyPhoneTypeAdvanced(
  phone: string,
  context: string,
  companySize?: number
): PhoneClassification {
  const lower = context.toLowerCase();
  
  // Check for toll-free (always switchboard for outbound)
  if (isTollFree(phone)) {
    return { 
      type: 'switchboard', 
      confidence: 95, 
      reason: 'Toll-free number' 
    };
  }
  
  // Mobile indicators (high dialable value)
  if (/\b(cell|mobile|personal|direct\s*line)\b/.test(lower)) {
    return { type: 'mobile', confidence: 85, reason: 'Context indicates mobile' };
  }
  
  // Direct dial indicators
  if (/\b(direct|personal|private|desk)\b/.test(lower)) {
    return { type: 'direct', confidence: 80, reason: 'Context indicates direct line' };
  }
  
  // Switchboard indicators
  if (/\b(main|general|reception|operator|switchboard|headquarters|hq|corporate)\b/.test(lower)) {
    return { type: 'switchboard', confidence: 85, reason: 'Context indicates switchboard' };
  }
  
  // Large companies (>500 employees) - assume switchboard unless proven otherwise
  if (companySize && companySize > 500) {
    return { type: 'switchboard', confidence: 70, reason: 'Large company, likely switchboard' };
  }
  
  // Extension patterns (x123, ext 456) indicate office/switchboard
  if (/x\d+|ext\.?\s*\d+/i.test(context)) {
    return { type: 'office', confidence: 75, reason: 'Has extension' };
  }
  
  // Default for small companies - more likely to be direct
  if (companySize && companySize < 50) {
    return { type: 'direct', confidence: 60, reason: 'Small company, likely reaches decision maker' };
  }
  
  return { type: 'main', confidence: 50, reason: 'Unknown type' };
}

// ============================================================================
// ACCURACY IMPROVEMENT #5: ENTERPRISE PHONE SUPPRESSION
// ============================================================================

// Enterprise domains where AI-generated phone numbers should be suppressed
const ENTERPRISE_PHONE_SUPPRESSION_DOMAINS = [
  'amazon.com', 'aws.amazon.com', 'google.com', 'microsoft.com', 'apple.com',
  'facebook.com', 'meta.com', 'ibm.com', 'oracle.com', 'salesforce.com',
  'allstate.com', 'statefarm.com', 'geico.com', 'progressive.com',
  'wellsfargo.com', 'bankofamerica.com', 'chase.com', 'citi.com', 'jpmorgan.com',
  'walmart.com', 'target.com', 'costco.com', 'homedepot.com', 'lowes.com',
  'att.com', 'verizon.com', 't-mobile.com', 'comcast.com', 'spectrum.com',
  'deloitte.com', 'pwc.com', 'ey.com', 'kpmg.com', 'accenture.com',
  'unitedhealth.com', 'cigna.com', 'anthem.com', 'humana.com', 'aetna.com',
  'fedex.com', 'ups.com', 'usps.com',
];

/**
 * Check if AI-generated phone should be suppressed for enterprise domains
 * AI providers often hallucinate switchboard or generic numbers for large enterprises
 */
export function shouldSuppressAIPhone(
  domain: string | undefined,
  employeeCount: number | undefined,
  source: string
): { suppress: boolean; reason?: string } {
  // Only suppress AI-generated phones, not website-scraped ones
  const aiSources = ['perplexity', 'anthropic', 'openai', 'xai', 'lovable', 'ai_', 'gemini', 'claude', 'grok'];
  const isAISource = aiSources.some(s => source.toLowerCase().includes(s));
  
  if (!isAISource) {
    return { suppress: false };
  }
  
  // Suppress for known enterprise domains
  if (domain) {
    const domainLower = domain.toLowerCase();
    for (const ent of ENTERPRISE_PHONE_SUPPRESSION_DOMAINS) {
      if (domainLower.includes(ent) || ent.includes(domainLower)) {
        return { 
          suppress: true, 
          reason: `Enterprise domain ${domain} - AI phone likely switchboard or hallucinated` 
        };
      }
    }
  }
  
  // Suppress for very large companies
  if (employeeCount && employeeCount > 10000) {
    return { 
      suppress: true, 
      reason: `Large enterprise (${employeeCount} employees) - AI phone unreliable` 
    };
  }
  
  return { suppress: false };
}

/**
 * Extract phone numbers from markdown/text content
 * Uses context awareness to avoid GPS coordinates and garbage
 */
export function extractPhonesFromText(
  text: string,
  source: string,
  baseConfidence: number = 70
): PhoneEntry[] {
  const phones: PhoneEntry[] = [];
  const seen = new Set<string>();
  
  // Look for phone patterns with context
  // Matches: (XXX) XXX-XXXX, XXX-XXX-XXXX, XXX.XXX.XXXX, +1XXXXXXXXXX
  const phonePatterns = [
    // US format with parentheses: (555) 123-4567
    /(?:call|phone|tel|contact|reach|dial|mobile|cell|fax)?[:\s]*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/gi,
    // E.164 format: +15551234567
    /\+1\d{10}/g,
    // Tel: links
    /tel:\+?1?\d{10,11}/gi,
  ];
  
  for (const pattern of phonePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const rawPhone = match[0];
      
      // Skip if contains "fax"
      if (/fax/i.test(rawPhone)) continue;
      
      // Extract just the digits
      const digits = rawPhone.replace(/\D/g, '');
      
      // Skip if already seen
      if (seen.has(digits)) continue;
      
      // Validate the number
      if (!isValidPhoneNumber(digits)) continue;
      
      seen.add(digits);
      
      // Classify based on context (look at surrounding text)
      const contextStart = Math.max(0, (match.index || 0) - 50);
      const contextEnd = Math.min(text.length, (match.index || 0) + rawPhone.length + 50);
      const context = text.substring(contextStart, contextEnd);
      
      const type = classifyPhoneType(context);
      
      phones.push({
        number: sanitizePhone(digits) || `+1${digits}`,
        type,
        source,
        confidence: baseConfidence,
      });
    }
  }
  
  return phones;
}

/**
 * Merge and deduplicate phone lists from multiple sources
 * Boosts confidence when same number appears in multiple sources
 */
export function mergePhoneLists(phoneLists: PhoneEntry[][]): ValidatedPhone[] {
  const phoneMap = new Map<string, ValidatedPhone>();
  
  for (const list of phoneLists) {
    for (const phone of list) {
      const validated = validatePhoneEntry(phone);
      if (!validated) continue;
      
      const existing = phoneMap.get(validated.number);
      if (existing) {
        // Boost confidence for multi-source matches
        existing.confidence = Math.min(100, existing.confidence + 10);
        // Keep more specific type
        if (phone.type === 'direct' || phone.type === 'mobile') {
          existing.type = phone.type;
        }
      } else {
        phoneMap.set(validated.number, validated);
      }
    }
  }
  
  // Sort by confidence (highest first), then by type (direct > mobile > office > main)
  const typeOrder = { direct: 0, mobile: 1, office: 2, main: 3 };
  return Array.from(phoneMap.values()).sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return typeOrder[a.type] - typeOrder[b.type];
  });
}
