import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Link2, Loader2, CheckCircle2, AlertCircle, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MatchingResult {
  success: boolean;
  total_leads: number;
  matched_to_existing: number;
  new_accounts_created: number;
  accounts_scored?: number;
  failed: number;
  errors?: Array<{ lead_id: string; reason: string }>;
}

interface LeadAccountMatcherProps {
  onComplete?: () => void;
}

export function LeadAccountMatcher({ onComplete }: LeadAccountMatcherProps) {
  const [isMatching, setIsMatching] = useState(false);
  const [result, setResult] = useState<MatchingResult | null>(null);
  const { toast } = useToast();

  const handleMatch = async () => {
    setIsMatching(true);
    setResult(null);

    try {
      // Get current user's org_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('User profile not found');

      const { data, error } = await supabase.functions.invoke('match-leads-to-accounts', {
        body: { org_id: profile.org_id }
      });

      if (error) throw error;

      setResult(data as MatchingResult);

      if (data.success) {
        toast({
          title: "Matching Complete",
          description: `Linked ${data.matched_to_existing + data.new_accounts_created} leads to accounts${data.accounts_scored ? ` and scored ${data.accounts_scored} accounts` : ''}`,
        });
        
        // Call onComplete callback after a brief delay to show results
        setTimeout(() => {
          onComplete?.();
        }, 2000);
      }
    } catch (error) {
      console.error('Error matching leads:', error);
      toast({
        title: "Matching Failed",
        description: error instanceof Error ? error.message : "Failed to match leads to accounts",
        variant: "destructive",
      });
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Link Leads to Accounts
        </CardTitle>
        <CardDescription>
          Automatically match leads to existing accounts or create new accounts based on domain matching
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <TrendingUp className="h-4 w-4" />
          <AlertDescription>
            This process will:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Match leads to existing accounts by domain</li>
              <li>Create new accounts for unmatched leads</li>
              <li>Enable scoring for all linked leads</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Button 
          onClick={handleMatch} 
          disabled={isMatching}
          className="w-full"
        >
          {isMatching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Matching Leads...
            </>
          ) : (
            <>
              <Link2 className="mr-2 h-4 w-4" />
              Start Matching
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-4 mt-4">
            <Alert className={result.success ? "border-green-500" : "border-red-500"}>
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              <AlertDescription>
                <div className="font-semibold mb-2">
                  {result.success ? "Matching Completed Successfully" : "Matching Failed"}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Total Leads:</span>
                    <Badge variant="secondary">{result.total_leads}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Matched:</span>
                    <Badge variant="default">{result.matched_to_existing}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Created:</span>
                    <Badge variant="default">{result.new_accounts_created}</Badge>
                  </div>
                  {result.accounts_scored !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Scored:</span>
                      <Badge variant="outline">{result.accounts_scored}</Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Failed:</span>
                    <Badge variant="destructive">{result.failed}</Badge>
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            {result.errors && result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Sample Errors:</div>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {result.errors.slice(0, 5).map((error, idx) => (
                      <li key={idx}>
                        Lead {error.lead_id}: {error.reason}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
