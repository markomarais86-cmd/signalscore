import { useState, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  XCircle,
  Edit,
  MessageSquare,
  Bot,
  Sparkles,
  TrendingUp,
  Users,
  Clock,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Json } from "@/integrations/supabase/types";

interface FeedbackItem {
  id: string;
  agent_name: string;
  decision_type: string;
  entity_type: string;
  entity_id: string;
  ai_recommendation: Json;
  confidence: number;
  user_decision: string;
  user_feedback: string | null;
  created_at: string;
}

// Helper to safely extract recommendation fields
function getRecommendationText(rec: Json): string {
  if (rec && typeof rec === 'object' && !Array.isArray(rec)) {
    const obj = rec as Record<string, Json>;
    if (typeof obj.reasoning === 'string') return obj.reasoning;
    if (typeof obj.summary === 'string') return obj.summary;
  }
  return typeof rec === 'string' ? rec : JSON.stringify(rec).slice(0, 150);
}

type DecisionType = "approved" | "rejected" | "modified";

export function UniversalFeedbackQueue() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const { data: feedbackItems, isLoading } = useQuery({
    queryKey: ["universal-feedback", userProfile?.org_id, activeTab],
    queryFn: async () => {
      if (!userProfile?.org_id) return [];

      let query = supabase
        .from("ai_decision_feedback")
        .select("*")
        .eq("org_id", userProfile.org_id)
        .eq("user_decision", "pending")
        .order("confidence", { ascending: false })
        .limit(50);

      if (activeTab !== "all") {
        query = query.eq("agent_name", activeTab);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FeedbackItem[];
    },
    enabled: !!userProfile?.org_id,
  });

  const updateFeedback = useMutation({
    mutationFn: async ({
      id,
      decision,
      feedback,
    }: {
      id: string;
      decision: DecisionType;
      feedback?: string;
    }) => {
      const { error } = await supabase
        .from("ai_decision_feedback")
        .update({
          user_decision: decision,
          user_feedback: feedback || null,
          reviewed_by: userProfile?.user_id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["universal-feedback"] });
      setSelectedItem(null);
      setFeedbackText("");
      toast.success("Feedback submitted");
    },
    onError: (error) => {
      toast.error(`Failed to submit feedback: ${error.message}`);
    },
  });

  const handleDecision = (item: FeedbackItem, decision: DecisionType) => {
    if (decision === "rejected" || decision === "modified") {
      setSelectedItem(item);
    } else {
      updateFeedback.mutate({ id: item.id, decision });
    }
  };

  const submitWithFeedback = () => {
    if (!selectedItem) return;
    updateFeedback.mutate({
      id: selectedItem.id,
      decision: "rejected",
      feedback: feedbackText,
    });
  };

  const getAgentIcon = (agentName: string) => {
    switch (agentName) {
      case "agent-planner":
        return <Sparkles className="h-4 w-4" />;
      case "agent-data-enrichment":
        return <TrendingUp className="h-4 w-4" />;
      case "agent-lead-qualification":
        return <Users className="h-4 w-4" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  const getDecisionTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      proactive_workflow: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      enrichment: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      qualification: "bg-green-500/10 text-green-600 border-green-500/20",
      follow_up: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    };
    return (
      <Badge className={colors[type] || "bg-muted text-muted-foreground"}>
        {type.replace(/_/g, " ")}
      </Badge>
    );
  };

  const uniqueAgents = [...new Set(feedbackItems?.map((i) => i.agent_name) || [])];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                AI Decision Queue
              </CardTitle>
              <CardDescription>
                Review and provide feedback on AI recommendations
              </CardDescription>
            </div>
            <Badge variant="outline">{feedbackItems?.length || 0} pending</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              {uniqueAgents.map((agent) => (
                <TabsTrigger key={agent} value={agent} className="capitalize">
                  {agent.replace("agent-", "").replace(/-/g, " ")}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={activeTab}>
              {!feedbackItems || feedbackItems.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No pending decisions to review</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {feedbackItems.map((item) => (
                      <FeedbackCard
                        key={item.id}
                        item={item}
                        onApprove={() => handleDecision(item, "approved")}
                        onReject={() => handleDecision(item, "rejected")}
                        getAgentIcon={getAgentIcon}
                        getDecisionTypeBadge={getDecisionTypeBadge}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provide Feedback</DialogTitle>
            <DialogDescription>
              Help improve AI decisions by explaining why you rejected this recommendation.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Why did you reject this recommendation? (optional)"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>
              Cancel
            </Button>
            <Button onClick={submitWithFeedback}>Submit Feedback</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface FeedbackCardProps {
  item: FeedbackItem;
  onApprove: () => void;
  onReject: () => void;
  getAgentIcon: (name: string) => React.ReactNode;
  getDecisionTypeBadge: (type: string) => React.ReactNode;
}

function FeedbackCard({
  item,
  onApprove,
  onReject,
  getAgentIcon,
  getDecisionTypeBadge,
}: FeedbackCardProps) {
  const confidence = Math.round(item.confidence * 100);
  const recommendationText = getRecommendationText(item.ai_recommendation);

  return (
    <div className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {getAgentIcon(item.agent_name)}
            <span className="text-sm font-medium capitalize">
              {item.agent_name.replace("agent-", "").replace(/-/g, " ")}
            </span>
            {getDecisionTypeBadge(item.decision_type)}
            <Badge variant="outline" className="text-xs">
              {confidence}% confident
            </Badge>
          </div>

          <div className="text-sm text-muted-foreground">
            {recommendationText}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            <span>•</span>
            <span className="capitalize">{item.entity_type}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onReject}>
            <XCircle className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={onApprove}>
            <CheckCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
