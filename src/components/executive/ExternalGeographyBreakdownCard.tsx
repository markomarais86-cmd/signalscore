import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, MapPin, Users, Building2, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { formatAbbreviated } from "@/utils/format-numbers";
import { Badge } from "@/components/ui/badge";

interface GeographyData {
  [country: string]: {
    accounts: number;
    contacts?: number;
    percentage: number;
  };
}

interface ExternalGeographyBreakdownCardProps {
  geographyData: GeographyData;
  provider: string;
}

export function ExternalGeographyBreakdownCard({
  geographyData,
  provider
}: ExternalGeographyBreakdownCardProps) {
  // Get top countries
  const topCountries = useMemo(() => {
    if (!geographyData) return [];
    
    return Object.entries(geographyData)
      .sort(([, a], [, b]) => b.accounts - a.accounts)
      .slice(0, 10);
  }, [geographyData]);

  const totalAccounts = useMemo(() => {
    if (!geographyData) return 0;
    return Object.values(geographyData).reduce((sum, data) => sum + data.accounts, 0);
  }, [geographyData]);

  const totalContacts = useMemo(() => {
    if (!geographyData) return 0;
    return Object.values(geographyData).reduce((sum, data) => sum + (data.contacts || 0), 0);
  }, [geographyData]);

  if (!geographyData || Object.keys(geographyData).length === 0) {
    return null;
  }

  // Calculate market concentration
  const top3Concentration = topCountries.slice(0, 3).reduce((sum, [_, data]) => sum + data.percentage, 0);
  const isHighlyConcentrated = top3Concentration > 75;
  const isDiversified = Object.keys(geographyData).length >= 15;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Geographic Distribution
          </CardTitle>
          <Badge variant="outline" className="gap-1">
            <MapPin className="h-3 w-3" />
            {Object.keys(geographyData).length} countries
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1 text-center p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" />
              Countries
            </div>
            <p className="text-2xl font-bold">{Object.keys(geographyData).length}</p>
          </div>
          <div className="space-y-1 text-center p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              Accounts
            </div>
            <p className="text-2xl font-bold">{formatAbbreviated(totalAccounts)}</p>
          </div>
          <div className="space-y-1 text-center p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              Contacts
            </div>
            <p className="text-2xl font-bold">{formatAbbreviated(totalContacts)}</p>
          </div>
        </div>

        {/* Top Markets with Visual Hierarchy */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Top Markets</h4>
            <span className="text-xs text-muted-foreground">by account count</span>
          </div>
          <div className="space-y-3">
            {topCountries.map(([country, data], index) => (
              <div key={country} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      index === 0 ? 'bg-primary/20 text-primary' :
                      index === 1 ? 'bg-primary/10 text-primary' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{country}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatAbbreviated(data.accounts)} accounts
                        {data.contacts && ` • ${formatAbbreviated(data.contacts)} contacts`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{data.percentage}%</div>
                  </div>
                </div>
                <Progress value={data.percentage} className="h-2" />
              </div>
            ))}
          </div>
        </div>

        {/* Market Insights */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Market Insights
          </h4>
          <div className="grid gap-3">
            <div className="rounded-lg border bg-muted/50 p-3">
              <div className="text-sm">
                <span className="font-medium text-foreground">Market Concentration: </span>
                <span className="text-muted-foreground">
                  Top 3 markets represent{' '}
                  <span className="font-semibold text-foreground">{top3Concentration.toFixed(1)}%</span>
                  {' '}of total market
                </span>
              </div>
            </div>
            
            {isHighlyConcentrated && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="text-sm text-amber-700 dark:text-amber-400">
                  <span className="font-medium">⚠️ Concentrated Market: </span>
                  Consider diversifying into secondary markets to reduce geographic risk
                </div>
              </div>
            )}
            
            {isDiversified && (
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                <div className="text-sm text-green-700 dark:text-green-400">
                  <span className="font-medium">✓ Well Diversified: </span>
                  Strong presence across {Object.keys(geographyData).length} markets provides stability
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}