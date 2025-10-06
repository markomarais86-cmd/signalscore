import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MapPin, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";

interface GeoData {
  country: string;
  count: number;
  isOther?: boolean;
}

interface GeographyChartCardProps {
  geoData: GeoData[];
  invalidCount?: number;
}

export function GeographyChartCard({ geoData, invalidCount = 0 }: GeographyChartCardProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Calculate total from ALL data
  const totalAccounts = geoData.reduce((sum, g) => sum + g.count, 0);
  const totalCountries = geoData.length;
  
  // Show top 10 by default, or top 20 when expanded
  const displayLimit = isExpanded ? 20 : 10;
  const topCountries = geoData.slice(0, displayLimit);
  const otherCountries = geoData.slice(displayLimit);
  
  // Add "Other" category if there are more countries
  const displayData = [...topCountries];
  if (otherCountries.length > 0) {
    const otherCount = otherCountries.reduce((sum, g) => sum + g.count, 0);
    displayData.push({ 
      country: `Other (${otherCountries.length})`, 
      count: otherCount,
      isOther: true
    });
  }
  
  // Calculate data quality score
  const dataQualityScore = totalAccounts > 0 
    ? Math.round(((totalAccounts - invalidCount) / (totalAccounts + invalidCount)) * 100)
    : 100;

  const getCountryColor = (index: number, isOther?: boolean) => {
    if (isOther) {
      return 'hsl(var(--muted-foreground))';
    }
    const colors = [
      'hsl(var(--signal-high))',
      'hsl(var(--primary))',
      'hsl(var(--signal-medium))',
      'hsl(var(--chart-1))',
      'hsl(var(--chart-2))',
      'hsl(var(--chart-3))',
    ];
    return colors[index % colors.length];
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Geographic Distribution
            </CardTitle>
            <CardDescription>
              Showing top {displayData.length - (otherCountries.length > 0 ? 1 : 0)} of {totalCountries} countries
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm font-semibold">
              {totalAccounts.toLocaleString()} accounts
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {totalCountries} countries
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Chart */}
          <ResponsiveContainer width="100%" height={320}>
            <BarChart 
              data={displayData}
              layout="vertical"
              margin={{ 
                top: 5, 
                right: 30, 
                left: isMobile ? 60 : 100, 
                bottom: 5 
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis 
                type="number" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={isMobile ? 10 : 12}
              />
              <YAxis 
                type="category"
                dataKey="country" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={isMobile ? 10 : 12}
                width={isMobile ? 60 : 90}
                tickFormatter={(value: string) => 
                  isMobile && value.length > 12 
                    ? value.substring(0, 10) + '...' 
                    : value
                }
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const percentage = ((data.count / totalAccounts) * 100).toFixed(1);
                    return (
                      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                        <p className="font-semibold text-sm">{data.country}</p>
                        <p className="text-xs text-muted-foreground">
                          {data.count.toLocaleString()} accounts
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{percentage}%</span>
                        </div>
                        {!data.isOther && (
                          <p className="text-xs text-primary mt-2 flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> Click to filter accounts
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="count" 
                radius={[0, 4, 4, 0]}
                onClick={(data) => {
                  if (!data.isOther) {
                    navigate(`/accounts?country=${encodeURIComponent(data.country)}`);
                  }
                }}
                cursor="pointer"
                className="transition-opacity hover:opacity-80"
              >
                {displayData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getCountryColor(index, entry.isOther)} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Expand/Collapse Button */}
          {geoData.length > 10 && (
            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Show More ({geoData.length - 10} more)
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Data Quality Warning */}
          {dataQualityScore < 95 && invalidCount > 0 && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-sm">
                  {invalidCount} accounts have invalid geography data
                </span>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="h-auto p-0 text-xs"
                  onClick={() => navigate('/settings')}
                >
                  Review issues
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {totalCountries}
              </div>
              <div className="text-xs text-muted-foreground">Total Countries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {geoData[0]?.country || 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">Largest Market</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-signal-high">
                {geoData[0]?.count.toLocaleString() || 0}
              </div>
              <div className="text-xs text-muted-foreground">Accounts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-signal-medium">
                {totalAccounts > 0 ? ((geoData[0]?.count || 0) / totalAccounts * 100).toFixed(1) : 0}%
              </div>
              <div className="text-xs text-muted-foreground">Market Concentration</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
