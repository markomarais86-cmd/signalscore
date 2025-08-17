import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, MapPin } from "lucide-react";

interface CountryHeatmapData {
  country: string;
  countryCode: string;
  tamValue: number;
  signalScore: number;
  accountCount: number;
  region: string;
  coordinates: [number, number]; // [lat, lng]
}

interface WorldMapHeatmapProps {
  data: CountryHeatmapData[];
}

export function WorldMapHeatmap({ data }: WorldMapHeatmapProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const getHeatmapColor = (tamValue: number, maxTam: number) => {
    const intensity = tamValue / maxTam;
    if (intensity >= 0.8) return "bg-[hsl(var(--signal-high))]";
    if (intensity >= 0.6) return "bg-[hsl(var(--signal-medium))]";
    if (intensity >= 0.4) return "bg-[hsl(var(--primary))]";
    if (intensity >= 0.2) return "bg-[hsl(var(--primary))]/60";
    return "bg-[hsl(var(--primary))]/30";
  };

  const getScoreIndicator = (score: number) => {
    if (score >= 80) return "🟢";
    if (score >= 60) return "🟡";
    return "🔴";
  };

  const maxTam = Math.max(...data.map(d => d.tamValue));
  const sortedData = [...data].sort((a, b) => b.tamValue - a.tamValue);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Global TAM Heatmap
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Interactive view of TAM distribution and SignalScore performance by country
        </p>
      </CardHeader>
      <CardContent>
        {/* Simplified world map representation with country data */}
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium">TAM Intensity:</div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-[hsl(var(--primary))]/30"></div>
                <span className="text-xs">Low</span>
                <div className="w-3 h-3 rounded bg-[hsl(var(--signal-medium))]"></div>
                <span className="text-xs">Medium</span>
                <div className="w-3 h-3 rounded bg-[hsl(var(--signal-high))]"></div>
                <span className="text-xs">High</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium">SignalScore:</div>
              <div className="flex items-center gap-2">
                <span className="text-sm">🔴 Low</span>
                <span className="text-sm">🟡 Medium</span>
                <span className="text-sm">🟢 High</span>
              </div>
            </div>
          </div>

          {/* Country grid representation */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedData.map((country) => (
              <div
                key={country.countryCode}
                className={`p-3 rounded-lg border-2 transition-all hover:shadow-md cursor-pointer ${getHeatmapColor(country.tamValue, maxTam)}/20 border-${getHeatmapColor(country.tamValue, maxTam).replace('bg-', '')}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{country.country}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-lg">{getScoreIndicator(country.signalScore)}</span>
                    <span className="text-xs font-medium">{country.signalScore}</span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TAM:</span>
                    <span className="font-medium text-[hsl(var(--primary))]">
                      {formatCurrency(country.tamValue)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Accounts:</span>
                    <span className="font-medium">{country.accountCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Region:</span>
                    <Badge variant="outline" className="text-xs">
                      {country.region}
                    </Badge>
                  </div>
                </div>

                {/* TAM intensity bar */}
                <div className="mt-2">
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${getHeatmapColor(country.tamValue, maxTam)}`}
                      style={{ width: `${(country.tamValue / maxTam) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="text-center">
              <div className="text-lg font-bold">{data.length}</div>
              <div className="text-xs text-muted-foreground">Countries</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-[hsl(var(--primary))]">
                {formatCurrency(data.reduce((sum, d) => sum + d.tamValue, 0))}
              </div>
              <div className="text-xs text-muted-foreground">Total TAM</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">
                {data.reduce((sum, d) => sum + d.accountCount, 0).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">Total Accounts</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">
                {Math.round(data.reduce((sum, d) => sum + d.signalScore, 0) / data.length)}
              </div>
              <div className="text-xs text-muted-foreground">Avg Score</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}