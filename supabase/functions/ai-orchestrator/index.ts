import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WorkflowStep {
  id: string;
  action: string;
  parameters: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: string;
  started_at?: string;
  completed_at?: string;
}

interface WorkflowRequest {
  workflow_type: string;
  workflow_name: string;
  parameters: Record<string, any>;
  org_id: string;
  user_id: string;
}

interface WorkflowDefinition {
  name: string;
  description: string;
  steps: Array<{
    id: string;
    action: string;
    description: string;
    parameterMapper: (params: Record<string, any>, prevResults: Record<string, any>) => Record<string, any>;
    skipCondition?: (params: Record<string, any>, prevResults: Record<string, any>) => boolean;
  }>;
}

// Workflow definitions
const WORKFLOWS: Record<string, WorkflowDefinition> = {
  build_target_list: {
    name: "Build Target List",
    description: "Complete workflow from search to prioritized list",
    steps: [
      {
        id: "search",
        action: "search_accounts",
        description: "Search for accounts matching criteria",
        parameterMapper: (params) => ({
          industries: params.industries || [],
          countries: params.countries || [],
          min_score: params.min_score || 50,
          min_employees: params.min_employees,
          max_employees: params.max_employees,
          job_titles: params.job_titles || [],
          tech_stack: params.tech_stack || [],
          limit: params.limit || 100,
        }),
      },
      {
        id: "analyze",
        action: "analyze_pipeline",
        description: "Analyze the matched accounts",
        parameterMapper: () => ({}),
        skipCondition: (_, prevResults) => !prevResults.search?.accounts?.length,
      },
      {
        id: "recommend",
        action: "recommend_accounts",
        description: "Get AI-ranked priority accounts",
        parameterMapper: (params) => ({
          count: params.top_count || 25,
          focus: params.focus || "high_fit",
        }),
        skipCondition: (_, prevResults) => !prevResults.search?.accounts?.length,
      },
      {
        id: "find_contacts",
        action: "search_contacts",
        description: "Find decision makers at top accounts",
        parameterMapper: (params, prevResults) => ({
          job_titles: params.job_titles || ["VP", "Director", "Head of", "Chief"],
          personas: ["Technical Decision Maker", "Executive", "Budget Holder"],
          min_account_score: params.min_score || 70,
          verified_email_only: params.verified_only || false,
          limit: 50,
        }),
        skipCondition: (_, prevResults) => !prevResults.recommend?.accounts?.length,
      },
    ],
  },

  audit_data_quality: {
    name: "Data Quality Audit",
    description: "Full assessment of data completeness and quality",
    steps: [
      {
        id: "identify_gaps",
        action: "identify_gaps",
        description: "Find coverage and data gaps",
        parameterMapper: () => ({}),
      },
      {
        id: "analyze_coverage",
        action: "analyze_persona_coverage",
        description: "Analyze contact persona distribution",
        parameterMapper: () => ({}),
      },
      {
        id: "scoring_insights",
        action: "get_scoring_insights",
        description: "Analyze scoring patterns",
        parameterMapper: () => ({}),
      },
      {
        id: "territory_analysis",
        action: "analyze_territory",
        description: "Geographic opportunity analysis",
        parameterMapper: () => ({ group_by: "country" }),
      },
      {
        id: "icp_suggestions",
        action: "suggest_icp_improvements",
        description: "Get ICP improvement suggestions",
        parameterMapper: () => ({}),
      },
    ],
  },

  prepare_campaign: {
    name: "Prepare Campaign",
    description: "Build campaign-ready list with contacts",
    steps: [
      {
        id: "search_accounts",
        action: "search_accounts",
        description: "Find high-fit accounts",
        parameterMapper: (params) => ({
          industries: params.industries || [],
          countries: params.countries || [],
          min_score: params.min_score || 70,
          icp_qualified_only: true,
          verified_email_only: true,
          limit: params.account_limit || 50,
        }),
      },
      {
        id: "find_decision_makers",
        action: "search_contacts",
        description: "Find campaign-ready contacts",
        parameterMapper: (params) => ({
          job_titles: params.job_titles || [],
          personas: params.personas || ["Technical Decision Maker", "Executive"],
          verified_email_only: true,
          min_account_score: params.min_score || 70,
          limit: params.contact_limit || 200,
        }),
        skipCondition: (_, prevResults) => !prevResults.search_accounts?.accounts?.length,
      },
      {
        id: "analyze_coverage",
        action: "analyze_persona_coverage",
        description: "Check persona coverage for campaign",
        parameterMapper: () => ({}),
      },
    ],
  },

  optimize_icp: {
    name: "Optimize ICP",
    description: "Analyze patterns and suggest improvements",
    steps: [
      {
        id: "analyze_pipeline",
        action: "analyze_pipeline",
        description: "Analyze current pipeline health",
        parameterMapper: () => ({}),
      },
      {
        id: "scoring_insights",
        action: "get_scoring_insights",
        description: "Understand scoring patterns",
        parameterMapper: () => ({}),
      },
      {
        id: "territory_analysis",
        action: "analyze_territory",
        description: "Analyze geographic distribution",
        parameterMapper: () => ({ group_by: "industry" }),
      },
      {
        id: "identify_gaps",
        action: "identify_gaps",
        description: "Find coverage gaps",
        parameterMapper: () => ({}),
      },
      {
        id: "suggest_improvements",
        action: "suggest_icp_improvements",
        description: "Get AI-powered ICP suggestions",
        parameterMapper: () => ({}),
      },
    ],
  },
};

// Execute a single action
async function executeAction(
  supabase: any,
  action: string,
  parameters: Record<string, any>,
  org_id: string,
  user_id: string,
  authHeader: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-actions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ action, parameters, org_id, user_id }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Action failed: ${errorText}` };
    }

    const data = await response.json();
    return { success: data.success, result: data.result, error: data.error };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Update workflow status in database
async function updateWorkflow(
  supabase: any,
  workflowId: string,
  updates: {
    status?: string;
    current_step?: number;
    step_outputs?: any;
    steps?: any;
    error_message?: string;
    completed_at?: string;
  }
) {
  const { error } = await supabase
    .from("ai_workflows")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workflowId);

  if (error) {
    console.error("[Orchestrator] Failed to update workflow:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { action } = body;

    // Handle different orchestrator actions
    switch (action) {
      case "start_workflow": {
        const { workflow_type, workflow_name, parameters, org_id, user_id } = body as WorkflowRequest;

        console.log(`[Orchestrator] Starting workflow: ${workflow_type}`, { org_id, user_id });

        const workflow = WORKFLOWS[workflow_type];
        if (!workflow) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: `Unknown workflow type: ${workflow_type}` 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create workflow record
        const steps: WorkflowStep[] = workflow.steps.map((s) => ({
          id: s.id,
          action: s.action,
          parameters: {},
          status: "pending" as const,
        }));

        const { data: workflowRecord, error: insertError } = await supabase
          .from("ai_workflows")
          .insert({
            org_id,
            user_id,
            workflow_type,
            workflow_name: workflow_name || workflow.name,
            status: "running",
            steps,
            total_steps: steps.length,
            current_step: 0,
            context: parameters,
            step_outputs: {},
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(`Failed to create workflow: ${insertError.message}`);
        }

        // Execute workflow steps asynchronously
        const workflowId = workflowRecord.id;
        const stepOutputs: Record<string, any> = {};

        for (let i = 0; i < workflow.steps.length; i++) {
          const stepDef = workflow.steps[i];
          const step = steps[i];

          // Update current step
          await updateWorkflow(supabase, workflowId, {
            current_step: i + 1,
            steps: steps.map((s, idx) => idx === i ? { ...s, status: "running", started_at: new Date().toISOString() } : s),
          });

          // Check skip condition
          if (stepDef.skipCondition && stepDef.skipCondition(parameters, stepOutputs)) {
            steps[i] = {
              ...step,
              status: "skipped",
              completed_at: new Date().toISOString(),
            };
            continue;
          }

          // Map parameters
          const stepParams = stepDef.parameterMapper(parameters, stepOutputs);
          steps[i].parameters = stepParams;

          console.log(`[Orchestrator] Executing step ${i + 1}/${workflow.steps.length}: ${stepDef.action}`);

          // Execute action
          const result = await executeAction(
            supabase,
            stepDef.action,
            stepParams,
            org_id,
            user_id,
            authHeader
          );

          if (result.success) {
            steps[i] = {
              ...step,
              status: "completed",
              result: result.result,
              parameters: stepParams,
              completed_at: new Date().toISOString(),
            };
            stepOutputs[stepDef.id] = result.result;
          } else {
            steps[i] = {
              ...step,
              status: "failed",
              error: result.error,
              parameters: stepParams,
              completed_at: new Date().toISOString(),
            };

            // Update workflow with failure
            await updateWorkflow(supabase, workflowId, {
              status: "failed",
              steps,
              step_outputs: stepOutputs,
              error_message: result.error,
            });

            return new Response(JSON.stringify({
              success: false,
              workflow_id: workflowId,
              error: result.error,
              completed_steps: i,
              total_steps: workflow.steps.length,
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Update workflow progress
          await updateWorkflow(supabase, workflowId, {
            steps,
            step_outputs: stepOutputs,
          });
        }

        // Complete workflow
        await updateWorkflow(supabase, workflowId, {
          status: "completed",
          steps,
          step_outputs: stepOutputs,
          completed_at: new Date().toISOString(),
        });

        // Build summary message
        const completedCount = steps.filter(s => s.status === "completed").length;
        const skippedCount = steps.filter(s => s.status === "skipped").length;

        let summaryMessage = `✅ **Workflow Completed:** ${workflow.name}\n\n`;
        summaryMessage += `**Steps:** ${completedCount} completed, ${skippedCount} skipped\n\n`;

        // Add key results from each step
        for (const step of steps) {
          if (step.status === "completed" && step.result) {
            const stepDef = workflow.steps.find(s => s.id === step.id);
            summaryMessage += `**${stepDef?.description || step.action}:**\n`;
            if (step.result.message) {
              summaryMessage += step.result.message.slice(0, 200) + (step.result.message.length > 200 ? '...' : '') + "\n\n";
            }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          workflow_id: workflowId,
          workflow_type,
          workflow_name: workflow.name,
          completed_steps: completedCount,
          skipped_steps: skippedCount,
          total_steps: workflow.steps.length,
          duration_ms: Date.now() - startTime,
          step_outputs: stepOutputs,
          message: summaryMessage,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_workflow_status": {
        const { workflow_id } = body;

        const { data, error } = await supabase
          .from("ai_workflows")
          .select("*")
          .eq("id", workflow_id)
          .single();

        if (error) {
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const progress = data.total_steps > 0 
          ? Math.round((data.current_step / data.total_steps) * 100)
          : 0;

        return new Response(JSON.stringify({
          success: true,
          workflow: {
            id: data.id,
            type: data.workflow_type,
            name: data.workflow_name,
            status: data.status,
            current_step: data.current_step,
            total_steps: data.total_steps,
            progress_percentage: progress,
            steps: data.steps,
            step_outputs: data.step_outputs,
            started_at: data.started_at,
            completed_at: data.completed_at,
            error_message: data.error_message,
          },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list_workflows": {
        const { org_id, limit = 10, status } = body;

        let query = supabase
          .from("ai_workflows")
          .select("id, workflow_type, workflow_name, status, current_step, total_steps, started_at, completed_at, error_message")
          .eq("org_id", org_id)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (status) {
          query = query.eq("status", status);
        }

        const { data, error } = await query;

        if (error) {
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          workflows: data || [],
          count: data?.length || 0,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "cancel_workflow": {
        const { workflow_id } = body;

        const { error } = await supabase
          .from("ai_workflows")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", workflow_id)
          .eq("status", "running");

        if (error) {
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, message: "Workflow cancelled" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_available_workflows": {
        const availableWorkflows = Object.entries(WORKFLOWS).map(([type, def]) => ({
          type,
          name: def.name,
          description: def.description,
          step_count: def.steps.length,
          steps: def.steps.map(s => ({ id: s.id, action: s.action, description: s.description })),
        }));

        return new Response(JSON.stringify({
          success: true,
          workflows: availableWorkflows,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Unknown orchestrator action: ${action}` 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("[Orchestrator] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
