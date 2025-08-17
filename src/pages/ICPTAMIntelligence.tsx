import { ICPAnalysis } from "@/components/ICPAnalysis";
import { TAMCalculator } from "@/components/TAMCalculator";
import { ICPPerformanceComparison } from "@/components/ICPPerformanceComparison";
import { SubIndustryBreakdown } from "@/components/SubIndustryBreakdown";
import { CountryLevelAnalysis } from "@/components/CountryLevelAnalysis";
import { ICP10Report } from "@/components/ICP10Report";
import { AIInsights } from "@/components/AIInsights";
import { WorldMapHeatmap } from "@/components/WorldMapHeatmap";

export function ICPTAMIntelligence() {
  // Mock data - in a real app, this would come from your API
  const icpData = {
    criteria: {
      companySize: "50-500 employees",
      industry: "Technology, SaaS",
      geography: "North America, Europe",
      revenue: "$10M-$100M ARR"
    },
    confidence: 92,
    lastUpdated: "2024-01-15T10:30:00Z"
  };

  const tamData = [
    { segment: "SMB Tech", accounts: 15420, value: 231000000, growth: 12 },
    { segment: "Mid-Market SaaS", accounts: 8750, value: 525000000, growth: 18 },
    { segment: "Enterprise Software", accounts: 2100, value: 840000000, growth: 8 }
  ];

  const performanceData = {
    icp: {
      accounts: 1250,
      conversionRate: 18.5,
      avgDealSize: 45000,
      salesCycle: 65,
      churnRate: 8.2
    },
    nonIcp: {
      accounts: 890,
      conversionRate: 7.2,
      avgDealSize: 22000,
      salesCycle: 95,
      churnRate: 24.1
    }
  };

  // Enhanced mock data for new components
  const subIndustryData = [
    {
      parentIndustry: "Manufacturing",
      subIndustry: "Pharmaceuticals",
      naicsCode: "325412",
      signalScore: 82,
      accountCount: 1240,
      tamValue: 875000000,
      conversionRate: 12.5,
      trend: 8
    },
    {
      parentIndustry: "Manufacturing",
      subIndustry: "Aerospace",
      naicsCode: "336411",
      signalScore: 77,
      accountCount: 890,
      tamValue: 642000000,
      conversionRate: 9.8,
      trend: 3
    },
    {
      parentIndustry: "Manufacturing",
      subIndustry: "Automotive",
      naicsCode: "336111",
      signalScore: 68,
      accountCount: 2150,
      tamValue: 1200000000,
      conversionRate: 7.2,
      trend: -2
    }
  ];

  const countryData = [
    {
      country: "United States",
      countryCode: "US",
      region: "North America",
      icpAccounts: 1230,
      tamRevenue: 12500000000,
      signalScore: 79,
      conversionRate: 15.2,
      marketPenetration: 8.5,
      averageDealSize: 125000
    },
    {
      country: "Germany",
      countryCode: "DE",
      region: "Europe",
      icpAccounts: 540,
      tamRevenue: 6100000000,
      signalScore: 81,
      conversionRate: 18.7,
      marketPenetration: 12.3,
      averageDealSize: 98000
    },
    {
      country: "France",
      countryCode: "FR",
      region: "Europe",
      icpAccounts: 420,
      tamRevenue: 4300000000,
      signalScore: 72,
      conversionRate: 11.4,
      marketPenetration: 6.8,
      averageDealSize: 87000
    }
  ];

  const icp10Data = [
    {
      rank: 1,
      persona: "CIO",
      subIndustry: "Pharmaceuticals",
      country: "Germany",
      companySize: "$100-500M",
      revenueRange: "$100-500M",
      employeeRange: "500-2000",
      signalScore: 85,
      accountCount: 89,
      tamValue: 245000000,
      conversionRate: 22.4,
      avgDealSize: 180000,
      salesCycle: 45
    },
    {
      rank: 2,
      persona: "CFO",
      subIndustry: "Aerospace",
      country: "United States",
      companySize: "$500M-1B",
      revenueRange: "$500M-1B",
      employeeRange: "1000-5000",
      signalScore: 81,
      accountCount: 156,
      tamValue: 420000000,
      conversionRate: 19.8,
      avgDealSize: 220000,
      salesCycle: 58
    },
    {
      rank: 3,
      persona: "VP IT",
      subIndustry: "Financial Services",
      country: "United Kingdom",
      companySize: "$50-100M",
      revenueRange: "$50-100M",
      employeeRange: "200-1000",
      signalScore: 77,
      accountCount: 234,
      tamValue: 189000000,
      conversionRate: 16.3,
      avgDealSize: 95000,
      salesCycle: 38
    }
  ];

  const aiInsights = [
    {
      id: "insight-1",
      type: "opportunity" as const,
      priority: "high" as const,
      title: "German Aerospace CFOs Convert 2.3x Better",
      description: "German aerospace CFOs show 22.4% conversion vs 9.8% industry average. Recommend immediate expansion of outreach to this segment.",
      impact: "Potential +$2.1M ARR",
      confidence: 94,
      actionable: true,
      relatedSegments: ["CFO - Aerospace - Germany"]
    },
    {
      id: "insight-2",
      type: "warning" as const,
      priority: "high" as const,
      title: "France Automotive Underperforming",
      description: "French automotive sub-industry shows $2B TAM but SignalScore of only 52. Consider deprioritization or messaging adjustment.",
      impact: "Risk: -$180K wasted spend",
      confidence: 87,
      actionable: true,
      relatedSegments: ["All Personas - Automotive - France"]
    }
  ];

  const worldMapData = [
    {
      country: "United States",
      countryCode: "US",
      tamValue: 12500000000,
      signalScore: 79,
      accountCount: 1230,
      region: "North America",
      coordinates: [39.8283, -98.5795] as [number, number]
    },
    {
      country: "Germany",
      countryCode: "DE",
      tamValue: 6100000000,
      signalScore: 81,
      accountCount: 540,
      region: "Europe",
      coordinates: [51.1657, 10.4515] as [number, number]
    },
    {
      country: "France",
      countryCode: "FR",
      tamValue: 4300000000,
      signalScore: 72,
      accountCount: 420,
      region: "Europe",
      coordinates: [46.2276, 2.2137] as [number, number]
    }
  ];

  const handleExportICP10 = (format: 'pdf' | 'csv') => {
    console.log(`Exporting ICP-10 report as ${format.toUpperCase()}`);
    // Implement export logic
  };

  const handleApplyRecommendation = (insightId: string) => {
    console.log(`Applying recommendation: ${insightId}`);
    // Implement recommendation application logic
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ICP/TAM Intelligence</h1>
        <p className="text-muted-foreground">
          Board-ready ICP-10 reports with sub-industry and country-level intelligence
        </p>
      </div>

      {/* ICP-10 Board Report */}
      <ICP10Report data={icp10Data} onExport={handleExportICP10} />

      {/* AI Insights */}
      <AIInsights insights={aiInsights} onApplyRecommendation={handleApplyRecommendation} />

      {/* World Map and Geographic Analysis */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <WorldMapHeatmap data={worldMapData} />
        <CountryLevelAnalysis data={countryData} />
      </div>

      {/* Sub-Industry Breakdown */}
      <SubIndustryBreakdown data={subIndustryData} />

      {/* Original Components */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ICPAnalysis data={icpData} />
        <TAMCalculator data={tamData} />
      </div>

      <ICPPerformanceComparison data={performanceData} />
    </div>
  );
}