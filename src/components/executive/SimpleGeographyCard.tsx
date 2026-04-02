import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

interface GeoItem {
  country: string;
  count: number;
  percentage?: number;
}

interface SimpleGeographyCardProps {
  geoData: GeoItem[];
  className?: string;
}

export function SimpleGeographyCard({ geoData, className }: SimpleGeographyCardProps) {
  const navigate = useNavigate();
  const totalAccounts = geoData.reduce((sum, g) => sum + g.count, 0);

  const topCountries = geoData.slice(0, 5).map((item) => ({
    ...item,
    percentage: totalAccounts > 0 ? (item.count / totalAccounts) * 100 : 0,
  }));

  const maxPercentage = Math.max(...topCountries.map((c) => c.percentage || 0), 1);

  return (
    <Card className={`${className ?? ""} border bg-card`}>
      <CardContent className="p-5">
        {topCountries.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">No geography data available</p>
        ) : (
          <div className="space-y-2.5">
            {topCountries.map((item) => (
              <button
                key={item.country}
                type="button"
                className="block w-full rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/20"
                onClick={() => navigate(`/accounts?country=${encodeURIComponent(item.country)}`)}
              >
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground truncate">{item.country}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-foreground tabular-nums">{item.count.toLocaleString()}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums w-8 text-right">{item.percentage?.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
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
