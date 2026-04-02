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
    <div className="hero-banner px-6 py-6">
      <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <h1 className="font-heading text-[1.85rem] font-semibold tracking-[-0.05em] text-white sm:text-[2.1rem]">
            {getGreeting()}
          </h1>
          {summaryText && (
            <p className="max-w-xl text-sm leading-6 text-white/60 sm:text-[15px]">
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
