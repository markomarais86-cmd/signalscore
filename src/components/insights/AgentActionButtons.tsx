import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, RefreshCw, Target, Zap, Users, Search, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AgentAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const AGENT_TYPE_ACTIONS: Record<string, AgentAction[]> = {
  lead_qualification: [
    { key: "re-score", label: "Re-Score Leads", icon: <Target className="h-3.5 w-3.5" />, description: "Re-run scoring on affected leads" },
    { key: "enrich", label: "Enrich Leads", icon: <Search className="h-3.5 w-3.5" />, description: "Enrich leads with missing data" },
  ],
  data_enrichment: [
    { key: "re-enrich", label: "Re-Enrich Failed", icon: <RefreshCw className="h-3.5 w-3.5" />, description: "Retry enrichment on failed records" },
    { key: "score-enriched", label: "Score Enriched", icon: <Target className="h-3.5 w-3.5" />, description: "Score newly enriched accounts" },
  ],
  discovery: [
    { key: "import-discovered", label: "Import Accounts", icon: <Users className="h-3.5 w-3.5" />, description: "Import discovered accounts to pipeline" },
    { key: "enrich-discovered", label: "Enrich Discovered", icon: <Zap className="h-3.5 w-3.5" />, description: "Enrich newly discovered accounts" },
  ],
  icp_persona: [
    { key: "re-classify", label: "Re-Classify", icon: <Users className="h-3.5 w-3.5" />, description: "Re-run persona classification" },
  ],
  validation_scoring: [
    { key: "fix-scores", label: "Fix Invalid Scores", icon: <Target className="h-3.5 w-3.5" />, description: "Re-compute flagged scores" },
  ],
  pipeline_controller: [
    { key: "update-stages", label: "Update Stages", icon: <Zap className="h-3.5 w-3.5" />, description: "Apply recommended stage changes" },
  ],
};

const DEFAULT_ACTIONS: AgentAction[] = [
  { key: "re-run", label: "Re-Run Agent", icon: <Play className="h-3.5 w-3.5" />, description: "Run this agent again" },
];

interface AgentActionButtonsProps {
  agentId: string;
  agentType: string;
  runStatus: string;
  recordsAffected?: number | null;
}

export function AgentActionButtons({ agentId, agentType, runStatus, recordsAffected }: AgentActionButtonsProps) {
  const [executing, setExecuting] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  if (runStatus !== "completed" && runStatus !== "failed") return null;

  const actions = [...(AGENT_TYPE_ACTIONS[agentType] || []), ...DEFAULT_ACTIONS];

  const handleExecute = async (action: AgentAction) => {
    setExecuting(action.key);
    try {
      if (action.key === "re-run") {
        const { error } = await supabase.functions.invoke("run-agent", {
          body: { agent_id: agentId },
        });
        if (error) throw error;
        toast.success(`Agent re-run started`);
      } else if (action.key === "score-enriched" || action.key === "re-score" || action.key === "fix-scores") {
        const { data: agent } = await supabase
          .from("ai_agents")
          .select("org_id")
          .eq("id", agentId)
          .single();
        if (agent) {
          const { error } = await supabase.functions.invoke("bulk-score-accounts", {
            body: { org_id: agent.org_id, chunk_size: 5000 },
          });
          if (error) throw error;
          toast.success("Scoring started in background");
        }
      } else if (action.key === "re-enrich" || action.key === "enrich" || action.key === "enrich-discovered") {
        const { data: agent } = await supabase
          .from("ai_agents")
          .select("org_id")
          .eq("id", agentId)
          .single();
        if (agent) {
          const { error } = await supabase.functions.invoke("enrich-unified", {
            body: { record_type: "account", org_id: agent.org_id },
          });
          if (error) throw error;
          toast.success("Enrichment started");
        }
      } else {
        // Generic re-run for any other action
        const { error } = await supabase.functions.invoke("run-agent", {
          body: { agent_id: agentId },
        });
        if (error) throw error;
        toast.success(`${action.label} initiated`);
      }
      setCompleted((prev) => new Set(prev).add(action.key));
    } catch (err: any) {
      toast.error(err.message || `Failed to execute ${action.label}`);
    } finally {
      setExecuting(null);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick Actions</p>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.key}
            size="sm"
            variant={completed.has(action.key) ? "secondary" : "outline"}
            disabled={!!executing || completed.has(action.key)}
            onClick={() => handleExecute(action)}
            className="h-8 text-xs"
            title={action.description}
          >
            {completed.has(action.key) ? (
              <CheckCircle className="h-3.5 w-3.5 mr-1.5 text-green-500" />
            ) : executing === action.key ? (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <span className="mr-1.5">{action.icon}</span>
            )}
            {action.label}
          </Button>
        ))}
      </div>
      {recordsAffected && recordsAffected > 0 && (
        <Badge variant="outline" className="text-xs">
          {recordsAffected} records affected
        </Badge>
      )}
    </div>
  );
}
