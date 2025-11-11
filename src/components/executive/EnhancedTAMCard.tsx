import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Building2, Globe, DollarSign } from "lucide-react";
import { formatCurrency, formatAbbreviated } from "@/utils/format-numbers";
import { Progress } from "@/components/ui/progress";

interface EnhancedTAMCardProps {
  totalAccounts: number;
  totalContacts: number;
  averageDealSize?: number;
  geographyBreakdown?: Record<string, any>;
  industryBreakdown?: Record<string, any>;
  companySizeBreakdown?: Record<string, any>;
  revenueBreakdown?: Record<string, any>;
  provider?: string;
}

export function EnhancedTAMCard({
  totalAccounts,
  totalContacts,
  averageDealSize = 75000,
  geographyBreakdown = {},
  industryBreakdown = {},
  companySizeBreakdown = {},
  revenueBreakdown = {},
  provider = 'Apollo',
}: EnhancedTAMCardProps) {
  const totalTAMValue = totalAccounts * averageDealSize;
  
  // Get top items from each breakdown
  const topCountries = Object.entries(geographyBreakdown)
    .sort((a, b) => (b[1] as any).accounts - (a[1] as any).accounts)
    .slice(0, 3);
  
  const topIndustries = Object.entries(industryBreakdown)
    .sort((a, b) => (b[1] as any).accounts - (a[1] as any).accounts)
    .slice(0, 4);
  
  const topRevenueBands = Object.entries(revenueBreakdown)
    .sort((a, b) => (b[1] as any).accounts - (a[1] as any).accounts)
    .slice(0, 3);

  const totalCountries = Object.keys(geographyBreakdown).length;
  const totalIndustries = Object.keys(industryBreakdown).length;

  // Calculate concentration metrics
  const topCountryPercent = topCountries.length > 0 ? topCountries[0][1].percentage : 0;
  const topIndustryPercent = topIndustries.length > 0 ? topIndustries[0][1].percentage : 0;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardHeader className="pb-2 p-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-medium text-muted-foreground">Total Addressable Market</CardTitle>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-bold text-primary">{formatCurrency(totalTAMValue)}</span>
              <span className="text-sm text-muted-foreground">via {provider}</span>
            </div>
          </div>
          <div className="rounded-lg bg-primary/10 p-3">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 p-4 pt-0">
        {/* Market Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>Total Accounts</span>
            </div>
            <div className="text-2xl font-bold">{formatAbbreviated(totalAccounts)}</div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Total Contacts</span>
            </div>
            <div className="text-2xl font-bold">{formatAbbreviated(totalContacts)}</div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="h-4 w-4" />
              <span>Geographic Reach</span>
            </div>
            <div className="text-2xl font-bold">{totalCountries} countries</div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span>Avg Deal Size</span>
            </div>
            <div className="text-2xl font-bold">{formatCurrency(averageDealSize)}</div>
          </div>
        </div>

        {/* Top Industries */}
        {topIndustries.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Top Industries</h4>
            <div className="space-y-2">
              {topIndustries.map(([industry, data]: [string, any]) => (
                <div key={industry} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate max-w-[200px]">{industry}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatAbbreviated(data.accounts)}</span>
                      <span className="text-muted-foreground">({data.percentage}%)</span>
                    </div>
                  </div>
                  <Progress value={data.percentage} className="h-2" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Geographies */}
        {topCountries.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Top Markets</h4>
            <div className="grid grid-cols-3 gap-3">
              {topCountries.map(([country, data]: [string, any]) => (
                <div key={country} className="rounded-lg border bg-card p-3 space-y-1">
                  <div className="text-xs text-muted-foreground truncate">{country}</div>
                  <div className="text-lg font-bold">{data.percentage}%</div>
                  <div className="text-xs text-muted-foreground">{formatAbbreviated(data.accounts)} accounts</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revenue Bands */}
        {topRevenueBands.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Revenue Distribution</h4>
            <div className="space-y-2">
              {topRevenueBands.map(([band, data]: [string, any]) => (
                <div key={band} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{band}</span>
                  <div className="flex items-center gap-2">
                    <Progress value={data.percentage} className="h-2 w-24" />
                    <span className="font-medium w-12 text-right">{data.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Market Intelligence Insights */}
        <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Market Intelligence</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {topCountryPercent > 60 && (
              <li>• High geographic concentration: {topCountryPercent}% in {topCountries[0][0]}</li>
            )}
            {topIndustryPercent > 40 && (
              <li>• Industry focused: {topIndustryPercent}% in {topIndustries[0][0]}</li>
            )}
            {totalIndustries >= 10 && (
              <li>• Diverse market: {totalIndustries} industries represented</li>
            )}
            {totalCountries >= 20 && (
              <li>• Global reach: Active in {totalCountries} countries</li>
            )}
            <li>• Potential revenue: {formatCurrency(totalTAMValue)} at {formatCurrency(averageDealSize)} ACV</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
