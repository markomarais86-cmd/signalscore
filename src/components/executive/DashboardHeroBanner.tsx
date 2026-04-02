import { SourceFilterToggle, type SourceFilter } from "@/components/executive/SourceFilterToggle";

interface DashboardHeroBannerProps {
  sourceFilter: SourceFilter;
  onSourceFilterChange: (v: SourceFilter) => void;
  filterStats: { crm: number; database: number } | undefined;
  summaryText?: string;
}

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return value.toLocaleString();
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
  const crmCount = filterStats?.crm || 0;
  const databaseCount = filterStats?.database || 0;

  return (
    <div className="hero-banner">
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="hero-kicker">{getGreeting()}</p>
            <h1 className="hero-title">Growth Command Center</h1>
          </div>
          {summaryText && (
            <p className="hero-summary">{summaryText}</p>
          )}

          <div className="hero-stat-strip">
            <div className="hero-stat">
              <span className="hero-stat__label">CRM records</span>
              <span className="hero-stat__value">{formatCompactNumber(crmCount)}</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat__label">Database records</span>
              <span className="hero-stat__value">{formatCompactNumber(databaseCount)}</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat__label">Active scope</span>
              <span className="hero-stat__value">{sourceFilter === "crm" ? "CRM" : "Database"}</span>
            </div>
          </div>
        </div>

        <div className="relative lg:max-w-[22rem]">
          <SourceFilterToggle
            value={sourceFilter}
            onChange={onSourceFilterChange}
            stats={{ crm: crmCount, database: databaseCount }}
          />
        </div>
      </div>
    </div>
  );
}
