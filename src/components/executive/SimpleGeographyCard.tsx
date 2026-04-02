import { useNavigate } from "react-router-dom";

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
  const topCountries = geoData.slice(0, 6).map((item) => ({
    ...item,
    percentage: totalAccounts > 0 ? (item.count / totalAccounts) * 100 : 0,
  }));
  const maxCount = Math.max(...topCountries.map((c) => c.count), 1);

  if (topCountries.length === 0) {
    return <div className={`${className ?? ""} p-6 text-center text-sm text-muted-foreground`}>No geography data</div>;
  }

  return (
    <div className={className}>
      <div className="space-y-0.5 p-1">
        {topCountries.map((item, idx) => {
          const barPct = (item.count / maxCount) * 100;
          return (
            <button
              key={item.country}
              type="button"
              className="group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-all hover:bg-muted/10 animate-fade-in-up"
              style={{ animationDelay: `${idx * 50}ms` }}
              onClick={() => navigate(`/accounts?country=${encodeURIComponent(item.country)}`)}
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground transition-colors group-hover:text-primary">
                {item.country}
              </span>
              <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-border/50">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                  style={{ width: `${barPct}%`, opacity: 1 - idx * 0.1 }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-[12px] text-muted-foreground tabular-nums">
                {item.count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
