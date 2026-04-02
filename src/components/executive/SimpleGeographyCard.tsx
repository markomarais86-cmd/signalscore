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

  const topCountries = geoData
    .slice(0, 5)
    .map((item) => ({
      ...item,
      percentage: totalAccounts > 0 ? (item.count / totalAccounts) * 100 : 0,
    }));

  const maxPercentage = Math.max(...topCountries.map((c) => c.percentage || 0), 1);

  return (
    <Card className={`${className ?? ""} border bg-card shadow-sm`}>
      <CardContent className="p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Top Geographies</h3>
              <p className="text-xs text-muted-foreground">Regional concentration across scored accounts.</p>
            </div>
          </div>
          <div className="rounded-full border border-border bg-muted/20 px-3 py-1 text-xs text-muted-foreground">
            {totalAccounts.toLocaleString()} total
          </div>
        </div>

        {topCountries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No geography data available</p>
        ) : (
          <div className="space-y-4">
            {topCountries.map((item) => (
              <button
                key={item.country}
                type="button"
                className="block w-full rounded-xl border bg-muted/10 px-4 py-3 text-left transition-colors hover:bg-muted/20"
                onClick={() => navigate(`/accounts?country=${encodeURIComponent(item.country)}`)}
              >
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-foreground">{item.country}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono text-foreground">{item.count.toLocaleString()}</span>
                    <span>({item.percentage?.toFixed(0)}%)</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${((item.percentage || 0) / maxPercentage) * 100}%`,
                      backgroundColor: "hsl(var(--primary))",
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
