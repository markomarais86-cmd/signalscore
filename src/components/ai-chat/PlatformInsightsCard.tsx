import { useState } from 'react';
import { 
  Building2, 
  Users, 
  Target, 
  TrendingUp, 
  ChevronDown, 
  ChevronUp,
  BarChart3,
  AlertCircle,
  CheckCircle,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface PlatformInsightsData {
  total_accounts: number;
  total_leads: number;
  scored_accounts: number;
  high_fit: number;
  medium_fit: number;
  low_fit: number;
  icps: Array<{ id: string; name: string; status: string }>;
  data_quality?: {
    completeness: number;
    accounts_with_contacts: number;
    accounts_with_industry: number;
    accounts_with_revenue: number;
  };
  recommendations?: string[];
}

interface PlatformInsightsCardProps {
  insights: PlatformInsightsData;
  onAction?: (action: string) => void;
  compact?: boolean;
}

export function PlatformInsightsCard({ insights, onAction, compact = false }: PlatformInsightsCardProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);

  const totalScored = insights.scored_accounts || 0;
  const highFitPercent = totalScored > 0 ? Math.round((insights.high_fit / totalScored) * 100) : 0;
  const medFitPercent = totalScored > 0 ? Math.round((insights.medium_fit / totalScored) * 100) : 0;
  const lowFitPercent = totalScored > 0 ? Math.round((insights.low_fit / totalScored) * 100) : 0;
  const activeIcps = insights.icps?.filter(i => i.status === 'active') || [];

  const stats = [
    { label: 'Accounts', value: insights.total_accounts, icon: Building2, color: 'text-blue-500' },
    { label: 'Contacts', value: insights.total_leads, icon: Users, color: 'text-purple-500' },
    { label: 'Scored', value: totalScored, icon: Target, color: 'text-orange-500' },
    { label: 'High Fit', value: insights.high_fit, icon: TrendingUp, color: 'text-[hsl(var(--status-success))]' },
  ];

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Platform Insights</h3>
            <p className="text-xs text-muted-foreground">
              {insights.total_accounts} accounts • {insights.high_fit} high-fit
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Stats Grid - Always visible */}
      <div className="grid grid-cols-4 gap-2 p-3 border-b">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <stat.icon className={cn("h-4 w-4 mx-auto mb-1", stat.color)} />
            <div className="text-lg font-bold">{stat.value.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-3 space-y-4">
          {/* Fit Distribution */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Fit Distribution</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[hsl(var(--status-success))]" />
                      High Fit
                    </span>
                    <span className="font-medium">{insights.high_fit} ({highFitPercent}%)</span>
                  </div>
                  <Progress value={highFitPercent} className="h-2" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[hsl(var(--status-warning))]" />
                      Medium Fit
                    </span>
                    <span className="font-medium">{insights.medium_fit} ({medFitPercent}%)</span>
                  </div>
                  <Progress value={medFitPercent} className="h-2 [&>div]:bg-[hsl(var(--status-warning))]" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                      Low Fit
                    </span>
                    <span className="font-medium">{insights.low_fit} ({lowFitPercent}%)</span>
                  </div>
                  <Progress value={lowFitPercent} className="h-2 [&>div]:bg-muted-foreground" />
                </div>
              </div>
            </div>
          </div>

          {/* Data Quality */}
          {insights.data_quality && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Data Completeness</h4>
              <div className="flex items-center gap-2 mb-1">
                <Progress value={insights.data_quality.completeness} className="flex-1 h-2" />
                <span className="text-xs font-medium">{insights.data_quality.completeness}%</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  {insights.data_quality.accounts_with_contacts > 50 ? (
                    <CheckCircle className="h-3 w-3 text-[hsl(var(--status-success))]" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-[hsl(var(--status-warning))]" />
                  )}
                  {insights.data_quality.accounts_with_contacts}% w/ contacts
                </div>
                <div className="flex items-center gap-1">
                  {insights.data_quality.accounts_with_industry > 70 ? (
                    <CheckCircle className="h-3 w-3 text-[hsl(var(--status-success))]" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-[hsl(var(--status-warning))]" />
                  )}
                  {insights.data_quality.accounts_with_industry}% w/ industry
                </div>
                <div className="flex items-center gap-1">
                  {insights.data_quality.accounts_with_revenue > 50 ? (
                    <CheckCircle className="h-3 w-3 text-[hsl(var(--status-success))]" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-[hsl(var(--status-warning))]" />
                  )}
                  {insights.data_quality.accounts_with_revenue}% w/ revenue
                </div>
              </div>
            </div>
          )}

          {/* Active ICPs */}
          {activeIcps.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Active ICPs</h4>
              <div className="flex flex-wrap gap-1">
                {activeIcps.map(icp => (
                  <Badge key={icp.id} variant="secondary" className="text-xs">
                    <Target className="h-3 w-3 mr-1" />
                    {icp.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {insights.recommendations && insights.recommendations.length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <h4 className="text-xs font-medium flex items-center gap-1 mb-2">
                <Sparkles className="h-3 w-3 text-primary" />
                Recommendations
              </h4>
              <ul className="space-y-1">
                {insights.recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick Actions */}
          {onAction && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button 
                size="sm" 
                variant="outline" 
                className="text-xs h-7"
                onClick={() => onAction('Analyze my pipeline health')}
              >
                <BarChart3 className="h-3 w-3 mr-1" />
                Analyze Pipeline
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="text-xs h-7"
                onClick={() => onAction('Show me high-fit accounts')}
              >
                <TrendingUp className="h-3 w-3 mr-1" />
                View High-Fit
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="text-xs h-7"
                onClick={() => onAction('Identify gaps in my data')}
              >
                <AlertCircle className="h-3 w-3 mr-1" />
                Find Gaps
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface PlatformInsightsListProps {
  insights: PlatformInsightsData;
  onAction?: (action: string) => void;
}

export function PlatformInsightsList({ insights, onAction }: PlatformInsightsListProps) {
  return <PlatformInsightsCard insights={insights} onAction={onAction} />;
}
