import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Building2, DollarSign, Users, TrendingUp, Database } from "lucide-react";
import { useMemo } from "react";

interface BreakdownData {
  [key: string]: {
    accounts: number;
    percentage: number;
  };
}

interface ExternalMarketBreakdownCardProps {
  industryData?: BreakdownData;
  companySizeData?: BreakdownData;
  revenueData?: BreakdownData;
  provider: string;
}

export function ExternalMarketBreakdownCard({
  industryData,
  companySizeData,
  revenueData,
  provider
}: ExternalMarketBreakdownCardProps) {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', { 
      notation: 'compact',
      maximumFractionDigits: 1 
    }).format(num);
  };

  const getColorForIndex = (index: number) => {
    const colors = [
      "hsl(var(--chart-1))",
      "hsl(var(--chart-2))",
      "hsl(var(--chart-3))",
      "hsl(var(--chart-4))",
      "hsl(var(--chart-5))"
    ];
    return colors[index % colors.length];
  };

  const topIndustries = useMemo(() => {
    if (!industryData) return [];
    return Object.entries(industryData)
      .sort(([, a], [, b]) => b.accounts - a.accounts)
      .slice(0, 5);
  }, [industryData]);

  const topCompanySizes = useMemo(() => {
    if (!companySizeData) return [];
    return Object.entries(companySizeData)
      .sort(([, a], [, b]) => b.accounts - a.accounts)
      .slice(0, 5);
  }, [companySizeData]);

  const topRevenueRanges = useMemo(() => {
    if (!revenueData) return [];
    return Object.entries(revenueData)
      .sort(([, a], [, b]) => b.accounts - a.accounts)
      .slice(0, 5);
  }, [revenueData]);

  const hasData = topIndustries.length > 0 || topCompanySizes.length > 0 || topRevenueRanges.length > 0;

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Market Breakdown
          </CardTitle>
          <CardDescription>No breakdown data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Market Breakdown (External TAM)
            </CardTitle>
            <CardDescription>
              Industry, company size, and revenue distribution from {provider}
            </CardDescription>
          </div>
          <Badge variant="outline" className="gap-1">
            <Database className="h-3 w-3" />
            {provider}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Industry Breakdown */}
        {topIndustries.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Top Industries</h4>
            </div>
            
            <div className="space-y-3">
              {topIndustries.map(([industry, data], index) => (
                <div key={industry} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate flex-1">{industry}</span>
                    <div className="flex items-center gap-3 ml-2">
                      <span className="font-semibold text-foreground">
                        {formatNumber(data.accounts)}
                      </span>
                      <Badge 
                        variant="secondary"
                        style={{ 
                          backgroundColor: `${getColorForIndex(index)}20`,
                          color: getColorForIndex(index)
                        }}
                      >
                        {data.percentage.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                  <Progress 
                    value={data.percentage} 
                    className="h-2"
                    style={{
                      // @ts-ignore
                      '--progress-background': getColorForIndex(index)
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Company Size Breakdown */}
        {topCompanySizes.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Company Size Distribution</h4>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {topCompanySizes.map(([size, data], index) => (
                <div 
                  key={size} 
                  className="p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">{size} employees</span>
                    <Badge 
                      variant="secondary" 
                      className="text-xs"
                      style={{ 
                        backgroundColor: `${getColorForIndex(index)}20`,
                        color: getColorForIndex(index)
                      }}
                    >
                      {data.percentage.toFixed(0)}%
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: getColorForIndex(index) }}>
                    {formatNumber(data.accounts)}
                  </div>
                  <Progress 
                    value={data.percentage} 
                    className="h-1.5 mt-2"
                    style={{
                      // @ts-ignore
                      '--progress-background': getColorForIndex(index)
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revenue Breakdown */}
        {topRevenueRanges.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Revenue Distribution</h4>
            </div>
            
            <div className="space-y-3">
              {topRevenueRanges.map(([range, data], index) => (
                <div key={range} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{range}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-foreground">
                        {formatNumber(data.accounts)}
                      </span>
                      <Badge 
                        variant="secondary"
                        style={{ 
                          backgroundColor: `${getColorForIndex(index)}20`,
                          color: getColorForIndex(index)
                        }}
                      >
                        {data.percentage.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                  <Progress 
                    value={data.percentage} 
                    className="h-2"
                    style={{
                      // @ts-ignore
                      '--progress-background': getColorForIndex(index)
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Market Intelligence Insight */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
          <div className="flex items-start gap-2">
            <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-muted-foreground">
              <strong className="text-foreground">Market Intelligence:</strong> This breakdown shows the 
              composition of your total addressable market. Use these insights to refine your ICP criteria 
              and prioritize segments with the highest potential.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}