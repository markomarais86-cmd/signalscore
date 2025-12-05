import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, Users, Target, BarChart3, Globe2, Briefcase, 
  UserCheck, TrendingUp, CheckCircle2, AlertCircle
} from "lucide-react";
import { formatNumber } from "@/utils/format-numbers";
import { useMarketIntelligence, MarketIntelligence } from "@/hooks/use-market-intelligence";

interface MarketIntelligencePreviewProps {
  dataSource?: 'all' | 'crm' | 'database';
  fitScoreMin?: number;
  fitScoreMax?: number;
  compact?: boolean;
}

function formatCurrency(value: number): string {
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function DataQualityIndicator({ value, label }: { value: number; label: string }) {
  const getColor = (v: number) => {
    if (v >= 90) return "text-green-500";
    if (v >= 70) return "text-yellow-500";
    return "text-red-500";
  };
  
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${getColor(value)}`}>
        {value >= 90 && <CheckCircle2 className="inline h-3 w-3 mr-1" />}
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

function DistributionBar({ percentage, color = "bg-primary" }: { percentage: number; color?: string }) {
  return (
    <div className="h-2 bg-muted rounded-full overflow-hidden">
      <div 
        className={`h-full ${color} transition-all duration-500`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );
}

export function MarketIntelligencePreview({ 
  dataSource = 'all',
  fitScoreMin = 0,
  fitScoreMax = 100,
  compact = false
}: MarketIntelligencePreviewProps) {
  const { data, isLoading, error } = useMarketIntelligence({
    dataSource,
    fitScoreMin,
    fitScoreMax
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load market intelligence</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show message if no accounts found but not in database mode
  if (data.totalAccounts === 0 && dataSource !== 'database') {
    return (
      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-yellow-600">
            <AlertCircle className="h-5 w-5" />
            <span>No accounts match the current filters. Try adjusting your fit score range or data source.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return <CompactView data={data} dataSource={dataSource} />;
  }

  return <FullView data={data} dataSource={dataSource} />;
}

function CompactView({ data, dataSource }: { data: MarketIntelligence; dataSource?: string }) {
  const isApolloTam = dataSource === 'database';
  
  return (
    <div className="space-y-4">
      {/* Source indicator */}
      {isApolloTam && (
        <div className="flex items-center gap-2 text-amber-600 text-sm">
          <Building2 className="h-4 w-4" />
          <span>Showing Apollo Available Market data</span>
        </div>
      )}
      
      {/* Summary Row */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{formatNumber(data.totalAccounts)}</div>
            <div className="text-xs text-muted-foreground">{isApolloTam ? 'TAM Accounts' : 'Accounts'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{formatNumber(data.totalLeads)}</div>
            <div className="text-xs text-muted-foreground">{isApolloTam ? 'Est. Contacts' : 'Leads'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-500">{data.icpFitCoverage.toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground">{isApolloTam ? 'Est. High Fit' : 'High Fit'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{data.dataCompleteness.toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground">Data Quality</div>
          </CardContent>
        </Card>
      </div>

      {/* ICP Distribution */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500" />
              High Fit (A-Band)
            </span>
            <span className="font-medium">{formatNumber(data.icpDistribution.highFit.count)} ({data.icpDistribution.highFit.percentage.toFixed(0)}%)</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-yellow-500" />
              Medium Fit (B-Band)
            </span>
            <span className="font-medium">{formatNumber(data.icpDistribution.mediumFit.count)} ({data.icpDistribution.mediumFit.percentage.toFixed(0)}%)</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500" />
              Low Fit (C-Band)
            </span>
            <span className="font-medium">{formatNumber(data.icpDistribution.lowFit.count)} ({data.icpDistribution.lowFit.percentage.toFixed(0)}%)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FullView({ data, dataSource }: { data: MarketIntelligence; dataSource?: string }) {
  const isApolloTam = dataSource === 'database';
  
  return (
    <div className="space-y-6">
      {/* Source indicator */}
      {isApolloTam && (
        <div className="flex items-center gap-2 text-amber-600 bg-amber-500/10 px-3 py-2 rounded-lg text-sm">
          <Building2 className="h-4 w-4" />
          <span>Showing Apollo Available Market data (estimates based on TAM analysis)</span>
        </div>
      )}
      
      {/* Summary Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">{isApolloTam ? 'TAM Accounts' : 'Total Accounts'}</span>
            </div>
            <div className="text-3xl font-bold">{formatNumber(data.totalAccounts)}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">{isApolloTam ? 'Est. Contacts' : 'Campaign-Ready Leads'}</span>
            </div>
            <div className="text-3xl font-bold">{formatNumber(data.totalLeads)}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">{isApolloTam ? 'Est. ICP Coverage' : 'ICP Fit Coverage'}</span>
            </div>
            <div className="text-3xl font-bold text-green-500">{data.icpFitCoverage.toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground">High-fit accounts</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/5 to-purple-500/10 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Data Completeness</span>
            </div>
            <div className="text-3xl font-bold">{data.dataCompleteness.toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground">Average across fields</div>
          </CardContent>
        </Card>
      </div>

      {/* ICP Fit Distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            ICP Fit Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Badge className="bg-green-500 hover:bg-green-500">A</Badge>
                High Fit
              </span>
              <span className="font-medium">{formatNumber(data.icpDistribution.highFit.count)} ({data.icpDistribution.highFit.percentage.toFixed(0)}%)</span>
            </div>
            <DistributionBar percentage={data.icpDistribution.highFit.percentage} color="bg-green-500" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Badge variant="secondary">B</Badge>
                Medium Fit
              </span>
              <span className="font-medium">{formatNumber(data.icpDistribution.mediumFit.count)} ({data.icpDistribution.mediumFit.percentage.toFixed(0)}%)</span>
            </div>
            <DistributionBar percentage={data.icpDistribution.mediumFit.percentage} color="bg-yellow-500" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Badge variant="outline">C</Badge>
                Low Fit
              </span>
              <span className="font-medium">{formatNumber(data.icpDistribution.lowFit.count)} ({data.icpDistribution.lowFit.percentage.toFixed(0)}%)</span>
            </div>
            <DistributionBar percentage={data.icpDistribution.lowFit.percentage} color="bg-red-500" />
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-4">
        {/* Geographic Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe2 className="h-4 w-4" />
              Top Markets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.geoDistribution.slice(0, 5).map((geo, idx) => (
                <div key={geo.country} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{geo.country}</span>
                    <span className="text-muted-foreground ml-2">
                      {formatNumber(geo.accounts)} ({geo.percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <DistributionBar percentage={geo.percentage} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Industry Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Top Industries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.industryDistribution.slice(0, 5).map((ind, idx) => (
                <div key={ind.industry} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{ind.industry}</span>
                    <span className="text-muted-foreground ml-2">
                      {formatNumber(ind.accounts)} ({ind.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <DistributionBar percentage={ind.percentage * 10} /> {/* Scale for visibility */}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout - Personas and Titles */}
      <div className="grid grid-cols-2 gap-4">
        {/* Persona Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Persona Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.personaDistribution.slice(0, 6).map((persona) => (
                <div key={persona.persona} className="flex items-center justify-between text-sm">
                  <span className="truncate">{persona.persona}</span>
                  <Badge variant="secondary">{formatNumber(persona.leads)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Titles */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Top Titles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topTitles.slice(0, 6).map((title) => (
                <div key={title.title} className="flex items-center justify-between text-sm">
                  <span className="truncate">{title.title}</span>
                  <Badge variant="outline">{formatNumber(title.count)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Quality & TAM/SAM/SOM */}
      <div className="grid grid-cols-2 gap-4">
        {/* Data Quality */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Data Completeness
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <DataQualityIndicator value={data.dataQuality.emails} label="Emails" />
            <DataQualityIndicator value={data.dataQuality.titles} label="Job Titles" />
            <DataQualityIndicator value={data.dataQuality.phones} label="Phone Numbers" />
            <DataQualityIndicator value={data.dataQuality.personas} label="Personas" />
            <DataQualityIndicator value={data.dataQuality.industries} label="Industries" />
            <DataQualityIndicator value={data.dataQuality.geography} label="Geography" />
          </CardContent>
        </Card>

        {/* TAM/SAM/SOM */}
        <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-500" />
              Market Sizing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Total Addressable Market (TAM)</div>
              <div className="text-2xl font-bold">{formatCurrency(data.marketSizing.tam)}</div>
              <div className="text-xs text-muted-foreground">{formatNumber(data.totalAccounts)} accounts × {formatCurrency(data.marketSizing.avgDealSize)} ACV</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Serviceable Addressable Market (SAM)</div>
              <div className="text-xl font-bold text-green-500">{formatCurrency(data.marketSizing.sam)}</div>
              <div className="text-xs text-muted-foreground">{formatNumber(data.icpDistribution.highFit.count)} high-fit accounts</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Serviceable Obtainable Market (SOM)</div>
              <div className="text-lg font-bold text-amber-500">{formatCurrency(data.marketSizing.som)}</div>
              <div className="text-xs text-muted-foreground">12-month target @ 15% conversion</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Privacy Note */}
      <div className="text-xs text-muted-foreground text-center py-2 border-t">
        <span className="flex items-center justify-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          All data shown is aggregated. No personal contact information (emails, phones, names) is displayed.
        </span>
      </div>
    </div>
  );
}
