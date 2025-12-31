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
    <Card className={`${className} border-border/50 bg-card/80 backdrop-blur-sm hover:border-primary/20 transition-colors duration-300`}>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Top Geographies</span>
        </div>

        {topCountries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No geography data available</p>
        ) : (
          <div className="space-y-3">
            {topCountries.map((item) => (
              <div key={item.country} className="space-y-1.5">
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
                    className="h-full rounded-full bg-primary/70 transition-all duration-500"
                    style={{ 
                      width: `${(item.percentage / maxPercentage) * 100}%`,
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
