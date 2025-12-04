import { useState, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

interface MatchResult {
  success: boolean;
  total_processed: number;
  total_matched: number;
  total_created: number;
  total_scored: number;
  error?: string;
}

interface BulkLeadMatcherProps {
  unlinkedLeads: number;
  onComplete?: () => void;
}

export function BulkLeadMatcher({ unlinkedLeads, onComplete }: BulkLeadMatcherProps) {
  const { userProfile } = useAuth();
  const [isMatching, setIsMatching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const abortRef = useRef(false);

  const handleMatch = async () => {
    if (!userProfile?.org_id) {
      toast.error("Organization not found");
      return;
    }

    setIsMatching(true);
    setProgress(0);
    setResult(null);
    abortRef.current = false;

    let totalProcessed = 0;
    let totalMatched = 0;
    let totalCreated = 0;
    let totalScored = 0;
    let hasMore = true;
    let batchCount = 0;
    const maxBatches = 200; // Safety limit

    try {
      console.log("🔗 Starting chunked lead matching for org:", userProfile.org_id);

      while (hasMore && !abortRef.current && batchCount < maxBatches) {
        batchCount++;
        setStatusMessage(`Processing batch ${batchCount}...`);

        const { data, error } = await supabase.functions.invoke('match-leads-to-accounts', {
          body: { 
            org_id: userProfile.org_id,
            batch_size: 100 
          }
        });

        if (error) {
          console.error("❌ Batch error:", error);
          throw new Error(error.message || "Failed to match leads");
        }

        if (!data.success) {
          throw new Error(data.error || "Matching failed");
        }

        totalProcessed += data.processed || 0;
        totalMatched += data.matched || 0;
        totalCreated += data.created || 0;
        totalScored += data.scored || 0;
        hasMore = data.has_more;

        // Update progress based on remaining leads
        const remaining = data.remaining || 0;
        const total = totalProcessed + remaining;
        const progressPercent = total > 0 ? Math.round((totalProcessed / total) * 100) : 100;
        setProgress(progressPercent);

        setStatusMessage(
          `Processed ${totalProcessed.toLocaleString()} leads • ${totalMatched.toLocaleString()} matched • ${totalCreated.toLocaleString()} new accounts`
        );

        console.log(`✅ Batch ${batchCount}: processed=${data.processed}, remaining=${remaining}, hasMore=${hasMore}`);

        // Small delay between batches to prevent overwhelming the server
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      setProgress(100);
      setResult({
        success: true,
        total_processed: totalProcessed,
        total_matched: totalMatched,
        total_created: totalCreated,
        total_scored: totalScored
      });

      toast.success(`Successfully processed ${totalProcessed.toLocaleString()} leads!`, {
        description: `${totalMatched.toLocaleString()} matched, ${totalCreated.toLocaleString()} new accounts, ${totalScored.toLocaleString()} scored`
      });

      if (onComplete) {
        setTimeout(onComplete, 1500);
      }

    } catch (error: any) {
      console.error("❌ Error in bulk matching:", error);
      toast.error("Failed to match leads", {
        description: error.message
      });
      setResult({
        success: false,
        total_processed: totalProcessed,
        total_matched: totalMatched,
        total_created: totalCreated,
        total_scored: totalScored,
        error: error.message
      });
    } finally {
      setIsMatching(false);
      setStatusMessage("");
    }
  };

  const handleCancel = () => {
    abortRef.current = true;
    setStatusMessage("Cancelling...");
  };

  if (unlinkedLeads === 0) {
    return null;
  }

  return (
    <Alert className="border-warning bg-warning/5">
      <AlertCircle className="h-5 w-5 text-warning" />
      <AlertDescription className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="font-semibold mb-2">
            {unlinkedLeads.toLocaleString()} Unlinked Leads Detected
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            These leads haven't been matched to accounts yet. Run the matching process to link them and enable scoring.
          </p>
          
          {isMatching && (
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{statusMessage || `Processing leads...`}</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Processing in batches of 100 to avoid timeouts
              </p>
            </div>
          )}

          {result && (
            <Card className="mt-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  Matching Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Processed:</span>
                    <Badge variant="secondary">{result.total_processed.toLocaleString()}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Matched Existing:</span>
                    <Badge variant="outline">{result.total_matched.toLocaleString()}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New Accounts:</span>
                    <Badge variant="outline">{result.total_created.toLocaleString()}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Auto-Scored:</span>
                    <Badge variant="outline">{result.total_scored.toLocaleString()}</Badge>
                  </div>
                </div>
                {result.error && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertDescription className="text-xs">
                      {result.error}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        
        <div className="flex flex-col gap-2">
          <Button
            onClick={handleMatch}
            disabled={isMatching}
            variant="default"
            size="sm"
          >
            {isMatching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Fix & Match Now
              </>
            )}
          </Button>
          {isMatching && (
            <Button
              onClick={handleCancel}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
