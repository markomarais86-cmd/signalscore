import { Search, Users, Building2, TrendingUp, FileText, RefreshCw, Target, Zap, BarChart3, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SuggestedAction {
  id: string;
  label: string;
  prompt: string;
  icon?: 'search' | 'users' | 'building' | 'trending' | 'file' | 'refresh' | 'target' | 'zap' | 'chart' | 'sparkles';
  variant?: 'default' | 'primary' | 'secondary';
}

interface SuggestedActionsProps {
  actions: SuggestedAction[];
  onActionClick: (prompt: string) => void;
  title?: string;
  compact?: boolean;
}

function getIcon(icon?: SuggestedAction['icon']) {
  const className = "w-3 h-3";
  switch (icon) {
    case 'search': return <Search className={className} />;
    case 'users': return <Users className={className} />;
    case 'building': return <Building2 className={className} />;
    case 'trending': return <TrendingUp className={className} />;
    case 'file': return <FileText className={className} />;
    case 'refresh': return <RefreshCw className={className} />;
    case 'target': return <Target className={className} />;
    case 'zap': return <Zap className={className} />;
    case 'chart': return <BarChart3 className={className} />;
    case 'sparkles': return <Sparkles className={className} />;
    default: return <Zap className={className} />;
  }
}

export function SuggestedActions({ actions, onActionClick, title, compact = false }: SuggestedActionsProps) {
  if (actions.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {actions.slice(0, 3).map((action) => (
          <Button
            key={action.id}
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => onActionClick(action.prompt)}
          >
            {getIcon(action.icon)}
            <span className="ml-1">{action.label}</span>
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {title && (
        <p className="text-xs text-muted-foreground font-medium">{title}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <Button
            key={action.id}
            variant={action.variant === 'primary' ? 'default' : action.variant === 'secondary' ? 'secondary' : 'outline'}
            size="sm"
            className={cn(
              "h-7 text-xs px-2.5",
              action.variant === 'primary' && "bg-primary hover:bg-primary/90"
            )}
            onClick={() => onActionClick(action.prompt)}
          >
            {getIcon(action.icon)}
            <span className="ml-1">{action.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

// Pre-built suggestion sets for different contexts
export function getSearchFollowUpActions(resultType: 'accounts' | 'contacts', hasResults: boolean): SuggestedAction[] {
  if (!hasResults) {
    return [
      { id: 'broaden', label: 'Broaden search', prompt: 'Search with fewer filters', icon: 'search' },
      { id: 'similar', label: 'Try similar criteria', prompt: 'Search for similar companies with different industries', icon: 'building' },
    ];
  }

  if (resultType === 'accounts') {
    return [
      { id: 'decision-makers', label: 'Find decision makers', prompt: 'Find decision makers at these accounts', icon: 'users', variant: 'primary' },
      { id: 'similar', label: 'Find similar', prompt: 'Find similar accounts to the top result', icon: 'building' },
      { id: 'refine', label: 'Refine filters', prompt: 'Add more filters to narrow results', icon: 'target' },
      { id: 'export', label: 'Export list', prompt: 'Export these accounts to CSV', icon: 'file' },
    ];
  }

  return [
    { id: 'view-accounts', label: 'View their accounts', prompt: 'Show me the accounts these contacts work at', icon: 'building' },
    { id: 'more-contacts', label: 'Find more like these', prompt: 'Find more contacts with similar titles', icon: 'users' },
  ];
}

export function getAnalyticsFollowUpActions(analysisType: string): SuggestedAction[] {
  return [
    { id: 'drill-down', label: 'Drill down', prompt: `Show more details about ${analysisType}`, icon: 'chart' },
    { id: 'compare', label: 'Compare segments', prompt: 'Compare this segment to another', icon: 'trending' },
    { id: 'recommend', label: 'Get recommendations', prompt: 'What actions should I take based on this?', icon: 'sparkles', variant: 'primary' },
  ];
}

export function getEmptyStateActions(): SuggestedAction[] {
  return [
    { id: 'search-accounts', label: 'Search accounts', prompt: 'Find tech companies with CTOs scoring above 70', icon: 'search', variant: 'primary' },
    { id: 'pipeline', label: 'Analyze pipeline', prompt: 'Analyze my pipeline health', icon: 'chart' },
    { id: 'recommendations', label: 'Get recommendations', prompt: 'What accounts should I prioritize this week?', icon: 'sparkles' },
    { id: 'insights', label: 'Get insights', prompt: 'Show me platform insights', icon: 'trending' },
  ];
}

export function getContextualActions(context: { 
  currentPage?: string; 
  hasActiveIcp?: boolean;
  viewingAccount?: string;
}): SuggestedAction[] {
  const actions: SuggestedAction[] = [];

  if (context.viewingAccount) {
    actions.push(
      { id: 'find-contacts', label: 'Find contacts', prompt: `Find decision makers at this account`, icon: 'users', variant: 'primary' },
      { id: 'similar', label: 'Find similar', prompt: `Find companies similar to this one`, icon: 'building' }
    );
  } else if (context.currentPage?.includes('icp')) {
    actions.push(
      { id: 'create-icp', label: 'Create new ICP', prompt: 'Help me create a new ICP', icon: 'target', variant: 'primary' },
      { id: 'improve-icp', label: 'Improve ICP', prompt: 'How can I improve my current ICP?', icon: 'sparkles' }
    );
  } else if (context.currentPage?.includes('accounts')) {
    actions.push(
      { id: 'search', label: 'Search accounts', prompt: 'Search for high-fit accounts', icon: 'search', variant: 'primary' },
      { id: 'analyze', label: 'Analyze territory', prompt: 'Analyze my account territory', icon: 'chart' }
    );
  }

  return actions.length > 0 ? actions : getEmptyStateActions();
}
