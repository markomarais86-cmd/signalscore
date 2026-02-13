import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { useEffectiveOrg } from "@/hooks/use-effective-org";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Play, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { agentLogger } from "@/lib/logger";

export default function AgentTester() {
  const { userProfile } = useAuth();
  const { effectiveOrgId } = useEffectiveOrg();
  const [runningAgents, setRunningAgents] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, any>>({});

  const agents = [
    {
      id: 'lead_qualification',
      name: 'Lead Qualification',
      description: 'Qualify leads based on account scores',
      functionName: 'agent-lead-qualification'
    },
    {
      id: 'data_enrichment',
      name: 'Data Enrichment',
      description: 'Enrich accounts with missing firmographic data',
      functionName: 'agent-data-enrichment'
    },
    {
      id: 'follow_up',
      name: 'Follow-Up Automation',
      description: 'Identify leads that need follow-up',
      functionName: 'agent-follow-up'
    },
    {
      id: 'meeting_scheduler',
      name: 'Meeting Scheduler',
      description: 'Schedule meetings for qualified high-score leads',
      functionName: 'agent-meeting-scheduler'
    }
  ];

  const runAgent = async (agentId: string, functionName: string) => {
    if (!effectiveOrgId) {
      toast.error('Organization not found');
      return;
    }

    setRunningAgents(prev => new Set(prev).add(agentId));
    
    try {
      agentLogger.debug(`Running agent: ${agentId}`);
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          agent_id: agentId,
          org_id: effectiveOrgId
        }
      });

      if (error) throw error;

      agentLogger.debug(`Agent ${agentId} completed:`, data);
      
      setResults(prev => ({
        ...prev,
        [agentId]: {
          success: true,
          data,
          timestamp: new Date().toISOString()
        }
      }));
      
      toast.success(`${functionName} completed successfully!`);
    } catch (error: any) {
      agentLogger.error(`Agent ${agentId} failed:`, error);
      
      setResults(prev => ({
        ...prev,
        [agentId]: {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }));
      
      toast.error(`Agent failed: ${error.message}`);
    } finally {
      setRunningAgents(prev => {
        const next = new Set(prev);
        next.delete(agentId);
        return next;
      });
    }
  };

  const runAllAgents = async () => {
    for (const agent of agents) {
      await runAgent(agent.id, agent.functionName);
      // Small delay between agents
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Agent Tester</h1>
          <p className="text-muted-foreground mt-2">
            Trigger AI agents manually to test their functionality
          </p>
        </div>
        <Button 
          onClick={runAllAgents}
          disabled={runningAgents.size > 0}
          size="lg"
        >
          <Play className="mr-2 h-5 w-5" />
          Run All Agents
        </Button>
      </div>

      <Alert>
        <AlertDescription>
          This page allows you to manually trigger AI agents for testing purposes. 
          In production, these agents run on a schedule automatically.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map(agent => {
          const isRunning = runningAgents.has(agent.id);
          const result = results[agent.id];
          
          return (
            <Card key={agent.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{agent.name}</span>
                  {isRunning && <RefreshCw className="h-4 w-4 animate-spin text-primary" />}
                  {!isRunning && result?.success && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                  {!isRunning && result?.success === false && <XCircle className="h-5 w-5 text-red-500" />}
                </CardTitle>
                <CardDescription>{agent.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => runAgent(agent.id, agent.functionName)}
                  disabled={isRunning}
                  className="w-full"
                >
                  {isRunning ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Run Agent
                    </>
                  )}
                </Button>

                {result && (
                  <div className="mt-4 p-3 rounded-lg bg-muted text-sm space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(result.timestamp).toLocaleString()}
                    </div>
                    
                    {result.success ? (
                      <div className="space-y-1">
                        <div className="font-medium text-green-600">Success</div>
                        {result.data?.records_processed && (
                          <div>Processed: {result.data.records_processed} records</div>
                        )}
                        {result.data?.records_affected && (
                          <div>Affected: {result.data.records_affected} records</div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="font-medium text-red-600">Error</div>
                        <div className="text-xs">{result.error}</div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
