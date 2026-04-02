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
      <div className="space-y-2 px-5 pb-5 pt-2">
        {topCountries.map((item, idx) => {
          const barPct = (item.count / maxCount) * 100;
          return (
            <button
              key={item.country}
              type="button"
              className="group grid w-full grid-cols-[auto_1fr] items-center gap-3 rounded-[0.95rem] px-4 py-3 text-left transition-all hover:bg-muted/10 animate-fade-in-up"
              style={{ animationDelay: `${idx * 50}ms` }}
              onClick={() => navigate(`/accounts?country=${encodeURIComponent(item.country)}`)}
            >
              <span className="font-heading text-[1rem] font-semibold tracking-[-0.05em] text-muted-foreground/80 tabular-nums">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[14px] font-medium text-foreground transition-colors group-hover:text-primary">
                    {item.country}
                  </span>
                  <span className="text-[13px] text-muted-foreground tabular-nums">
                    {item.percentage?.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-2 flex-1 shrink-0 overflow-hidden rounded-full bg-border/50">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                      style={{ width: `${barPct}%`, opacity: 1 - idx * 0.08 }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-[13px] text-muted-foreground tabular-nums">
                    {item.count.toLocaleString()}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
