/**
 * Segmentation Analysis Utility
 * Analyzes CRM data to identify gaps, opportunities, and missing segments
 */

interface Account {
  id: string;
  external_id: string;
  name: string | null;
  industry_norm: string | null;
  employee_count: number | null;
  revenue_range: string | null;
  country: string | null;
}

interface Score {
  account_external_id: string;
  overall: number;
  fit: number;
  intent: number;
  reachability: number;
}

interface ICPProfile {
  id: string;
  name: string;
  industries?: string[];
  company_sizes?: number[];
  revenue_ranges?: string[];
  geographies?: string[];
  status: string;
}

interface SegmentGap {
  segment: string;
  type: 'industry' | 'geography' | 'size' | 'revenue';
  currentAccounts: number;
  avgScore: number;
  potentialValue: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

interface SegmentationInsight {
  type: 'opportunity' | 'warning' | 'success';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  segments: string[];
  actionable: boolean;
}

/**
 * Analyze segmentation gaps compared to ICP targets
 */
export function analyzeSegmentationGaps(
  accounts: Account[],
  scores: Score[],
  icpProfiles: ICPProfile[]
): {
  gaps: SegmentGap[];
  insights: SegmentationInsight[];
  recommendations: string[];
} {
  const scoreMap = new Map(scores.map(s => [s.account_external_id, s]));
  const accountsWithScores = accounts.map(acc => ({
    ...acc,
    score: scoreMap.get(acc.external_id),
  }));

  // Get active ICP
  const activeICP = icpProfiles.find(icp => icp.status === 'active');
  
  const gaps: SegmentGap[] = [];
  const insights: SegmentationInsight[] = [];
  const recommendations: string[] = [];

  if (!activeICP) {
    recommendations.push('Create an active ICP profile to enable segmentation analysis');
    return { gaps, insights, recommendations };
  }

  // Analyze Industry Gaps
  if (activeICP.industries && activeICP.industries.length > 0) {
    const industryData = new Map<string, { count: number; scores: number[] }>();
    
    accountsWithScores.forEach(acc => {
      const industry = acc.industry_norm || 'Other';
      if (!industryData.has(industry)) {
        industryData.set(industry, { count: 0, scores: [] });
      }
      const data = industryData.get(industry)!;
      data.count++;
      if (acc.score) data.scores.push(acc.score.overall);
    });

    // Find missing ICP industries
    activeICP.industries.forEach(targetIndustry => {
      const data = industryData.get(targetIndustry);
      const currentCount = data?.count || 0;
      const avgScore = data?.scores.length
        ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
        : 0;

      if (currentCount === 0) {
        gaps.push({
          segment: targetIndustry,
          type: 'industry',
          currentAccounts: 0,
          avgScore: 0,
          potentialValue: 500000, // Estimated
          priority: 'high',
          reason: `ICP targets ${targetIndustry} but you have no accounts in this industry`,
        });
        
        insights.push({
          type: 'warning',
          priority: 'high',
          title: `Missing Target Industry: ${targetIndustry}`,
          description: `Your ICP includes ${targetIndustry} but you have zero accounts in this segment`,
          impact: 'High - Missing key ICP segment',
          segments: [targetIndustry],
          actionable: true,
        });
      } else if (currentCount < 10 && avgScore < 60) {
        gaps.push({
          segment: targetIndustry,
          type: 'industry',
          currentAccounts: currentCount,
          avgScore: Math.round(avgScore),
          potentialValue: 250000,
          priority: 'medium',
          reason: `Low account count (${currentCount}) and weak scores (${Math.round(avgScore)}) in target industry`,
        });
        
        insights.push({
          type: 'warning',
          priority: 'medium',
          title: `Underperforming: ${targetIndustry}`,
          description: `Only ${currentCount} accounts with average score of ${Math.round(avgScore)} - below expectations`,
          impact: 'Medium - Underutilized ICP segment',
          segments: [targetIndustry],
          actionable: true,
        });
      } else if (avgScore >= 75) {
        insights.push({
          type: 'success',
          priority: 'high',
          title: `Strong Performance: ${targetIndustry}`,
          description: `${currentCount} accounts with excellent average score of ${Math.round(avgScore)}`,
          impact: 'Positive - High-value segment performing well',
          segments: [targetIndustry],
          actionable: false,
        });
      }
    });

    // Check for non-ICP industries with high scores
    industryData.forEach((data, industry) => {
      if (!activeICP.industries!.includes(industry) && data.scores.length > 0) {
        const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        if (avgScore >= 70 && data.count >= 5) {
          insights.push({
            type: 'opportunity',
            priority: 'high',
            title: `Unexpected High Performers: ${industry}`,
            description: `${data.count} accounts in ${industry} (not in ICP) scoring ${Math.round(avgScore)} on average`,
            impact: 'Opportunity - Consider adding to ICP',
            segments: [industry],
            actionable: true,
          });
          
          recommendations.push(`Consider adding ${industry} to your ICP - ${data.count} accounts scoring ${Math.round(avgScore)} on average`);
        }
      }
    });
  }

  // Analyze Geographic Gaps
  if (activeICP.geographies && activeICP.geographies.length > 0) {
    const geoData = new Map<string, { count: number; scores: number[] }>();
    
    accountsWithScores.forEach(acc => {
      const country = acc.country || 'Unknown';
      if (!geoData.has(country)) {
        geoData.set(country, { count: 0, scores: [] });
      }
      const data = geoData.get(country)!;
      data.count++;
      if (acc.score) data.scores.push(acc.score.overall);
    });

    activeICP.geographies.forEach(targetGeo => {
      const data = geoData.get(targetGeo);
      const currentCount = data?.count || 0;

      if (currentCount === 0) {
        gaps.push({
          segment: targetGeo,
          type: 'geography',
          currentAccounts: 0,
          avgScore: 0,
          potentialValue: 400000,
          priority: 'medium',
          reason: `ICP targets ${targetGeo} but you have no accounts in this region`,
        });
      }
    });
  }

  // General recommendations
  if (gaps.length === 0 && insights.filter(i => i.type === 'success').length > 0) {
    recommendations.push('Strong ICP alignment - continue current targeting strategy');
  }
  
  if (gaps.filter(g => g.priority === 'high').length > 0) {
    recommendations.push('Focus on filling high-priority segment gaps to maximize ICP coverage');
  }

  if (insights.filter(i => i.type === 'opportunity').length > 0) {
    recommendations.push('Review ICP profile to include high-performing segments not currently targeted');
  }

  return { gaps, insights, recommendations };
}

/**
 * Calculate ICP coverage metrics
 */
export function calculateICPCoverage(
  accounts: Account[],
  scores: Score[],
  icpProfile: ICPProfile | null
): {
  totalCoverage: number;
  industryCoverage: number;
  geographyCoverage: number;
  sizeCoverage: number;
  qualityCoverage: number;
} {
  if (!icpProfile) {
    return {
      totalCoverage: 0,
      industryCoverage: 0,
      geographyCoverage: 0,
      sizeCoverage: 0,
      qualityCoverage: 0,
    };
  }

  const scoreMap = new Map(scores.map(s => [s.account_external_id, s]));
  let industryMatches = 0;
  let geoMatches = 0;
  let sizeMatches = 0;
  let highScoreCount = 0;

  accounts.forEach(acc => {
    if (icpProfile.industries?.includes(acc.industry_norm || '')) {
      industryMatches++;
    }
    if (icpProfile.geographies?.includes(acc.country || '')) {
      geoMatches++;
    }
    if (icpProfile.company_sizes?.includes(acc.employee_count || 0)) {
      sizeMatches++;
    }
    
    const score = scoreMap.get(acc.external_id);
    if (score && score.overall >= 70) {
      highScoreCount++;
    }
  });

  const total = accounts.length || 1;
  
  return {
    totalCoverage: Math.round(((industryMatches + geoMatches + sizeMatches) / (total * 3)) * 100),
    industryCoverage: Math.round((industryMatches / total) * 100),
    geographyCoverage: Math.round((geoMatches / total) * 100),
    sizeCoverage: Math.round((sizeMatches / total) * 100),
    qualityCoverage: Math.round((highScoreCount / total) * 100),
  };
}
