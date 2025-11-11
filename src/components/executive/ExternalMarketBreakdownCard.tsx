import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Briefcase, DollarSign, TrendingUp, Target } from "lucide-react";
import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { formatAbbreviated } from "@/utils/format-numbers";
import { Badge } from "@/components/ui/badge";

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
      .slice(0, 4);
  }, [companySizeData]);

  const topRevenueBands = useMemo(() => {
    if (!revenueData) return [];
    return Object.entries(revenueData)
      .sort(([, a], [, b]) => b.accounts - a.accounts)
      .slice(0, 3);
  }, [revenueData]);

  const hasData = topIndustries.length > 0 || topCompanySizes.length > 0 || topRevenueBands.length > 0;

  if (!hasData) {
    return null;
  }

  // Calculate insights
  const topIndustry = topIndustries[0];
  const topSize = topCompanySizes[0];
  const topRevenue = topRevenueBands[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Market Breakdown
          </CardTitle>
          <Badge variant="outline">via {provider}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top Industries with enhanced visuals */}
        {topIndustries.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Top Industries
              </h4>
              <span className="text-xs text-muted-foreground">{Object.keys(industryData || {}).length} total</span>
            </div>
            <div className="space-y-3">
              {topIndustries.map(([industry, data], index) => (
                <div key={industry} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: getColorForIndex(index) }} />
                      <span className="font-medium truncate max-w-[200px]">{industry}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{formatAbbreviated(data.accounts)}</span>
                      <span className="font-bold min-w-[3rem] text-right">{data.percentage}%</span>
                    </div>
                  </div>
                  <Progress value={data.percentage} className="h-2" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Company Size Distribution with visual bars */}
        {topCompanySizes.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Company Size
              </h4>
              <span className="text-xs text-muted-foreground">employee count</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {topCompanySizes.map(([size, data]) => (
                <div key={size} className="rounded-lg border bg-card p-3 space-y-2">
                  <div className="text-xs text-muted-foreground truncate">{size}</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{data.percentage}%</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatAbbreviated(data.accounts)} accounts
                  </div>
                  <Progress value={data.percentage} className="h-1" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revenue Distribution */}
        {topRevenueBands.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Revenue Bands
              </h4>
              <span className="text-xs text-muted-foreground">annual revenue</span>
            </div>
            <div className="space-y-2">
              {topRevenueBands.map(([revenue, data]) => (
                <div key={revenue} className="flex items-center justify-between text-sm py-2">
                  <span className="text-muted-foreground font-medium">{revenue}</span>
                  <div className="flex items-center gap-3">
                    <Progress value={data.percentage} className="h-2 w-32" />
                    <span className="font-bold min-w-[3rem] text-right">{data.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Market Intelligence Insights */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Key Insights
          </h4>
          <div className="space-y-2">
            {topIndustry && (
              <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                <span className="font-medium text-foreground">Leading Industry: </span>
                <span className="text-muted-foreground">
                  {topIndustry[1].percentage}% of market in {topIndustry[0]}
                </span>
              </div>
            )}
            {topSize && (
              <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                <span className="font-medium text-foreground">Dominant Size: </span>
                <span className="text-muted-foreground">
                  {topSize[1].percentage}% are {topSize[0]} employee companies
                </span>
              </div>
            )}
            {topRevenue && (
              <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                <span className="font-medium text-foreground">Revenue Sweet Spot: </span>
                <span className="text-muted-foreground">
                  {topRevenue[1].percentage}% generate {topRevenue[0]}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}