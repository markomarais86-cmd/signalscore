import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Building2, Layers } from "lucide-react";

export type SourceFilter = 'all' | 'crm' | 'database';

interface SourceFilterToggleProps {
  value: SourceFilter;
  onChange: (filter: SourceFilter) => void;
  stats: {
    total: number;
    crm: number;
    database: number;
  };
}

export function SourceFilterToggle({ value, onChange, stats }: SourceFilterToggleProps) {
  const filters = [
    { 
      value: 'all' as const, 
      label: 'All Sources', 
      icon: Layers, 
      count: stats.total,
      tooltip: 'All actual records: CRM syncs, manual uploads, imported contacts (excludes Apollo metadata)'
    },
    { 
      value: 'crm' as const, 
      label: 'CRM Only', 
      icon: Building2, 
      count: stats.crm,
      tooltip: 'CRM-sourced records: Salesforce/HubSpot syncs, CSV uploads, closed-won deals'
    },
    { 
      value: 'database' as const, 
      label: 'Database Only', 
      icon: Database, 
      count: stats.database,
      tooltip: 'Imported records only: Previously redeemed contacts from Apollo or other imports'
    },
  ];

  return (
    <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isActive = value === filter.value;
        
        return (
          <Button
            key={filter.value}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            onClick={() => onChange(filter.value)}
            className="gap-2"
            title={filter.tooltip}
          >
            <Icon className="h-4 w-4" />
            {filter.label}
            <Badge variant={isActive ? "secondary" : "outline"} className="ml-1">
              {filter.count.toLocaleString()}
            </Badge>
          </Button>
        );
      })}
    </div>
  );
}
