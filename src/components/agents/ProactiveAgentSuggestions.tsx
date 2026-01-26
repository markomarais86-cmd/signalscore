import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Lightbulb, 
  Play, 
  X, 
  CheckCircle, 
  AlertTriangle,
  Sparkles,
  Clock,
  TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Json } from "@/integrations/supabase/types";

interface Suggestion {
  id: string;
  agent_name: string;
  decision_type: string;
  entity_type: string;
  entity_id: string;
  ai_recommendation: Json;
  confidence: number;
  user_decision: string;
  created_at: string;
}

// Helper to safely extract recommendation fields
function getRecommendation(rec: Json): { workflow: string; parameters: Record<string, unknown>; reasoning: string } {
  if (rec && typeof rec === 'object' && !Array.isArray(rec)) {
    const obj = rec as Record<string, Json>;
    return {
      workflow: typeof obj.workflow === 'string' ? obj.workflow : '',
      parameters: (obj.parameters && typeof obj.parameters === 'object' && !Array.isArray(obj.parameters)) 
        ? obj.parameters as Record<string, unknown> 
        : {},
      reasoning: typeof obj.reasoning === 'string' ? obj.reasoning : '',
    };
  }
  return { workflow: '', parameters: {}, reasoning: '' };
}

export function ProactiveAgentSuggestions() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["proactive-suggestions", userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) return [];
      
      const { data, error } = await supabase
        .from("ai_decision_feedback")
        .select("*")
        .eq("org_id", userProfile.org_id)
        .eq("agent_name", "agent-planner")
        .eq("user_decision", "pending")
        .order("confidence", { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as Suggestion[];
    },
    enabled: !!userProfile?.org_id,
    refetchInterval: 60000, // Refresh every minute
  });

  const approveMutation = useMutation({
    mutationFn: async (suggestion: Suggestion) => {
      const rec = getRecommendation(suggestion.ai_recommendation);
      // Execute the suggested workflow
      const { error: execError } = await supabase.functions.invoke("ai-orchestrator", {
        body: {
          workflow: rec.workflow,
          parameters: rec.parameters,
          triggered_by: "user-approved",
        },
      });

      if (execError) throw execError;

      // Update the feedback record
      const { error } = await supabase
        .from("ai_decision_feedback")
        .update({
          user_decision: "approved",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", suggestion.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proactive-suggestions"] });
      toast.success("Workflow started successfully");
    },
    onError: (error) => {
      toast.error(`Failed to execute: ${error.message}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, feedback }: { id: string; feedback?: string }) => {
      const { error } = await supabase
        .from("ai_decision_feedback")
        .update({
          user_decision: "rejected",
          user_feedback: feedback,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proactive-suggestions"] });
      toast.success("Suggestion dismissed");
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            No proactive suggestions at this time. The AI is monitoring your data.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">AI Recommendations</CardTitle>
          </div>
          <Badge variant="secondary">{suggestions.length} pending</Badge>
        </div>
        <CardDescription>
          Proactive suggestions based on your data patterns
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onApprove={() => approveMutation.mutate(suggestion)}
            onReject={() => rejectMutation.mutate({ id: suggestion.id })}
            isApproving={approveMutation.isPending}
          />
        ))}
      </CardContent>
    </Card>
  );
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
}

function SuggestionCard({ suggestion, onApprove, onReject, isApproving }: SuggestionCardProps) {
  const confidence = Math.round(suggestion.confidence * 100);
  const { workflow, reasoning } = getRecommendation(suggestion.ai_recommendation);

  const getWorkflowIcon = (wf: string) => {
    switch (wf) {
      case "data_enrichment":
        return <TrendingUp className="h-4 w-4" />;
      case "optimize_icp":
        return <Sparkles className="h-4 w-4" />;
      case "generate_follow_ups":
        return <Clock className="h-4 w-4" />;
      default:
        return <Play className="h-4 w-4" />;
    }
  };

  const getConfidenceBadge = (conf: number) => {
    if (conf >= 90) return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">High Confidence</Badge>;
    if (conf >= 70) return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Medium Confidence</Badge>;
    return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">Low Confidence</Badge>;
  };

  return (
    <div className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            {getWorkflowIcon(workflow)}
            <span className="font-medium capitalize">
              {workflow.replace(/_/g, " ")}
            </span>
            {getConfidenceBadge(confidence)}
          </div>
          
          <p className="text-sm text-muted-foreground">{reasoning}</p>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(suggestion.created_at), { addSuffix: true })}
            </span>
            <span>Confidence: {confidence}%</span>
          </div>
          
          <Progress value={confidence} className="h-1.5" />
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onReject}
            disabled={isApproving}
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={onApprove}
            disabled={isApproving}
          >
            {isApproving ? (
              <Clock className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            <span className="ml-1">Approve</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
