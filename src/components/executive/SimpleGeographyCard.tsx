import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";

interface GeoItem {
  country: string;
  count: number;
  percentage?: number;
}

interface SimpleGeographyCardProps {
  geoData: GeoItem[];
  className?: string;
}

export function SimpleGeographyCard({
  geoData,
  className,
}: SimpleGeographyCardProps) {
  const navigate = useNavigate();
  const totalAccounts = geoData.reduce((sum, g) => sum + g.count, 0);
  
  // Get top 5 countries
  const topCountries = geoData
    .slice(0, 5)
    .map(item => ({
      ...item,
      percentage: totalAccounts > 0 ? (item.count / totalAccounts) * 100 : 0,
    }));

  const maxPercentage = Math.max(...topCountries.map(c => c.percentage), 1);

  return (
    <Card className={`${className} floating-card border-border/30 bg-card/90 backdrop-blur-xl shadow-xl shadow-primary/5 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500`}>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-md bg-primary/10">
            <MapPin className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">Top Geographies</span>
        </div>

        {topCountries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No geography data available</p>
        ) : (
          <div className="space-y-3">
            {topCountries.map((item, idx) => (
              <div
                key={item.country}
                className="space-y-1.5 cursor-pointer hover:bg-muted/30 rounded-md px-2 py-1 -mx-2 transition-colors"
                onClick={() => navigate(`/accounts?country=${encodeURIComponent(item.country)}`)}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground truncate max-w-[150px]">
                    {item.country}
                  </span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{item.count.toLocaleString()}</span>
                    <span className="text-xs">({item.percentage.toFixed(0)}%)</span>
                  </div>
                </div>
                <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-700"
                    style={{ 
                      width: `${(item.percentage / maxPercentage) * 100}%`,
                      background: `linear-gradient(90deg, hsl(161 85% 60%) 0%, hsl(161 85% 50%) 100%)`,
                      boxShadow: idx === 0 ? '0 0 8px hsl(161 85% 60% / 0.5)' : undefined,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Total */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total accounts with geography</span>
            <span className="font-medium text-foreground">{totalAccounts.toLocaleString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}