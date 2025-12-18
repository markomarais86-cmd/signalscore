import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Sparkles, 
  Phone, 
  Mail, 
  Calendar, 
  MessageSquare, 
  ChevronRight, 
  Check, 
  X,
  RefreshCw,
  Zap
} from 'lucide-react';
import { 
  useNextBestActions, 
  useCompleteAction, 
  useDismissAction, 
  useGenerateActions,
  NextBestAction 
} from '@/hooks/use-next-best-actions';
import { cn } from '@/lib/utils';

const actionTypeIcons: Record<string, React.ReactNode> = {
  call: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  meeting: <Calendar className="h-4 w-4" />,
  follow_up: <MessageSquare className="h-4 w-4" />,
  default: <Zap className="h-4 w-4" />,
};

const priorityColors: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  low: 'bg-muted text-muted-foreground border-border',
};

function getPriorityLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

interface ActionCardProps {
  action: NextBestAction;
  onComplete: (actionId: string, outcome: string) => void;
  onDismiss: (actionId: string) => void;
  isLoading?: boolean;
}

function ActionCard({ action, onComplete, onDismiss, isLoading }: ActionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const priorityLevel = getPriorityLevel(action.priority_score);
  const icon = actionTypeIcons[action.action_type] || actionTypeIcons.default;

  return (
    <Card className={cn(
      'transition-all duration-200 hover:shadow-md',
      priorityLevel === 'high' && 'border-l-4 border-l-destructive'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            'bg-primary/10 text-primary'
          )}>
            {icon}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm truncate">{action.action_title}</h4>
              <Badge 
                variant="outline" 
                className={cn('text-xs', priorityColors[priorityLevel])}
              >
                {priorityLevel}
              </Badge>
            </div>
            
            {action.account_name && (
              <p className="text-xs text-muted-foreground mb-1">
                {action.account_name}
                {action.lead_name && ` • ${action.lead_name}`}
              </p>
            )}
            
            <p className="text-sm text-muted-foreground line-clamp-2">
              {action.action_description}
            </p>
            
            {expanded && action.reasoning && (
              <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium text-xs text-muted-foreground mb-1">Why this action?</p>
                <p className="text-foreground">{action.reasoning}</p>
                
                {action.suggested_script && (
                  <div className="mt-2">
                    <p className="font-medium text-xs text-muted-foreground mb-1">Suggested approach</p>
                    <p className="text-foreground italic">{action.suggested_script}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="shrink-0"
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronRight className={cn(
              'h-4 w-4 transition-transform',
              expanded && 'rotate-90'
            )} />
          </Button>
        </div>
        
        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
          <Button 
            size="sm" 
            className="flex-1"
            onClick={() => onComplete(action.id, 'completed')}
            disabled={isLoading}
          >
            <Check className="h-4 w-4 mr-1" />
            Complete
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => onDismiss(action.id)}
            disabled={isLoading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function NextBestActionPanel() {
  const { data: actions, isLoading, error } = useNextBestActions({ status: 'pending' });
  const completeAction = useCompleteAction();
  const dismissAction = useDismissAction();
  const generateActions = useGenerateActions();

  const handleComplete = (actionId: string, outcome: string) => {
    completeAction.mutate({ actionId, outcome });
  };

  const handleDismiss = (actionId: string) => {
    dismissAction.mutate({ actionId });
  };

  const handleRefresh = () => {
    generateActions.mutate(undefined);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive text-sm">Failed to load actions: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Next Best Actions
          </CardTitle>
          <CardDescription>
            AI-recommended actions to move deals forward
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleRefresh}
          disabled={generateActions.isPending}
        >
          <RefreshCw className={cn(
            'h-4 w-4 mr-1',
            generateActions.isPending && 'animate-spin'
          )} />
          Refresh
        </Button>
      </CardHeader>
      
      <CardContent>
        {!actions || actions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">No pending actions</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={handleRefresh}
              disabled={generateActions.isPending}
            >
              Generate New Actions
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {actions.map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  onComplete={handleComplete}
                  onDismiss={handleDismiss}
                  isLoading={completeAction.isPending || dismissAction.isPending}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
