/**
 * Normalizes a domain by removing protocols, www prefix, paths, and converting to lowercase
 * @param domain - The domain to normalize
 * @returns Normalized domain (e.g., "example.com")
 */
export function normalizeDomain(domain: string | null | undefined): string {
  if (!domain) return '';
  
  let normalized = domain.trim().toLowerCase();
  
  // Remove protocols (http://, https://, //)
  normalized = normalized.replace(/^(https?:\/\/|\/\/)/i, '');
  
  // Remove www. prefix
  normalized = normalized.replace(/^www\./i, '');
  
  // Remove trailing slashes and paths
  normalized = normalized.replace(/\/.*$/, '');
  
  // Remove trailing dots
  normalized = normalized.replace(/\.$/, '');
  
  return normalized;
}

/**
 * Creates a normalized domain map from account data
 * @param accounts - Array of accounts with domain and external_id
 * @returns Map of normalized domain to external_id
 */
export function createNormalizedDomainMap(
  accounts: Array<{ domain: string | null; external_id: string }>
): Map<string, string> {
  const map = new Map<string, string>();
  
  for (const account of accounts) {
    const normalized = normalizeDomain(account.domain);
    if (normalized) {
      map.set(normalized, account.external_id);
    }
  }
  
  return map;
}
