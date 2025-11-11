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
 * Normalize industry name for matching
 */
function normalizeIndustry(industry: string): string {
  return industry.toLowerCase().trim();
}

/**
 * Calculate SAM (Serviceable Addressable Market) from Apollo breakdown data
 * by filtering based on ICP criteria
 */
export function calculateSAMFromBreakdown(
  tamData: ExternalTAMData,
  icpProfile: ICPProfile | null
): number {
  if (!icpProfile || !tamData.industry_breakdown) {
    return 0;
  }

  let samAccounts = 0;

  // If ICP has target industries, sum only matching industries
  if (icpProfile.industries && icpProfile.industries.length > 0) {
    icpProfile.industries.forEach(industry => {
      const normalized = normalizeIndustry(industry);
      
      // Try direct match
      if (tamData.industry_breakdown![normalized]) {
        samAccounts += tamData.industry_breakdown![normalized].accounts;
      } else {
        // Try partial matching
        Object.entries(tamData.industry_breakdown!).forEach(([key, value]) => {
          if (key.includes(normalized) || normalized.includes(key)) {
            samAccounts += value.accounts;
          }
        });
      }
    });
  } else {
    // If no industry filter, SAM = TAM
    samAccounts = tamData.totalAccounts;
  }

  return samAccounts;
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
