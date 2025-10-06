/**
 * Utility functions for normalizing and validating country data
 */

// Map of common variations to standard country names
const COUNTRY_MAPPINGS: Record<string, string> = {
  'gb': 'United Kingdom',
  'uk': 'United Kingdom',
  'usa': 'United States',
  'us': 'United States',
  'uae': 'United Arab Emirates',
  'korea': 'South Korea',
  'russia': 'Russian Federation',
  'vietnam': 'Viet Nam',
  'czech republic': 'Czechia',
};

// Pattern to detect phone numbers
const PHONE_PATTERN = /^[\d\s\-\(\)\+\.]+$/;

// Pattern to detect US state abbreviations
const STATE_ABBREVIATION_PATTERN = /^[A-Z]{2}$/;

/**
 * Check if a string is likely a phone number
 */
export function isPhoneNumber(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return PHONE_PATTERN.test(trimmed) && trimmed.length >= 7;
}

/**
 * Check if a string is a US state abbreviation
 */
export function isStateAbbreviation(value: string | null | undefined): boolean {
  if (!value) return false;
  return STATE_ABBREVIATION_PATTERN.test(value.trim());
}

/**
 * Normalize a country name to a standard format
 */
export function normalizeCountry(country: string | null | undefined): string | null {
  if (!country) return null;
  
  const trimmed = country.trim();
  
  // Filter out invalid values
  if (isPhoneNumber(trimmed) || isStateAbbreviation(trimmed)) {
    return null;
  }
  
  // Check for empty or very short strings
  if (trimmed.length === 0) {
    return null;
  }
  
  // Normalize case and check mappings
  const lowercase = trimmed.toLowerCase();
  const mapped = COUNTRY_MAPPINGS[lowercase];
  
  if (mapped) {
    return mapped;
  }
  
  // Capitalize first letter of each word
  return trimmed
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Validate and normalize country data from accounts
 */
export interface NormalizedGeoData {
  country: string;
  count: number;
  isValid: boolean;
}

export function normalizeCountryData(
  accounts: Array<{ country?: string | null }>
): {
  validData: Array<{ country: string; count: number }>;
  invalidCount: number;
} {
  const countMap = new Map<string, number>();
  let invalidCount = 0;
  
  accounts.forEach(account => {
    const normalized = normalizeCountry(account.country);
    
    if (normalized) {
      countMap.set(normalized, (countMap.get(normalized) || 0) + 1);
    } else if (account.country) {
      invalidCount++;
    }
  });
  
  const validData = Array.from(countMap.entries())
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);
  
  return { validData, invalidCount };
}
