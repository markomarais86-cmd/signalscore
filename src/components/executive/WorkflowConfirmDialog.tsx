import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface WorkflowDefinition {
  type: string;
  name: string;
  description: string;
  steps: string[];
}

const WORKFLOW_DEFINITIONS: Record<string, WorkflowDefinition> = {
  build_target_list: {
    type: "build_target_list",
    name: "Build Target List",
    description: "AI will analyze your ICP, identify high-fit accounts, and build a prioritized target list for outreach.",
    steps: [
      "Analyze current ICP criteria and scoring",
      "Identify under-penetrated segments and industries",
      "Find high-fit accounts missing from campaigns",
      "Generate prioritized target list with rationale",
    ],
  },
  optimize_icp: {
    type: "optimize_icp",
    name: "Optimize ICP",
    description: "AI will review your ICP performance data and suggest refinements to improve targeting accuracy.",
    steps: [
      "Audit current ICP criteria weights",
      "Analyze win/loss patterns by segment",
      "Identify underperforming criteria",
      "Generate optimization recommendations",
    ],
  },
  prepare_campaign: {
    type: "prepare_campaign",
    name: "Prepare Campaign",
    description: "AI will assemble campaign-ready accounts and contacts with personalized messaging suggestions.",
    steps: [
      "Select high-fit, enriched accounts",
      "Match contacts to persona criteria",
      "Generate messaging angles per segment",
      "Prepare export-ready campaign list",
    ],
  },
  audit_data_quality: {
    type: "audit_data_quality",
    name: "Audit Data Quality",
    description: "AI will scan your database for completeness gaps, duplicates, and stale records.",
    steps: [
      "Scan all accounts for missing fields",
      "Detect potential duplicate records",
      "Identify stale data (90+ days old)",
      "Generate prioritized remediation plan",
    ],
  },
};

interface WorkflowConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowType: string | null;
  orgId: string;
  context?: Record<string, unknown>;
}

export function WorkflowConfirmDialog({
  open,
  onOpenChange,
  workflowType,
  orgId,
  context,
}: WorkflowConfirmDialogProps) {
  const [isRunning, setIsRunning] = useState(false);
  const navigate = useNavigate();
  const workflow = workflowType ? WORKFLOW_DEFINITIONS[workflowType] : null;

  const handleRun = async () => {
    if (!workflow || !orgId) return;
    setIsRunning(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-orchestrator", {
        body: {
          action: "start_workflow",
          workflow_type: workflow.type,
          org_id: orgId,
          context: context || {},
        },
      });

      if (error) throw error;

      toast.success(`${workflow.name} workflow started!`, {
        description: "Monitor progress on the AI Agents page.",
        action: {
          label: "View Progress",
          onClick: () => navigate("/ai-agents"),
        },
      });
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start workflow";
      toast.error(message);
    } finally {
      setIsRunning(false);
    }
  };

  if (!workflow) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {workflow.name}
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
              AI-Powered
            </Badge>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            {workflow.description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Workflow Steps
          </p>
          <ol className="space-y-2">
            {workflow.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRunning}>Cancel</AlertDialogCancel>
          <Button onClick={handleRun} disabled={isRunning}>
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Run Workflow
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
