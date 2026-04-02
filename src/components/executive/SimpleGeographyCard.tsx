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
    return <div className={`${className ?? ""} p-6 text-center text-xs text-muted-foreground`}>No geography data</div>;
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
              className="flex w-full items-center gap-3 px-3 py-2 text-left rounded-md transition-all hover:bg-muted/10 group animate-fade-in-up"
              style={{ animationDelay: `${idx * 50}ms` }}
              onClick={() => navigate(`/accounts?country=${encodeURIComponent(item.country)}`)}
            >
              <span className="text-xs text-foreground truncate flex-1 min-w-0 group-hover:text-primary transition-colors">
                {item.country}
              </span>
              <div className="w-20 h-1.5 rounded-full bg-border/50 overflow-hidden shrink-0">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                  style={{ width: `${barPct}%`, opacity: 1 - idx * 0.1 }}
                />
              </div>
              <span className="text-[11px] font-mono tabular-nums text-muted-foreground w-12 text-right shrink-0">
                {item.count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
