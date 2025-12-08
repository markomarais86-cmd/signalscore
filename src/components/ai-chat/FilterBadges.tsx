import { X, Filter, Building2, MapPin, Users, DollarSign, Code, Briefcase, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface FilterData {
  type: 'industry' | 'country' | 'size' | 'revenue' | 'tech' | 'title' | 'persona' | 'score' | 'funding' | 'other';
  value: string;
  label?: string;
}

interface FilterBadgesProps {
  filters: FilterData[];
  onRemove?: (filter: FilterData) => void;
  onClearAll?: () => void;
  compact?: boolean;
}

function getFilterIcon(type: FilterData['type']) {
  switch (type) {
    case 'industry': return <Building2 className="w-3 h-3" />;
    case 'country': return <MapPin className="w-3 h-3" />;
    case 'size': return <Users className="w-3 h-3" />;
    case 'revenue': return <DollarSign className="w-3 h-3" />;
    case 'tech': return <Code className="w-3 h-3" />;
    case 'title': return <Briefcase className="w-3 h-3" />;
    case 'persona': return <Users className="w-3 h-3" />;
    case 'score': return <TrendingUp className="w-3 h-3" />;
    case 'funding': return <DollarSign className="w-3 h-3" />;
    default: return <Filter className="w-3 h-3" />;
  }
}

function getFilterColor(type: FilterData['type']): string {
  switch (type) {
    case 'industry': return 'bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20';
    case 'country': return 'bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20';
    case 'size': return 'bg-purple-500/10 text-purple-600 border-purple-500/20 hover:bg-purple-500/20';
    case 'revenue': return 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20';
    case 'tech': return 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20 hover:bg-cyan-500/20';
    case 'title': return 'bg-pink-500/10 text-pink-600 border-pink-500/20 hover:bg-pink-500/20';
    case 'persona': return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 hover:bg-indigo-500/20';
    case 'score': return 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20';
    case 'funding': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20';
    default: return 'bg-muted text-muted-foreground border-border hover:bg-muted/80';
  }
}

export function FilterBadge({ filter, onRemove }: { filter: FilterData; onRemove?: () => void }) {
  return (
    <Badge 
      variant="outline" 
      className={`text-xs px-2 py-0.5 flex items-center gap-1 ${getFilterColor(filter.type)}`}
    >
      {getFilterIcon(filter.type)}
      <span>{filter.label || filter.value}</span>
      {onRemove && (
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 hover:opacity-70"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </Badge>
  );
}

export function FilterBadges({ filters, onRemove, onClearAll, compact = false }: FilterBadgesProps) {
  if (filters.length === 0) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        <Filter className="w-3 h-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{filters.length} filter{filters.length > 1 ? 's' : ''}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Filter className="w-3 h-3" />
          <span>Active filters ({filters.length})</span>
        </div>
        {onClearAll && filters.length > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-5 text-xs px-1"
            onClick={onClearAll}
          >
            Clear all
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {filters.map((filter, i) => (
          <FilterBadge 
            key={`${filter.type}-${filter.value}-${i}`}
            filter={filter}
            onRemove={onRemove ? () => onRemove(filter) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// Helper to parse filters from AI action parameters
export function parseFiltersFromParams(params: Record<string, any>): FilterData[] {
  const filters: FilterData[] = [];

  if (params.industries?.length) {
    params.industries.forEach((i: string) => filters.push({ type: 'industry', value: i }));
  }
  if (params.countries?.length) {
    params.countries.forEach((c: string) => filters.push({ type: 'country', value: c }));
  }
  if (params.job_titles?.length) {
    params.job_titles.forEach((t: string) => filters.push({ type: 'title', value: t }));
  }
  if (params.personas?.length) {
    params.personas.forEach((p: string) => filters.push({ type: 'persona', value: p }));
  }
  if (params.tech_stack?.length) {
    params.tech_stack.forEach((t: string) => filters.push({ type: 'tech', value: t }));
  }
  if (params.revenue_ranges?.length) {
    params.revenue_ranges.forEach((r: string) => filters.push({ type: 'revenue', value: r }));
  }
  if (params.funding_status?.length) {
    params.funding_status.forEach((f: string) => filters.push({ type: 'funding', value: f }));
  }
  if (params.min_employees || params.max_employees) {
    const label = params.min_employees && params.max_employees 
      ? `${params.min_employees}-${params.max_employees} employees`
      : params.min_employees 
        ? `${params.min_employees}+ employees`
        : `Up to ${params.max_employees} employees`;
    filters.push({ type: 'size', value: label, label });
  }
  if (params.min_score) {
    filters.push({ type: 'score', value: `${params.min_score}+`, label: `Score ${params.min_score}+` });
  }
  if (params.recently_funded_days) {
    filters.push({ type: 'funding', value: `${params.recently_funded_days}d`, label: `Funded last ${params.recently_funded_days} days` });
  }

  return filters;
}
