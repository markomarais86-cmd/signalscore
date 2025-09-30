// Phase 2: Data Source Attribution System
// Utilities for calculating coverage, identifying whitespace, and managing data sources

export interface DataSourceStats {
  crmAccounts: number;
  databaseAccounts: number;
  whitespaceAccounts: number;
  coveragePercentage: number;
  crmContacts: number;
  databaseContacts: number;
  whitespaceContacts: number;
  contactCoveragePercentage: number;
}

export interface AccountWithSource {
  id: string;
  name: string;
  domain: string;
  data_source: 'crm' | 'database' | 'both';
  external_database_match: boolean;
  enriched_from?: string;
  enriched_at?: string;
}

/**
 * Calculate coverage statistics for CRM vs External Database
 */
export function calculateCoverage(
  crmAccountCount: number,
  databaseAccountCount: number,
  crmContactCount: number,
  databaseContactCount: number
): DataSourceStats {
  const whitespaceAccounts = Math.max(0, databaseAccountCount - crmAccountCount);
  const coveragePercentage = databaseAccountCount > 0 
    ? (crmAccountCount / databaseAccountCount) * 100 
    : 0;

  const whitespaceContacts = Math.max(0, databaseContactCount - crmContactCount);
  const contactCoveragePercentage = databaseContactCount > 0
    ? (crmContactCount / databaseContactCount) * 100
    : 0;

  return {
    crmAccounts: crmAccountCount,
    databaseAccounts: databaseAccountCount,
    whitespaceAccounts,
    coveragePercentage: Math.round(coveragePercentage * 10) / 10,
    crmContacts: crmContactCount,
    databaseContacts: databaseContactCount,
    whitespaceContacts,
    contactCoveragePercentage: Math.round(contactCoveragePercentage * 10) / 10,
  };
}

/**
 * Format coverage percentage for display
 */
export function formatCoverage(percentage: number): string {
  return `${percentage.toFixed(1)}%`;
}

/**
 * Get data source badge color
 */
export function getSourceBadgeVariant(source: 'crm' | 'database' | 'both'): 'default' | 'secondary' | 'outline' {
  switch (source) {
    case 'crm':
      return 'default';
    case 'database':
      return 'secondary';
    case 'both':
      return 'outline';
  }
}

/**
 * Get data source label
 */
export function getSourceLabel(source: 'crm' | 'database' | 'both'): string {
  switch (source) {
    case 'crm':
      return 'CRM';
    case 'database':
      return 'Database';
    case 'both':
      return 'CRM + Database';
  }
}

/**
 * Check if account is whitespace (in database but not in CRM)
 */
export function isWhitespace(account: AccountWithSource): boolean {
  return account.external_database_match && account.data_source === 'database';
}

/**
 * Format enrichment status
 */
export function formatEnrichmentStatus(enrichedFrom?: string, enrichedAt?: string): string {
  if (!enrichedFrom || !enrichedAt) return 'Not enriched';
  const date = new Date(enrichedAt);
  return `Enriched from ${enrichedFrom} on ${date.toLocaleDateString()}`;
}
