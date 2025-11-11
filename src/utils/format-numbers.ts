/**
 * Format a number with thousand separators
 * @param value - The number or string to format
 * @param decimals - Number of decimal places (optional)
 * @returns Formatted string with commas
 */
export function formatNumber(value: number | string, decimals?: number): string {
  if (value === null || value === undefined) return '0';
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return '0';
  
  if (decimals !== undefined) {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  
  return num.toLocaleString('en-US');
}

/**
 * Format a number as currency
 * @param value - The number to format
 * @param currency - Currency code (default: USD)
 * @returns Formatted currency string
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  if (value === null || value === undefined) return '$0';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format large numbers with abbreviations (K, M, B)
 * @param value - The number to format
 * @returns Abbreviated string (e.g., "1.2K", "5.3M")
 */
export function formatAbbreviated(value: number): string {
  if (value === null || value === undefined) return '0';
  
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString('en-US');
}
