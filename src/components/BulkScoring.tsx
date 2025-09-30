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

      // Get all accounts
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('external_id, name')
        .eq('org_id', userProfile.org_id);

      if (accountsError) throw accountsError;

      if (!accounts || accounts.length === 0) {
        toast({
          title: "No Accounts",
          description: "Please upload accounts data before running scoring.",
          variant: "destructive"
        });
        setIsScoring(false);
        return;
      }

      console.log(`Starting bulk scoring for ${accounts.length} accounts against ${icpProfiles.length} ICP profiles`);

      let completed = 0;
      let failed = 0;
      let totalScore = 0;

      // Score each account
      for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        
        try {
          const { data, error } = await supabase.functions.invoke('score-account', {
            body: {
              org_id: userProfile.org_id,
              account_external_id: account.external_id
            }
          });

          if (error) {
            console.error(`Failed to score ${account.name}:`, error);
            failed++;
          } else {
            completed++;
            totalScore += data.overall || 0;
            console.log(`Scored ${account.name}: ${data.overall}`);
          }
        } catch (error) {
          console.error(`Error scoring ${account.name}:`, error);
          failed++;
        }

        // Update progress
        const progressPercent = Math.round(((i + 1) / accounts.length) * 100);
        setProgress(progressPercent);

        // Small delay to avoid rate limiting
        if (i < accounts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const avgScore = completed > 0 ? Math.round(totalScore / completed) : 0;

      setStats({
        total: accounts.length,
        completed,
        failed,
        avgScore
      });

      toast({
        title: "Scoring Complete!",
        description: `Scored ${completed} of ${accounts.length} accounts with average score of ${avgScore}`
      });

      if (onComplete) {
        onComplete();
      }

    } catch (error: any) {
      console.error('Bulk scoring error:', error);
      toast({
        title: "Scoring Failed",
        description: error.message || "An error occurred during bulk scoring",
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
