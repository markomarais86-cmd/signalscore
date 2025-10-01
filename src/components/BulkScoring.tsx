import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Zap, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface BulkScoringProps {
  onComplete?: () => void;
}

export function BulkScoring({ onComplete }: BulkScoringProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [isScoring, setIsScoring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<{
    total: number;
    completed: number;
    failed: number;
    avgScore: number;
  } | null>(null);

  const runBulkScoring = async () => {
    if (!userProfile?.org_id) {
      toast({
        title: "Error",
        description: "User profile not loaded",
        variant: "destructive"
      });
      return;
    }

    setIsScoring(true);
    setProgress(0);
    setStats(null);

    try {
      // Check for active ICP profiles
      const { data: icpProfiles, error: icpError } = await supabase
        .from('icp_profiles')
        .select('id, name, status')
        .eq('org_id', userProfile.org_id)
        .eq('status', 'active');

      if (icpError) throw icpError;

      if (!icpProfiles || icpProfiles.length === 0) {
        toast({
          title: "No ICP Profiles",
          description: "Please create at least one active ICP profile before scoring accounts.",
          variant: "destructive"
        });
        setIsScoring(false);
        return;
      }

      // Get all accounts count
      const { count: accountsCount, error: accountsError } = await supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id);

      if (accountsError) throw accountsError;

      if (!accountsCount || accountsCount === 0) {
        toast({
          title: "No Accounts",
          description: "Please upload accounts data before running scoring.",
          variant: "destructive"
        });
        setIsScoring(false);
        return;
      }

      const totalOperations = accountsCount * icpProfiles.length;
      console.log(`Starting bulk scoring: ${accountsCount} accounts × ${icpProfiles.length} ICPs = ${totalOperations} scoring operations`);

      // Set initial progress
      setProgress(5);

      // Call the bulk scoring edge function with batch size
      const { data, error } = await supabase.functions.invoke('bulk-score-accounts', {
        body: {
          org_id: userProfile.org_id,
          batch_size: 250 // Process in batches of 250 accounts
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      console.log('Bulk scoring response:', data);

      // Set progress to 100% on completion
      setProgress(100);

      // Get actual scores to calculate real average
      const { data: scoresData } = await supabase
        .from('scores')
        .select('overall')
        .eq('org_id', userProfile.org_id);

      const avgScore = scoresData && scoresData.length > 0
        ? Math.round(scoresData.reduce((sum, s) => sum + (s.overall || 0), 0) / scoresData.length)
        : 0;

      setStats({
        total: accountsCount,
        completed: data.scores_calculated,
        failed: data.errors || 0,
        avgScore
      });

      toast({
        title: "Scoring Complete!",
        description: `Successfully scored ${data.scores_calculated} out of ${totalOperations} operations. Success rate: ${data.success_rate}%`
      });

      if (data.sample_errors && data.sample_errors.length > 0) {
        console.warn('Sample errors from scoring:', data.sample_errors);
      }

      if (onComplete) {
        onComplete();
      }

    } catch (error: any) {
      console.error('Bulk scoring error:', error);
      toast({
        title: "Scoring Failed",
        description: error.message || "An error occurred during bulk scoring. Check console for details.",
        variant: "destructive"
      });
    } finally {
      setIsScoring(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Bulk Scoring Engine
        </CardTitle>
        <CardDescription>
          Score all accounts against your active ICP profiles to identify best-fit opportunities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isScoring && !stats && (
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              This will calculate ICP match scores for all your accounts. The process evaluates:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Industry alignment</li>
                <li>Company size fit</li>
                <li>Revenue range match</li>
                <li>Geographic targeting</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {isScoring && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground text-center">
              Scoring accounts... {progress}%
            </p>
          </div>
        )}

        {stats && (
          <div className="space-y-4">
            <Alert className="bg-primary/10 border-primary">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription>
                <strong>Scoring Complete!</strong> Successfully scored {stats.completed} accounts.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total Accounts</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-[hsl(var(--signal-high))]">{stats.completed}</div>
                <div className="text-sm text-muted-foreground">Scored</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold">{stats.avgScore}</div>
                <div className="text-sm text-muted-foreground">Avg Score</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-[hsl(var(--signal-low))]">{stats.failed}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>

            {stats.avgScore >= 75 && (
              <Badge className="w-full justify-center bg-[hsl(var(--signal-high))]">
                Excellent ICP Fit - High quality accounts!
              </Badge>
            )}
            {stats.avgScore >= 50 && stats.avgScore < 75 && (
              <Badge className="w-full justify-center bg-[hsl(var(--signal-medium))]">
                Good ICP Fit - Solid opportunities
              </Badge>
            )}
            {stats.avgScore < 50 && (
              <Badge variant="secondary" className="w-full justify-center">
                Consider refining your ICP criteria
              </Badge>
            )}

            {stats.failed > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {stats.failed} account(s) could not be scored. Check the console for details.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={runBulkScoring}
            disabled={isScoring}
            className="flex-1"
          >
            {isScoring ? (
              <>
                <Zap className="h-4 w-4 mr-2 animate-pulse" />
                Scoring...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                {stats ? 'Re-run Scoring' : 'Start Scoring'}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
