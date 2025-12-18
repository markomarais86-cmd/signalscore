import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  GraduationCap, 
  TrendingUp, 
  TrendingDown,
  Award,
  Target,
  RefreshCw,
  CheckCircle2,
  Clock,
  ChevronRight,
  Star
} from 'lucide-react';
import { 
  useRepPerformance, 
  useCoachingRecommendations, 
  useUpdateRecommendationStatus,
  useGenerateCoachingInsights,
  RepPerformance,
  CoachingRecommendation 
} from '@/hooks/use-coaching';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

interface PerformanceCardProps {
  performance: RepPerformance;
}

function PerformanceCard({ performance }: PerformanceCardProps) {
  const winRateColor = performance.win_rate >= 30 ? 'text-green-500' : 
                       performance.win_rate >= 20 ? 'text-amber-500' : 'text-destructive';
  
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-medium">{performance.user_name || 'Unknown Rep'}</h4>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(performance.period_end), { addSuffix: true })}
            </p>
          </div>
          <div className={cn('text-2xl font-bold', winRateColor)}>
            {performance.win_rate.toFixed(0)}%
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <p className="text-lg font-semibold">{performance.deals_won}</p>
            <p className="text-xs text-muted-foreground">Won</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">{performance.deals_lost}</p>
            <p className="text-xs text-muted-foreground">Lost</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">{formatCurrency(performance.total_revenue)}</p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Activity Score</span>
              <span className="font-medium">
                {performance.calls_made + performance.emails_sent + performance.meetings_held} activities
              </span>
            </div>
            <Progress 
              value={Math.min(100, ((performance.calls_made + performance.emails_sent) / 50) * 100)} 
              className="h-1.5"
            />
          </div>
          
          {performance.strengths.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Strengths</p>
              <div className="flex flex-wrap gap-1">
                {performance.strengths.slice(0, 3).map((strength, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    <Star className="h-3 w-3 mr-1" />
                    {strength}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {performance.areas_for_improvement.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Areas to Improve</p>
              <div className="flex flex-wrap gap-1">
                {performance.areas_for_improvement.slice(0, 3).map((area, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    <Target className="h-3 w-3 mr-1" />
                    {area}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface RecommendationCardProps {
  recommendation: CoachingRecommendation;
  onStatusChange: (id: string, status: string) => void;
  isLoading?: boolean;
}

function RecommendationCard({ recommendation, onStatusChange, isLoading }: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const statusColors: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    in_progress: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    completed: 'bg-green-500/10 text-green-600 border-green-500/20',
    dismissed: 'bg-muted text-muted-foreground',
  };
  
  const priorityStars = Math.min(5, Math.max(1, Math.ceil(recommendation.priority / 20)));
  
  return (
    <Card className={cn(
      'transition-all duration-200',
      recommendation.status === 'completed' && 'opacity-60'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GraduationCap className="h-5 w-5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm">{recommendation.topic}</h4>
              <Badge 
                variant="outline" 
                className={cn('text-xs capitalize', statusColors[recommendation.status])}
              >
                {recommendation.status.replace('_', ' ')}
              </Badge>
            </div>
            
            {recommendation.category && (
              <Badge variant="secondary" className="text-xs mb-2">
                {recommendation.category}
              </Badge>
            )}
            
            <p className="text-sm text-muted-foreground line-clamp-2">
              {recommendation.recommendation}
            </p>
            
            {expanded && (
              <div className="mt-3 space-y-2">
                {recommendation.best_practice_source && (
                  <p className="text-xs text-muted-foreground">
                    <strong>Source:</strong> {recommendation.best_practice_source}
                  </p>
                )}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Priority:</span>
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star 
                        key={i} 
                        className={cn(
                          'h-3 w-3',
                          i < priorityStars ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/30'
                        )} 
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-2 mt-3">
              {recommendation.status === 'pending' && (
                <>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onStatusChange(recommendation.id, 'in_progress')}
                    disabled={isLoading}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Start
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => onStatusChange(recommendation.id, 'completed')}
                    disabled={isLoading}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Complete
                  </Button>
                </>
              )}
              {recommendation.status === 'in_progress' && (
                <Button 
                  size="sm"
                  onClick={() => onStatusChange(recommendation.id, 'completed')}
                  disabled={isLoading}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Mark Complete
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setExpanded(!expanded)}
              >
                <ChevronRight className={cn(
                  'h-4 w-4 transition-transform',
                  expanded && 'rotate-90'
                )} />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CoachingPanel() {
  const { data: performances, isLoading: loadingPerf } = useRepPerformance();
  const { data: recommendations, isLoading: loadingRecs } = useCoachingRecommendations({ status: 'pending' });
  const updateStatus = useUpdateRecommendationStatus();
  const generateInsights = useGenerateCoachingInsights();

  const isLoading = loadingPerf || loadingRecs;

  const handleStatusChange = (id: string, status: string) => {
    updateStatus.mutate({ recommendationId: id, status });
  };

  const handleRefresh = () => {
    generateInsights.mutate(undefined);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Coaching Insights
          </CardTitle>
          <CardDescription>
            AI-powered performance analysis and recommendations
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleRefresh}
          disabled={generateInsights.isPending}
        >
          <RefreshCw className={cn(
            'h-4 w-4 mr-1',
            generateInsights.isPending && 'animate-spin'
          )} />
          Refresh
        </Button>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="recommendations" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="recommendations">
              <Target className="h-4 w-4 mr-1" />
              Recommendations
              {recommendations && recommendations.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {recommendations.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="performance">
              <Award className="h-4 w-4 mr-1" />
              Performance
            </TabsTrigger>
          </TabsList>
          
          <ScrollArea className="h-[400px] mt-4">
            <TabsContent value="recommendations" className="mt-0 space-y-3">
              {!recommendations || recommendations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500/50 mb-3" />
                  <p className="text-muted-foreground text-sm">All caught up!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No pending coaching recommendations
                  </p>
                </div>
              ) : (
                recommendations.map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    recommendation={rec}
                    onStatusChange={handleStatusChange}
                    isLoading={updateStatus.isPending}
                  />
                ))
              )}
            </TabsContent>
            
            <TabsContent value="performance" className="mt-0 space-y-3">
              {!performances || performances.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Award className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground text-sm">No performance data</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={handleRefresh}
                    disabled={generateInsights.isPending}
                  >
                    Analyze Performance
                  </Button>
                </div>
              ) : (
                performances.map((perf) => (
                  <PerformanceCard key={perf.id} performance={perf} />
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}
