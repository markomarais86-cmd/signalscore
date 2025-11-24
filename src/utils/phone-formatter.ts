/**
 * Format phone number to E.164 format
 * E.164 format: +[country code][subscriber number]
 * Example: +14155552671
 */
export function formatToE164(phone: string | null, defaultCountryCode: string = '1'): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  // If empty after cleaning, return null
  if (!digits) return null;
  
  // If doesn't start with country code, add default
  if (!digits.startsWith(defaultCountryCode)) {
    digits = defaultCountryCode + digits;
  }
  
  // Return with + prefix
  return '+' + digits;
}

/**
 * Validate E.164 phone number format
 */
export function isValidE164(phone: string | null): boolean {
  if (!phone) return false;
  
  // E.164: + followed by 1-15 digits
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * Get country code from phone number
 */
export function getCountryCode(phone: string | null): string | null {
  if (!phone || !phone.startsWith('+')) return null;
  
  // Extract first 1-3 digits after +
  const match = phone.match(/^\+(\d{1,3})/);
  return match ? match[1] : null;
}

/**
 * Format phone for display (US format)
 */
export function formatForDisplay(phone: string | null): string | null {
  if (!phone) return null;
  
  const digits = phone.replace(/\D/g, '');
  
  // US/Canada format: (555) 123-4567
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  // International format: just add spaces every 3-4 digits
  return phone;
}

/**
 * Infer country code from country name
 */
export function getCountryCodeFromCountry(country: string | null): string {
  if (!country) return '1';
  
  const countryCodeMap: Record<string, string> = {
    'United States': '1',
    'USA': '1',
    'US': '1',
    'Canada': '1',
    'United Kingdom': '44',
    'UK': '44',
    'Germany': '49',
    'France': '33',
    'Australia': '61',
    'Japan': '81',
    'Netherlands': '31',
    'Singapore': '65',
    'Switzerland': '41',
    'Spain': '34',
    'Italy': '39',
    'Sweden': '46',
    'Norway': '47',
    'Denmark': '45',
    'Finland': '358',
    'Belgium': '32',
    'Austria': '43',
    'Ireland': '353',
    'New Zealand': '64',
    'South Africa': '27',
    'India': '91',
    'China': '86',
    'Brazil': '55',
    'Mexico': '52',
  };
  
  // Try exact match first
  if (countryCodeMap[country]) {
    return countryCodeMap[country];
  }
  
  // Try partial match
  for (const [name, code] of Object.entries(countryCodeMap)) {
    if (country.toLowerCase().includes(name.toLowerCase())) {
      return code;
    }
  }
  
  // Default to US
  return '1';
}
