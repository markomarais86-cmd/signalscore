import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useNavigate } from "react-router-dom";

interface GeoData {
  country: string;
  count: number;
}

interface GeographyChartCardProps {
  geoData: GeoData[];
}

export function GeographyChartCard({ geoData }: GeographyChartCardProps) {
  const navigate = useNavigate();
  const topCountries = geoData.slice(0, 12);
  const totalAccounts = topCountries.reduce((sum, g) => sum + g.count, 0);

  const getCountryColor = (index: number) => {
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Geographic Distribution
            </CardTitle>
            <CardDescription>
              Top {topCountries.length} countries by account volume
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-sm">
            {totalAccounts.toLocaleString()} accounts
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Chart */}
          <ResponsiveContainer width="100%" height={320}>
            <BarChart 
              data={topCountries}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis 
                type="number" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12}
              />
              <YAxis 
                type="category"
                dataKey="country" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12}
                width={90}
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
                          {data.count.toLocaleString()} accounts ({percentage}%)
                        </p>
                        <p className="text-xs text-primary mt-1">Click to view accounts</p>
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
                  navigate(`/accounts?country=${encodeURIComponent(data.country)}`);
                }}
                cursor="pointer"
              >
                {topCountries.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getCountryColor(index)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {topCountries.length}
              </div>
              <div className="text-xs text-muted-foreground">Countries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {topCountries[0]?.country || 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">Top Market</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-signal-high">
                {topCountries[0]?.count.toLocaleString() || 0}
              </div>
              <div className="text-xs text-muted-foreground">Top Market Size</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-signal-medium">
                {((topCountries[0]?.count || 0) / totalAccounts * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">Market Share</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
