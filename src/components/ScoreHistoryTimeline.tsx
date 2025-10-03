import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";

interface ScoreChange {
  id: string;
  account_external_id: string;
  old_score: {
    overall: number;
    fit: number;
    intent: number;
    reachability: number;
  } | null;
  new_score: {
    overall: number;
    fit: number;
    intent: number;
    reachability: number;
  };
  computed_at: string;
  change_reason: string | null;
}

interface ScoreHistoryTimelineProps {
  accountExternalId: string;
}

export function ScoreHistoryTimeline({ accountExternalId }: ScoreHistoryTimelineProps) {
  const [history, setHistory] = useState<ScoreChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (userProfile?.org_id) {
      loadHistory();
    }
  }, [userProfile?.org_id, accountExternalId]);

  const loadHistory = async () => {
    if (!userProfile?.org_id) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('score_history')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .eq('account_external_id', accountExternalId)
        .order('computed_at', { ascending: false })
        .limit(20);

      if (fetchError) throw fetchError;

      setHistory((data || []).map(item => ({
        id: item.id,
        account_external_id: item.account_external_id,
        old_score: item.old_score as any,
        new_score: item.new_score as any,
        computed_at: item.computed_at,
        change_reason: item.change_reason
      })));
    } catch (err) {
      console.error('Error loading score history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load score history');
      toast({
        title: "Error",
        description: "Failed to load score history",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoreTrend = (oldScore: number | null, newScore: number) => {
    if (!oldScore) return { icon: Minus, color: 'text-muted-foreground', diff: 0 };
    const diff = newScore - oldScore;
    if (diff > 0) return { icon: TrendingUp, color: 'text-success', diff };
    if (diff < 0) return { icon: TrendingDown, color: 'text-destructive', diff };
    return { icon: Minus, color: 'text-muted-foreground', diff: 0 };
  };

  if (loading) {
    return <LoadingState message="Loading score history..." />;
  }

  if (error) {
    return <ErrorState title="Failed to load" description={error} onRetry={loadHistory} />;
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No score history available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Score History</CardTitle>
        <CardDescription>Track how this account's ICP score has changed over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((change, index) => {
            const overallTrend = getScoreTrend(change.old_score?.overall || null, change.new_score.overall);
            const fitTrend = getScoreTrend(change.old_score?.fit || null, change.new_score.fit);
            const TrendIcon = overallTrend.icon;

            return (
              <div key={change.id} className="flex gap-4 pb-4 border-b last:border-b-0">
                <div className="flex flex-col items-center">
                  <div className={`rounded-full p-2 ${index === 0 ? 'bg-primary' : 'bg-muted'}`}>
                    <Clock className={`h-4 w-4 ${index === 0 ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                  </div>
                  {index < history.length - 1 && (
                    <div className="w-px h-full bg-border mt-2" />
                  )}
                </div>

                <div className="flex-1 pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendIcon className={`h-4 w-4 ${overallTrend.color}`} />
                      <span className="font-medium">
                        {change.old_score ? 'Score Updated' : 'Initial Score'}
                      </span>
                      {overallTrend.diff !== 0 && (
                        <Badge variant="outline" className={overallTrend.color}>
                          {overallTrend.diff > 0 ? '+' : ''}{overallTrend.diff}
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(change.computed_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Overall</div>
                      <div className="font-medium flex items-center gap-1">
                        {change.new_score.overall}
                        {change.old_score && (
                          <span className="text-xs text-muted-foreground">
                            (was {change.old_score.overall})
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Fit</div>
                      <div className="font-medium flex items-center gap-1">
                        {change.new_score.fit}
                        {change.old_score && fitTrend.diff !== 0 && (
                          <span className={`text-xs ${fitTrend.color}`}>
                            {fitTrend.diff > 0 ? '+' : ''}{fitTrend.diff}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Intent</div>
                      <div className="font-medium">{change.new_score.intent}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Reach</div>
                      <div className="font-medium">{change.new_score.reachability}</div>
                    </div>
                  </div>

                  {change.change_reason && (
                    <div className="mt-2 text-sm text-muted-foreground italic">
                      Reason: {change.change_reason}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
