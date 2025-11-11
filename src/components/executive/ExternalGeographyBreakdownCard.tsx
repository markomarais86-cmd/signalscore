import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MapPin, Globe, TrendingUp, Database } from "lucide-react";
import { WorldMapHeatmap } from "@/components/WorldMapHeatmap";
import { useMemo } from "react";

interface GeographyData {
  [country: string]: {
    accounts: number;
    contacts: number;
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
  // Transform data for the world map
  const mapData = useMemo(() => {
    if (!geographyData) return [];
    
    return Object.entries(geographyData).map(([country, data]) => ({
      country,
      count: data.accounts,
      isOther: false
    }));
  }, [geographyData]);

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
    return Object.values(geographyData).reduce((sum, data) => sum + data.contacts, 0);
  }, [geographyData]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', { 
      notation: 'compact',
      maximumFractionDigits: 1 
    }).format(num);
  };

  const getColorIntensity = (percentage: number) => {
    if (percentage >= 20) return "hsl(var(--signal-high))";
    if (percentage >= 10) return "hsl(var(--chart-2))";
    if (percentage >= 5) return "hsl(var(--chart-3))";
    return "hsl(var(--muted-foreground))";
  };

  if (!geographyData || Object.keys(geographyData).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Geographic Distribution
          </CardTitle>
          <CardDescription>No geographic data available</CardDescription>
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
              <Globe className="h-5 w-5 text-primary" />
              Geographic Distribution (External TAM)
            </CardTitle>
            <CardDescription>
              Available market breakdown by country from {provider}
            </CardDescription>
          </div>
          <Badge variant="outline" className="gap-1">
            <Database className="h-3 w-3" />
            {provider}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">
              {Object.keys(geographyData).length}
            </div>
            <div className="text-sm text-muted-foreground">Countries</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {formatNumber(totalAccounts)}
            </div>
            <div className="text-sm text-muted-foreground">Total Accounts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-chart-2">
              {formatNumber(totalContacts)}
            </div>
            <div className="text-sm text-muted-foreground">Est. Contacts</div>
          </div>
        </div>

        {/* World Map - Simple country list instead of complex map */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Top Markets
          </h4>
          
          <div className="space-y-3">
            {topCountries.map(([country, data], index) => (
              <div key={country} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-6 h-6 p-0 justify-center">
                      {index + 1}
                    </Badge>
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{country}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-semibold text-foreground">
                        {formatNumber(data.accounts)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatNumber(data.contacts)} contacts
                      </div>
                    </div>
                    <Badge 
                      variant="secondary"
                      style={{ 
                        backgroundColor: `${getColorIntensity(data.percentage)}20`,
                        color: getColorIntensity(data.percentage)
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
                    '--progress-background': getColorIntensity(data.percentage)
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Market Concentration Insight */}
        {topCountries.length > 0 && (
          <div className="bg-muted/30 rounded-lg p-3 text-sm">
            <p className="text-muted-foreground">
              <strong className="text-foreground">Market Concentration:</strong> Top 3 countries 
              represent {topCountries.slice(0, 3).reduce((sum, [, data]) => sum + data.percentage, 0).toFixed(1)}% 
              of your total addressable market ({formatNumber(topCountries.slice(0, 3).reduce((sum, [, data]) => sum + data.accounts, 0))} accounts).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}