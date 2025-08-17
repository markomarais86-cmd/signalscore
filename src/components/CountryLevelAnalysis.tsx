import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, MapPin, DollarSign, Users } from "lucide-react";
import { SignalScoreDisplay } from "@/components/SignalScoreDisplay";

interface CountryData {
  country: string;
  countryCode: string;
  region: string;
  icpAccounts: number;
  tamRevenue: number;
  signalScore: number;
  conversionRate: number;
  marketPenetration: number;
  averageDealSize: number;
}

interface CountryLevelAnalysisProps {
  data: CountryData[];
}

export function CountryLevelAnalysis({ data }: CountryLevelAnalysisProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const sortedData = [...data].sort((a, b) => b.tamRevenue - a.tamRevenue);

  const getRegionBadgeColor = (region: string) => {
    switch (region.toLowerCase()) {
      case 'north america': return 'bg-blue-500';
      case 'europe': return 'bg-green-500';
      case 'asia pacific': return 'bg-purple-500';
      case 'latin america': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Country-Level TAM Analysis
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          ICP account distribution and revenue potential by country
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedData.map((country, index) => (
            <div key={country.countryCode} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {country.country}
                        <Badge 
                          variant="secondary" 
                          className={`text-white text-xs ${getRegionBadgeColor(country.region)}`}
                        >
                          {country.region}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {country.countryCode}
                      </div>
                    </div>
                  </div>
                </div>
                <SignalScoreDisplay 
                  score={country.signalScore} 
                  size="sm" 
                  showLabel={false}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <Users className="h-3 w-3" />
                    <span className="text-xs">ICP Accounts</span>
                  </div>
                  <div className="font-bold text-lg">{country.icpAccounts.toLocaleString()}</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <DollarSign className="h-3 w-3" />
                    <span className="text-xs">TAM Revenue</span>
                  </div>
                  <div className="font-bold text-lg text-[hsl(var(--primary))]">
                    {formatCurrency(country.tamRevenue)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Conversion Rate</div>
                  <div className="font-bold text-lg">{country.conversionRate}%</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Avg Deal Size</div>
                  <div className="font-bold text-lg">{formatCurrency(country.averageDealSize)}</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">
                  Market Penetration: {country.marketPenetration}%
                </div>
                <div className={`font-medium ${
                  country.signalScore >= 80 ? 'text-[hsl(var(--signal-high))]' :
                  country.signalScore >= 60 ? 'text-[hsl(var(--signal-medium))]' :
                  'text-[hsl(var(--signal-low))]'
                }`}>
                  {country.signalScore >= 80 ? 'High Priority' :
                   country.signalScore >= 60 ? 'Medium Priority' :
                   'Low Priority'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}