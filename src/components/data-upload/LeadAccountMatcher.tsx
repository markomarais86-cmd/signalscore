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
  processed: number;
  matched: number;
  created: number;
  linked: number;
  batches: number;
  duration_ms: number;
  has_more: boolean;
  partial?: boolean;
  error?: string;
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
        const totalLinked = (data.matched || 0) + (data.linked || 0);
        toast({
          title: "Matching Complete",
          description: `Processed ${data.processed} leads: ${data.matched} matched to existing, ${data.created} new accounts created, ${data.linked} linked${data.batches > 1 ? ` across ${data.batches} batches` : ''} in ${((data.duration_ms || 0) / 1000).toFixed(1)}s`,
        });
        
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
                  {result.success 
                    ? (result.partial ? "Matching Partially Complete" : "Matching Completed Successfully")
                    : "Matching Failed"}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Processed:</span>
                    <Badge variant="secondary">{result.processed}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Matched:</span>
                    <Badge variant="default">{result.matched}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Accounts Created:</span>
                    <Badge variant="default">{result.created}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Newly Linked:</span>
                    <Badge variant="outline">{result.linked}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Batches:</span>
                    <Badge variant="secondary">{result.batches}</Badge>
                  </div>
                  {result.duration_ms && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Duration:</span>
                      <Badge variant="secondary">{(result.duration_ms / 1000).toFixed(1)}s</Badge>
                    </div>
                  )}
                </div>
                {result.has_more && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    More leads remain to be processed. Run matching again to continue.
                  </p>
                )}
              </AlertDescription>
            </Alert>

            {result.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{result.error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
