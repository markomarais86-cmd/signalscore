import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

interface MatchResult {
  success: boolean;
  total_leads: number;
  matched_to_existing: number;
  new_accounts_created: number;
  accounts_scored: number;
  failed: number;
  total_linked: number;
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

  const handleMatch = async () => {
    if (!userProfile?.org_id) {
      toast.error("Organization not found");
      return;
    }

    setIsMatching(true);
    setProgress(10);
    setResult(null);

    try {
      console.log("🔗 Starting bulk lead matching for org:", userProfile.org_id);
      
      setProgress(30);

      const { data, error } = await supabase.functions.invoke('match-leads-to-accounts', {
        body: { org_id: userProfile.org_id }
      });

      setProgress(90);

      if (error) {
        console.error("❌ Matching error:", error);
        throw new Error(error.message || "Failed to match leads");
      }

      console.log("✅ Matching completed:", data);
      
      setProgress(100);
      setResult(data as MatchResult);

      if (data.success) {
        toast.success(`Successfully processed ${data.total_linked || 0} leads!`, {
          description: `${data.matched_to_existing || 0} matched, ${data.new_accounts_created || 0} new accounts created, ${data.accounts_scored || 0} scored`
        });
        
        if (onComplete) {
          setTimeout(onComplete, 2000);
        }
      } else {
        toast.error("Matching completed with errors", {
          description: data.error || "Some leads could not be processed"
        });
      }
    } catch (error: any) {
      console.error("❌ Error in bulk matching:", error);
      toast.error("Failed to match leads", {
        description: error.message
      });
      setResult({
        success: false,
        total_leads: unlinkedLeads,
        matched_to_existing: 0,
        new_accounts_created: 0,
        accounts_scored: 0,
        failed: unlinkedLeads,
        total_linked: 0,
        error: error.message
      });
    } finally {
      setIsMatching(false);
      setProgress(0);
    }
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
                <span>Processing {unlinkedLeads.toLocaleString()} leads...</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {result && (
            <Card className="mt-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  Matching Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Processed:</span>
                    <Badge variant="secondary">{result.total_leads.toLocaleString()}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Linked:</span>
                    <Badge variant="default">{result.total_linked.toLocaleString()}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Matched Existing:</span>
                    <Badge variant="outline">{result.matched_to_existing.toLocaleString()}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New Accounts:</span>
                    <Badge variant="outline">{result.new_accounts_created.toLocaleString()}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Auto-Scored:</span>
                    <Badge variant="outline">{result.accounts_scored.toLocaleString()}</Badge>
                  </div>
                  {result.failed > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Failed:</span>
                      <Badge variant="destructive">{result.failed.toLocaleString()}</Badge>
                    </div>
                  )}
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
      </AlertDescription>
    </Alert>
  );
}
