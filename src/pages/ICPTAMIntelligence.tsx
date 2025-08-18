import { useState, useEffect } from "react";
import { ICP10Report } from "@/components/ICP10Report";
import { AIInsights } from "@/components/AIInsights";
import { WorldMapHeatmap } from "@/components/WorldMapHeatmap";
import { CountryLevelAnalysis } from "@/components/CountryLevelAnalysis";
import { SubIndustryBreakdown } from "@/components/SubIndustryBreakdown";
import { ICPAnalysis } from "@/components/ICPAnalysis";
import { TAMCalculator } from "@/components/TAMCalculator";
import { ICPPerformanceComparison } from "@/components/ICPPerformanceComparison";
import { useICPScoring } from "@/hooks/use-icp-scoring";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { DrilldownNavigation } from "@/components/executive/DrilldownNavigation";
import { ExecutiveMetricCard } from "@/components/executive/ExecutiveMetricCard";
import { StatusIndicator } from "@/components/executive/StatusIndicator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ICPTAMIntelligence() {
  const { userProfile } = useAuth();
  const { accounts, icpProfiles, scores, loading: icpLoading } = useICPScoring();
  const [realTimeData, setRealTimeData] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.org_id && accounts.length > 0) {
      loadRealTimeData();
    }
  }, [userProfile?.org_id, accounts.length, scores.length]);

  const loadRealTimeData = async () => {
    if (!userProfile?.org_id) return;
    
    setDataLoading(true);
    try {
      // Get real account data with scores
      const { data: accountsWithScores, error } = await supabase
        .from('accounts')
        .select(`
          *,
          scores!left(*)
        `)
        .eq('org_id', userProfile.org_id);

      if (error) throw error;

      // Process real data into dashboard format
      const processedData = processAccountsForDashboard(accountsWithScores || []);
      setRealTimeData(processedData);
    } catch (error) {
      console.error('Error loading real-time data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const processAccountsForDashboard = (accountsData: any[]) => {
    // Group accounts by industry, country, revenue, etc.
    const industries = groupBy(accountsData, 'industry_raw');
    const countries = groupBy(accountsData, 'country');
    const revenueRanges = groupBy(accountsData, 'revenue_range');
    
    // Calculate TAM estimates (simplified calculation)
    const calculateTAM = (accounts: any[]) => {
      return accounts.reduce((sum, account) => {
        const revenue = parseRevenueRange(account.revenue_range);
        return sum + revenue.average;
      }, 0);
    };

    return {
      industries: Object.entries(industries).map(([industry, accounts]) => ({
        name: industry || 'Unknown',
        accountCount: (accounts as any[]).length,
        tamValue: calculateTAM(accounts as any[]),
        avgScore: (accounts as any[]).reduce((sum: number, acc: any) => sum + (acc.scores?.[0]?.overall || 0), 0) / (accounts as any[]).length
      })),
      countries: Object.entries(countries).map(([country, accounts]) => ({
        name: country || 'Unknown',
        accountCount: (accounts as any[]).length,
        tamValue: calculateTAM(accounts as any[]),
        avgScore: (accounts as any[]).reduce((sum: number, acc: any) => sum + (acc.scores?.[0]?.overall || 0), 0) / (accounts as any[]).length
      })),
      totalAccounts: accountsData.length,
      totalTAM: calculateTAM(accountsData),
      highScoreAccounts: accountsData.filter(acc => (acc.scores?.[0]?.overall || 0) >= 75).length
    };
  };

  const groupBy = (array: any[], key: string): Record<string, any[]> => {
    return array.reduce((groups, item) => {
      const group = item[key] || 'Unknown';
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {} as Record<string, any[]>);
  };

  const parseRevenueRange = (range: string) => {
    // Simple revenue range parsing - could be enhanced
    const ranges: { [key: string]: { min: number; max: number; average: number } } = {
      '<$1M': { min: 0, max: 1000000, average: 500000 },
      '$1M-$5M': { min: 1000000, max: 5000000, average: 3000000 },
      '$5M-$25M': { min: 5000000, max: 25000000, average: 15000000 },
      '$25M-$100M': { min: 25000000, max: 100000000, average: 62500000 },
      '$100M-$500M': { min: 100000000, max: 500000000, average: 300000000 },
      '$500M+': { min: 500000000, max: 2000000000, average: 1000000000 }
    };
    return ranges[range] || { min: 0, max: 0, average: 0 };
  };

  if (icpLoading || dataLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p>Loading TAM intelligence data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">ICP & TAM Intelligence</h1>
          <p className="text-muted-foreground">Real-time insights from your CRM data</p>
        </div>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No account data found. Please upload your CRM data first to see TAM intelligence and board-ready reports.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (icpProfiles.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">ICP & TAM Intelligence</h1>
          <p className="text-muted-foreground">Real-time insights from your CRM data</p>
        </div>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No ICP profiles defined. Please create at least one ICP profile to generate TAM intelligence.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // If we have real data, use it; otherwise fall back to mock data for demo
  const useRealData = realTimeData && realTimeData.totalAccounts > 0;

  // Mock data for demonstration (used as fallback or when real data is insufficient)
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

  const processRealDataIntoICP10 = () => {
    if (!realTimeData || !accounts.length || !scores.length) return icp10Data;
    
    // Process real CRM data into ICP-10 format
    const accountsWithScores = accounts
      .map(account => {
        const accountScores = scores.filter((s: any) => s.account_external_id === account.external_id);
        const latestScore = accountScores.sort((a: any, b: any) => 
          new Date(b.computed_at || 0).getTime() - new Date(a.computed_at || 0).getTime()
        )[0];
        
        return {
          ...account,
          signalScore: (latestScore as any)?.overall || 0,
          persona: 'CXO', // This would come from contacts data
          subIndustry: account.industry_raw || 'Unknown'
        };
      })
      .filter((account: any) => account.signalScore > 60) // Only high-scoring accounts
      .sort((a: any, b: any) => b.signalScore - a.signalScore)
      .slice(0, 10);
    
    return accountsWithScores.map((account: any, index: number) => ({
      rank: index + 1,
      persona: account.persona,
      subIndustry: account.subIndustry,
      country: account.country || 'Unknown',
      companySize: account.revenue_range || 'Unknown',
      revenueRange: account.revenue_range || 'Unknown',
      employeeRange: account.employee_count ? `${account.employee_count}` : 'Unknown',
      signalScore: account.signalScore,
      accountCount: 1, // Individual account
      tamValue: parseRevenueRange(account.revenue_range || '').average,
      conversionRate: Math.floor(Math.random() * 15) + 10, // Mock conversion rate
      avgDealSize: Math.floor(parseRevenueRange(account.revenue_range || '').average * 0.1),
      salesCycle: Math.floor(Math.random() * 30) + 30
    }));
  };

  const handleExportICP10 = (format: 'pdf' | 'csv') => {
    console.log(`Export initiated for ${format.toUpperCase()}`);
    // TODO: Implement actual ICP10 export functionality
  };

  const handleExportDrilldown = (format: 'pdf' | 'pptx' | 'csv') => {
    console.log(`Exporting drill-down ${format.toUpperCase()} report...`);
    // TODO: Implement drill-down export functionality
  };

  const handleApplyRecommendation = (insightId: string) => {
    console.log(`Applying recommendation: ${insightId}`);
    // Implement recommendation application logic
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-6">
      {/* Executive Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">ICP & TAM Intelligence</h1>
          <p className="text-lg text-muted-foreground">
            {useRealData ? 'Real-time insights from your CRM data' : 'Board-ready market intelligence with drill-down analysis'}
          </p>
          
          {useRealData && (
            <div className="flex items-center gap-4 mt-4">
              <StatusIndicator
                value={Math.round(((realTimeData.highScoreAccounts / realTimeData.totalAccounts) * 100))}
                threshold={{ low: 20, medium: 40, high: 60 }}
                showTrend={true}
                trend={12}
                size="md"
              />
              <div className="flex gap-6 text-sm text-muted-foreground">
                <span><strong>{realTimeData.totalAccounts}</strong> total accounts</span>
                <span><strong>{realTimeData.highScoreAccounts}</strong> high ICP fit</span>
                <span><strong>${(realTimeData.totalTAM / 1000000).toFixed(1)}M</strong> estimated TAM</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Executive Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <ExecutiveMetricCard
          title="Total TAM"
          value={useRealData ? `$${(realTimeData.totalTAM / 1000000000).toFixed(1)}B` : "$30.5B"}
          subtitle="addressable market"
          status={{ 
            value: 82, 
            threshold: { low: 40, medium: 65, high: 80 } 
          }}
          trend={{ value: 15, period: "YoY growth" }}
        />
        
        <ExecutiveMetricCard
          title="ICP Match Rate"
          value={useRealData ? `${Math.round((realTimeData.highScoreAccounts / realTimeData.totalAccounts) * 100)}%` : "68%"}
          subtitle="high-fit accounts"
          status={{ 
            value: useRealData ? Math.round((realTimeData.highScoreAccounts / realTimeData.totalAccounts) * 100) : 68, 
            threshold: { low: 30, medium: 50, high: 70 } 
          }}
          trend={{ value: 8, period: "vs benchmark" }}
        />

        <ExecutiveMetricCard
          title="Market Segments"
          value={useRealData ? realTimeData.industries.length : "12"}
          subtitle="industries analyzed"
          status={{ 
            value: 75, 
            threshold: { low: 40, medium: 65, high: 80 } 
          }}
          trend={{ value: 22, period: "coverage increase" }}
        />

        <ExecutiveMetricCard
          title="Conversion Rate"
          value="18.5%"
          subtitle="ICP to opportunity"
          status={{ 
            value: 85, 
            threshold: { low: 40, medium: 65, high: 80 } 
          }}
          trend={{ value: 12, period: "vs industry avg" }}
        />
      </div>

      {/* Tabbed Interface for Different Views */}
      <Tabs defaultValue="drilldown" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="drilldown">Market Drill-Down</TabsTrigger>
          <TabsTrigger value="icp10">ICP-10 Report</TabsTrigger>
          <TabsTrigger value="geographic">Geographic Analysis</TabsTrigger>
          <TabsTrigger value="performance">Performance Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="drilldown" className="space-y-6">
          <DrilldownNavigation onExport={handleExportDrilldown} />
        </TabsContent>

        <TabsContent value="icp10" className="space-y-6">
          <ICP10Report 
            data={useRealData ? processRealDataIntoICP10() : icp10Data} 
            onExport={handleExportICP10} 
          />
          <AIInsights insights={aiInsights} onApplyRecommendation={handleApplyRecommendation} />
        </TabsContent>

        <TabsContent value="geographic" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <WorldMapHeatmap data={worldMapData} />
            <CountryLevelAnalysis data={countryData} />
          </div>
          <SubIndustryBreakdown data={subIndustryData} />
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <ICPPerformanceComparison data={performanceData} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ICPAnalysis data={icpData} />
            <TAMCalculator data={tamData} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}