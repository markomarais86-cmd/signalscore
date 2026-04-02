import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    <div className="flex items-center gap-1 rounded-lg bg-muted/70 p-1">
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isActive = value === filter.value;
        
        return (
          <Button
            key={filter.value}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            onClick={() => onChange(filter.value)}
            className="h-9 gap-2 px-3 text-[12px] font-medium"
            title={filter.tooltip}
          >
            <Icon className="h-3.5 w-3.5" />
            {filter.label}
            <Badge variant={isActive ? "secondary" : "outline"} className="ml-1 text-[11px] font-medium tabular-nums">
              {filter.count.toLocaleString()}
            </Badge>
          </Button>
        );
      })}
    </div>
  );
}
