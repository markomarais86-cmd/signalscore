import { SourceFilterToggle, type SourceFilter } from "@/components/executive/SourceFilterToggle";

interface DashboardHeroBannerProps {
  sourceFilter: SourceFilter;
  onSourceFilterChange: (v: SourceFilter) => void;
  filterStats: { crm: number; database: number } | undefined;
  summaryText?: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardHeroBanner({
  sourceFilter,
  onSourceFilterChange,
  filterStats,
  summaryText,
}: DashboardHeroBannerProps) {
  return (
    <div className="hero-banner px-6 py-5">
      <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight text-white font-heading">
            {getGreeting()}
          </h1>
          {summaryText && (
            <p className="text-xs text-white/40 max-w-md leading-relaxed">
              {summaryText}
            </p>
          )}
        </div>
        <SourceFilterToggle
          value={sourceFilter}
          onChange={onSourceFilterChange}
          stats={{ crm: filterStats?.crm || 0, database: filterStats?.database || 0 }}
        />
      </div>
    </div>
  );
}
