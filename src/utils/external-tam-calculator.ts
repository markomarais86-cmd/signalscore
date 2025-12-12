/**
 * Utilities for calculating SAM and SOM from external TAM data (Apollo)
 */

interface ICPProfile {
  industries?: string[];
  geographies?: string[];
  company_sizes?: number[];
  revenue_ranges?: string[];
}

interface ExternalTAMData {
  totalAccounts: number;
  totalLeads: number;
  provider: string;
  industry_breakdown?: Record<string, { accounts: number; contacts: number }>;
  geography_breakdown?: Record<string, { accounts: number; contacts: number }>;
  company_size_breakdown?: Record<string, { accounts: number; contacts: number }>;
  revenue_breakdown?: Record<string, { accounts: number; contacts: number }>;
}

/**
 * Normalize string for matching (lowercase, trim, remove special chars)
 */
function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

/**
 * Check if two strings match (fuzzy matching)
 */
function fuzzyMatch(str1: string, str2: string): boolean {
  const n1 = normalizeString(str1);
  const n2 = normalizeString(str2);
  return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}

/**
 * Calculate SAM (Serviceable Addressable Market) from Apollo breakdown data
 * by filtering based on ICP criteria
 */
export function calculateSAMFromBreakdown(
  tamData: ExternalTAMData,
  icpProfile: ICPProfile | null
): number {
  // If no ICP, return a reasonable default (30% of TAM)
  if (!icpProfile) {
    return Math.round(tamData.totalAccounts * 0.30);
  }

  const hasIndustryFilter = icpProfile.industries && icpProfile.industries.length > 0;
  const hasGeoFilter = icpProfile.geographies && icpProfile.geographies.length > 0;
  
  // If no filters defined, SAM = 30% of TAM (conservative estimate)
  if (!hasIndustryFilter && !hasGeoFilter) {
    return Math.round(tamData.totalAccounts * 0.30);
  }

  let industryRatio = 1.0;
  let geoRatio = 1.0;

  // Calculate industry ratio
  if (hasIndustryFilter && tamData.industry_breakdown) {
    let matchingAccounts = 0;
    let totalBreakdownAccounts = 0;
    
    Object.entries(tamData.industry_breakdown).forEach(([industry, data]) => {
      totalBreakdownAccounts += data.accounts;
      
      // Check if this industry matches any ICP industry
      const matches = icpProfile.industries!.some(icpInd => fuzzyMatch(icpInd, industry));
      if (matches) {
        matchingAccounts += data.accounts;
      }
    });

    if (totalBreakdownAccounts > 0) {
      industryRatio = matchingAccounts / totalBreakdownAccounts;
    }
  }

  // Calculate geography ratio
  if (hasGeoFilter && tamData.geography_breakdown) {
    let matchingAccounts = 0;
    let totalBreakdownAccounts = 0;
    
    Object.entries(tamData.geography_breakdown).forEach(([geo, data]) => {
      totalBreakdownAccounts += data.accounts;
      
      // Check if this geography matches any ICP geography
      const matches = icpProfile.geographies!.some(icpGeo => fuzzyMatch(icpGeo, geo));
      if (matches) {
        matchingAccounts += data.accounts;
      }
    });

    if (totalBreakdownAccounts > 0) {
      geoRatio = matchingAccounts / totalBreakdownAccounts;
    }
  }

  // Combine ratios (multiply for AND logic, with a minimum floor)
  const combinedRatio = Math.max(industryRatio * geoRatio, 0.05);
  
  return Math.round(tamData.totalAccounts * combinedRatio);
}

/**
 * Calculate SOM (Serviceable Obtainable Market) from SAM
 * based on contact coverage and conversion assumptions
 */
export function calculateSOMFromSAM(
  samAccounts: number,
  tamData: ExternalTAMData,
  conversionRate: number = 0.15,
  timeHorizon: number = 12
): number {
  if (samAccounts === 0) return 0;

  // Calculate average contact coverage rate from Apollo data
  let avgContactsPerAccount = 0;
  if (tamData.geography_breakdown) {
    const breakdowns = Object.values(tamData.geography_breakdown);
    const totalAccounts = breakdowns.reduce((sum, b) => sum + b.accounts, 0);
    const totalContacts = breakdowns.reduce((sum, b) => sum + b.contacts, 0);
    avgContactsPerAccount = totalAccounts > 0 ? totalContacts / totalAccounts : 0;
  }

  // Estimate contact coverage rate (assume 70-80% of contacts have email + title)
  // Cap at 80% to be conservative
  const contactCoverageRate = Math.min(avgContactsPerAccount / 5, 0.75);

  // Apply time-adjusted conversion rate
  const timeAdjustedConversion = conversionRate * (timeHorizon / 12);

  return Math.round(samAccounts * contactCoverageRate * timeAdjustedConversion);
}

/**
 * Calculate both SAM and SOM in one call
 */
export function calculateExternalTAMMetrics(
  tamData: ExternalTAMData,
  icpProfile: ICPProfile | null,
  conversionRate: number = 0.15,
  timeHorizon: number = 12
): { sam: number; som: number } {
  const sam = calculateSAMFromBreakdown(tamData, icpProfile);
  const som = calculateSOMFromSAM(sam, tamData, conversionRate, timeHorizon);
  
  return { sam, som };
}
