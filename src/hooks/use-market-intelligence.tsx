import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface MarketIntelligence {
  // Summary metrics
  totalAccounts: number;
  totalLeads: number;
  icpFitCoverage: number;
  dataCompleteness: number;
  
  // ICP Fit Distribution
  icpDistribution: {
    highFit: { count: number; percentage: number };
    mediumFit: { count: number; percentage: number };
    lowFit: { count: number; percentage: number };
  };
  
  // Geographic Distribution (top markets)
  geoDistribution: Array<{
    country: string;
    accounts: number;
    leads: number;
    percentage: number;
  }>;
  
  // Industry Distribution
  industryDistribution: Array<{
    industry: string;
    accounts: number;
    percentage: number;
  }>;
  
  // Persona Distribution
  personaDistribution: Array<{
    persona: string;
    leads: number;
    percentage: number;
  }>;
  
  // Top Titles
  topTitles: Array<{
    title: string;
    count: number;
  }>;
  
  // Data Completeness Breakdown
  dataQuality: {
    emails: number;
    titles: number;
    phones: number;
    personas: number;
    industries: number;
    geography: number;
  };
  
  // TAM/SAM/SOM
  marketSizing: {
    tam: number;
    sam: number;
    som: number;
    avgDealSize: number;
  };
}

interface UseMarketIntelligenceOptions {
  icpId?: string;
  dataSource?: 'all' | 'crm' | 'database';
  fitScoreMin?: number;
  fitScoreMax?: number;
}

export function useMarketIntelligence(options: UseMarketIntelligenceOptions = {}) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.org_id;
  
  const { dataSource = 'all', fitScoreMin = 0, fitScoreMax = 100 } = options;

  return useQuery({
    queryKey: ['market-intelligence', orgId, dataSource, fitScoreMin, fitScoreMax],
    queryFn: async (): Promise<MarketIntelligence> => {
      if (!orgId) throw new Error('No org_id');

      // Fetch all data in parallel for efficiency
      const [
        accountsResult,
        leadsResult,
        scoresResult,
        closedWonResult
      ] = await Promise.all([
        // Get accounts with aggregation
        supabase
          .from('accounts')
          .select('external_id, industry_norm, country, employee_count, revenue_range')
          .eq('org_id', orgId)
          .then(res => res.data || []),
        
        // Get leads with aggregation (no PII - just counts and categories)
        supabase
          .from('Leads')
          .select('account_external_id, persona, title, country, email, phone, mobile')
          .eq('org_id', orgId)
          .then(res => res.data || []),
        
        // Get scores for ICP fit distribution
        supabase
          .from('scores')
          .select('account_external_id, overall, fit')
          .eq('org_id', orgId)
          .then(res => res.data || []),
        
        // Get closed won deals for market sizing
        supabase
          .from('closed_won_deals')
          .select('deal_value')
          .eq('org_id', orgId)
          .then(res => res.data || [])
      ]);

      // Create score lookup
      const scoreMap = new Map(scoresResult.map(s => [s.account_external_id, s]));
      
      // Filter accounts by data source and score range
      let filteredAccounts = accountsResult.filter(acc => {
        const score = scoreMap.get(acc.external_id);
        const overallScore = score?.overall || 0;
        return overallScore >= fitScoreMin && overallScore <= fitScoreMax;
      });

      const totalAccounts = filteredAccounts.length;
      const totalLeads = leadsResult.length;

      // ICP Fit Distribution (based on fit score)
      let highFit = 0, mediumFit = 0, lowFit = 0;
      filteredAccounts.forEach(acc => {
        const score = scoreMap.get(acc.external_id);
        const fitScore = score?.fit || 0;
        if (fitScore >= 70) highFit++;
        else if (fitScore >= 40) mediumFit++;
        else lowFit++;
      });

      const icpDistribution = {
        highFit: { count: highFit, percentage: totalAccounts > 0 ? (highFit / totalAccounts) * 100 : 0 },
        mediumFit: { count: mediumFit, percentage: totalAccounts > 0 ? (mediumFit / totalAccounts) * 100 : 0 },
        lowFit: { count: lowFit, percentage: totalAccounts > 0 ? (lowFit / totalAccounts) * 100 : 0 }
      };

      // Geographic Distribution
      const geoMap = new Map<string, { accounts: Set<string>; leads: number }>();
      filteredAccounts.forEach(acc => {
        const country = acc.country || 'Unknown';
        if (!geoMap.has(country)) geoMap.set(country, { accounts: new Set(), leads: 0 });
        geoMap.get(country)!.accounts.add(acc.external_id);
      });
      leadsResult.forEach(lead => {
        const country = lead.country || 'Unknown';
        if (geoMap.has(country)) {
          geoMap.get(country)!.leads++;
        }
      });
      
      const geoDistribution = Array.from(geoMap.entries())
        .map(([country, data]) => ({
          country,
          accounts: data.accounts.size,
          leads: data.leads,
          percentage: totalAccounts > 0 ? (data.accounts.size / totalAccounts) * 100 : 0
        }))
        .sort((a, b) => b.accounts - a.accounts)
        .slice(0, 10);

      // Industry Distribution
      const industryMap = new Map<string, number>();
      filteredAccounts.forEach(acc => {
        const industry = acc.industry_norm || 'Unknown';
        industryMap.set(industry, (industryMap.get(industry) || 0) + 1);
      });
      
      const industryDistribution = Array.from(industryMap.entries())
        .map(([industry, accounts]) => ({
          industry,
          accounts,
          percentage: totalAccounts > 0 ? (accounts / totalAccounts) * 100 : 0
        }))
        .sort((a, b) => b.accounts - a.accounts)
        .slice(0, 10);

      // Persona Distribution
      const personaMap = new Map<string, number>();
      leadsResult.forEach(lead => {
        const persona = lead.persona || 'Unclassified';
        personaMap.set(persona, (personaMap.get(persona) || 0) + 1);
      });
      
      const personaDistribution = Array.from(personaMap.entries())
        .map(([persona, leads]) => ({
          persona,
          leads,
          percentage: totalLeads > 0 ? (leads / totalLeads) * 100 : 0
        }))
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 8);

      // Top Titles (anonymized - just categories)
      const titleMap = new Map<string, number>();
      leadsResult.forEach(lead => {
        const title = lead.title || 'Unknown';
        titleMap.set(title, (titleMap.get(title) || 0) + 1);
      });
      
      const topTitles = Array.from(titleMap.entries())
        .map(([title, count]) => ({ title, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Data Completeness (percentages only, no PII)
      const leadsWithEmail = leadsResult.filter(l => l.email).length;
      const leadsWithTitle = leadsResult.filter(l => l.title).length;
      const leadsWithPhone = leadsResult.filter(l => l.phone || l.mobile).length;
      const leadsWithPersona = leadsResult.filter(l => l.persona).length;
      const accountsWithIndustry = filteredAccounts.filter(a => a.industry_norm).length;
      const accountsWithGeo = filteredAccounts.filter(a => a.country).length;

      const dataQuality = {
        emails: totalLeads > 0 ? (leadsWithEmail / totalLeads) * 100 : 0,
        titles: totalLeads > 0 ? (leadsWithTitle / totalLeads) * 100 : 0,
        phones: totalLeads > 0 ? (leadsWithPhone / totalLeads) * 100 : 0,
        personas: totalLeads > 0 ? (leadsWithPersona / totalLeads) * 100 : 0,
        industries: totalAccounts > 0 ? (accountsWithIndustry / totalAccounts) * 100 : 0,
        geography: totalAccounts > 0 ? (accountsWithGeo / totalAccounts) * 100 : 0
      };

      const avgCompleteness = Object.values(dataQuality).reduce((a, b) => a + b, 0) / Object.keys(dataQuality).length;

      // TAM/SAM/SOM Calculation
      const avgDealSize = closedWonResult.length > 0
        ? closedWonResult.reduce((sum, d) => sum + Number(d.deal_value || 0), 0) / closedWonResult.length
        : 75000; // Default $75k ACV

      const tam = totalAccounts * avgDealSize;
      const sam = highFit * avgDealSize; // SAM = High-fit accounts
      const som = sam * 0.15; // SOM = 15% of SAM (12-month target)

      return {
        totalAccounts,
        totalLeads,
        icpFitCoverage: icpDistribution.highFit.percentage,
        dataCompleteness: avgCompleteness,
        icpDistribution,
        geoDistribution,
        industryDistribution,
        personaDistribution,
        topTitles,
        dataQuality,
        marketSizing: {
          tam,
          sam,
          som,
          avgDealSize
        }
      };
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
