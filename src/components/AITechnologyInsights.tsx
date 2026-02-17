import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useDataOrgId } from "@/hooks/use-data-org";
import { Sparkles, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AIInsight {
  account_id: string;
  account_name: string;
  ai_insights: string;
  enriched_at: string;
}

interface AITechnologyInsightsProps {
  accountIds?: string[];
  onInsightsGenerated?: (insights: AIInsight[]) => void;
}

export function AITechnologyInsights({ accountIds, onInsightsGenerated }: AITechnologyInsightsProps) {
  const { toast } = useToast();
  const { dataOrgId } = useDataOrgId();
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<AIInsight[]>([]);

  const generateInsights = async () => {
    if (!dataOrgId) {
      toast({
        title: "Not authenticated",
        description: "Please log in to generate insights",
        variant: "destructive"
      });
      return;
    }

    // If no accountIds provided, get top accounts
    let targetAccountIds = accountIds;
    
    if (!targetAccountIds || targetAccountIds.length === 0) {
      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('external_id')
        .eq('org_id', dataOrgId)
        .limit(5);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to fetch accounts",
          variant: "destructive"
        });
        return;
      }

      targetAccountIds = accounts?.map(a => a.external_id) || [];
    }

    if (targetAccountIds.length === 0) {
      toast({
        title: "No accounts",
        description: "Please upload accounts first",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      console.log(`Generating AI insights for ${targetAccountIds.length} accounts`);

      const { data, error } = await supabase.functions.invoke('enrich-technology-insights', {
        body: {
          accountIds: targetAccountIds,
          orgId: dataOrgId
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate insights');
      }

      setInsights(data.results);
      onInsightsGenerated?.(data.results);

      toast({
        title: "Insights generated!",
        description: `AI analysis complete for ${data.enriched} accounts`
      });

    } catch (error: any) {
      console.error('Error generating insights:', error);
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate AI insights",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Technology Insights
        </CardTitle>
        <CardDescription>
          Get AI-powered insights about technology stack, digital maturity, and buying signals
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {insights.length > 0 
                ? `${insights.length} accounts analyzed`
                : 'Click to analyze your top accounts'}
            </p>
          </div>
          <Button
            onClick={generateInsights}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Insights
              </>
            )}
          </Button>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && insights.length > 0 && (
          <div className="space-y-4">
            {insights.map((insight, index) => (
              <Card key={index} className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    {insight.account_name}
                    <Badge variant="secondary" className="text-xs">
                      AI Generated
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {insight.ai_insights}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Generated: {new Date(insight.enriched_at).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && insights.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No insights generated yet</p>
            <p className="text-xs mt-1">Click the button above to analyze your accounts</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
