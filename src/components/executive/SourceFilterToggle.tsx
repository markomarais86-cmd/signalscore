import { Database, Building2 } from "lucide-react";

export type SourceFilter = 'crm' | 'database';

interface SourceFilterToggleProps {
  value: SourceFilter;
  onChange: (filter: SourceFilter) => void;
  stats: {
    crm: number;
    database: number;
  };
}

export function SourceFilterToggle({ value, onChange, stats }: SourceFilterToggleProps) {
  const filters = [
    { 
      value: 'crm' as const, 
      label: 'CRM', 
      icon: Building2, 
      count: stats.crm,
      tooltip: 'CRM-sourced records: Salesforce/HubSpot syncs, CSV uploads, closed-won deals'
    },
    { 
      value: 'database' as const, 
      label: 'Database', 
      icon: Database, 
      count: stats.database,
      tooltip: 'Available in external databases (Apollo, ZoomInfo) matching your ICP - ready to import'
    },
  ];

  return (
    <div className="segmented-filter">
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isActive = value === filter.value;
        
        return (
          <button
            key={filter.value}
            type="button"
            onClick={() => onChange(filter.value)}
            className="segmented-filter__button"
            data-active={isActive}
            aria-pressed={isActive}
            title={filter.tooltip}
          >
            <Icon className="h-3.5 w-3.5" />
            {filter.label}
            <span className="segmented-filter__count">
              {filter.count.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
