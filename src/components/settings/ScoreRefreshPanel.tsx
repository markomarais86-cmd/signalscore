import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, TrendingUp, Activity, AlertCircle, CheckCircle } from "lucide-react";

interface ScoreStats {
  total: number;
  dynamic_v3: number;
  old_versions: number;
  avg_overall: number;
  avg_intent: number;
  avg_reachability: number;
}

export function ScoreRefreshPanel() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [beforeStats, setBeforeStats] = useState<ScoreStats | null>(null);
  const [afterStats, setAfterStats] = useState<ScoreStats | null>(null);
  const { toast } = useToast();

  const fetchScoreStats = async (): Promise<ScoreStats | null> => {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('org_id')
        .single();

      if (!profile?.org_id) return null;

      // Get total scores
      const { count: total } = await supabase
        .from('scores')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', profile.org_id);

      // Get dynamic_v3 count
      const { count: dynamic_v3 } = await supabase
        .from('scores')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', profile.org_id)
        .eq('scoring_version', 'dynamic_v3.0');

      // Get average scores
      const { data: avgData } = await supabase
        .from('scores')
        .select('overall, intent, reachability')
        .eq('org_id', profile.org_id);

      const avg_overall = avgData?.reduce((sum, s) => sum + (s.overall || 0), 0) / (avgData?.length || 1);
      const avg_intent = avgData?.reduce((sum, s) => sum + (s.intent || 0), 0) / (avgData?.length || 1);
      const avg_reachability = avgData?.reduce((sum, s) => sum + (s.reachability || 0), 0) / (avgData?.length || 1);

      return {
        total: total || 0,
        dynamic_v3: dynamic_v3 || 0,
        old_versions: (total || 0) - (dynamic_v3 || 0),
        avg_overall: Math.round(avg_overall || 0),
        avg_intent: Math.round(avg_intent || 0),
        avg_reachability: Math.round(avg_reachability || 0),
      };
    } catch (error) {
      console.error('Error fetching score stats:', error);
      return null;
    }
  };

  const handleRefreshScores = async () => {
    setIsRefreshing(true);
    setProgress(0);
    setAfterStats(null);

    try {
      // Get before stats
      const before = await fetchScoreStats();
      setBeforeStats(before);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('org_id')
        .single();

      if (!profile?.org_id) {
        throw new Error('Organization not found');
      }

      // Start refresh
      toast({
        title: "Score refresh started",
        description: "Recalculating all scores with dynamic Intent and Reachability...",
      });

      // Simulate progress (actual progress would need real-time updates from edge function)
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 2000);

      const { data, error } = await supabase.functions.invoke('refresh-all-scores', {
        body: { org_id: profile.org_id, batch_size: 500 }
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;

      // Get after stats
      const after = await fetchScoreStats();
      setAfterStats(after);

      toast({
        title: "Score refresh complete",
        description: `Updated ${data.updated} scores to dynamic_v3.0`,
      });

    } catch (error) {
      console.error('Error refreshing scores:', error);
      toast({
        title: "Refresh failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, change }: any) => (
    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
        {change !== undefined && (
          <p className="text-xs text-muted-foreground mt-1">
            {change > 0 ? '+' : ''}{change}
          </p>
        )}
      </div>
      <Icon className="h-8 w-8 text-muted-foreground" />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Score Refresh Manager
            </CardTitle>
            <CardDescription>
              Recalculate all scores with dynamic Intent and Reachability formulas
            </CardDescription>
          </div>
          <Button
            onClick={handleRefreshScores}
            disabled={isRefreshing}
            size="lg"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh All Scores
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {beforeStats && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>{beforeStats.old_versions.toLocaleString()}</strong> scores need refreshing to use dynamic formulas
            </AlertDescription>
          </Alert>
        )}

        {isRefreshing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Refreshing scores...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {beforeStats && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Current State</h3>
              {afterStats && <Badge variant="outline" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Refresh Complete
              </Badge>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                title="Total Scores"
                value={beforeStats.total.toLocaleString()}
                icon={Activity}
              />
              <StatCard
                title="Dynamic v3.0"
                value={afterStats?.dynamic_v3.toLocaleString() || beforeStats.dynamic_v3.toLocaleString()}
                icon={TrendingUp}
                change={afterStats ? afterStats.dynamic_v3 - beforeStats.dynamic_v3 : undefined}
              />
              <StatCard
                title="Old Versions"
                value={afterStats?.old_versions.toLocaleString() || beforeStats.old_versions.toLocaleString()}
                icon={AlertCircle}
                change={afterStats ? afterStats.old_versions - beforeStats.old_versions : undefined}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Avg Overall Score</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{afterStats?.avg_overall || beforeStats.avg_overall}</p>
                  {afterStats && afterStats.avg_overall !== beforeStats.avg_overall && (
                    <span className="text-sm text-muted-foreground">
                      ({afterStats.avg_overall > beforeStats.avg_overall ? '+' : ''}
                      {afterStats.avg_overall - beforeStats.avg_overall})
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Avg Intent Score</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{afterStats?.avg_intent || beforeStats.avg_intent}</p>
                  {afterStats && afterStats.avg_intent !== beforeStats.avg_intent && (
                    <span className="text-sm text-muted-foreground">
                      ({afterStats.avg_intent > beforeStats.avg_intent ? '+' : ''}
                      {afterStats.avg_intent - beforeStats.avg_intent})
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Avg Reachability Score</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{afterStats?.avg_reachability || beforeStats.avg_reachability}</p>
                  {afterStats && afterStats.avg_reachability !== beforeStats.avg_reachability && (
                    <span className="text-sm text-muted-foreground">
                      ({afterStats.avg_reachability > beforeStats.avg_reachability ? '+' : ''}
                      {afterStats.avg_reachability - beforeStats.avg_reachability})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!beforeStats && !isRefreshing && (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click "Refresh All Scores" to get started</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
