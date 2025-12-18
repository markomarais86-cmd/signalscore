import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, Clock, AlertCircle, Activity, Database, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface AgentRun {
  id: string;
  agent_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  records_processed: number | null;
  records_affected: number | null;
  results: Record<string, unknown> | null;
  error_message: string | null;
  agent?: {
    name: string;
    agent_type: string;
    description: string | null;
  };
}

interface AgentRunDetailSheetProps {
  runId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentRunDetailSheet({ runId, open, onOpenChange }: AgentRunDetailSheetProps) {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!runId || !open) {
      setRun(null);
      return;
    }

    const fetchRunDetails = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('ai_agent_runs')
          .select(`
            *,
            agent:ai_agents(name, agent_type, description)
          `)
          .eq('id', runId)
          .single();

        if (error) throw error;
        setRun(data as AgentRun);
      } catch (err) {
        console.error('Failed to fetch agent run details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRunDetails();
  }, [runId, open]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'running':
        return <Activity className="h-5 w-5 text-primary animate-pulse" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default',
      failed: 'destructive',
      running: 'secondary',
      pending: 'outline'
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status}
      </Badge>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Agent Run Details
          </SheetTitle>
          <SheetDescription>
            Detailed information about the agent execution
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)] mt-6">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !run ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Run details not found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Agent Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{run.agent?.name || 'Unknown Agent'}</span>
                    {getStatusBadge(run.status)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">
                    {run.agent?.description || `Type: ${run.agent?.agent_type || 'N/A'}`}
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      {getStatusIcon(run.status)}
                      <span className="capitalize">{run.status}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Timing */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Timing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Started:</span>
                    <span>{format(new Date(run.started_at), 'PPpp')}</span>
                  </div>
                  {run.completed_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Completed:</span>
                      <span>{format(new Date(run.completed_at), 'PPpp')}</span>
                    </div>
                  )}
                  {run.started_at && run.completed_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration:</span>
                      <span>
                        {Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Results */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Records Processed:</span>
                    <span className="font-medium">{run.records_processed ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Records Affected:</span>
                    <span className="font-medium">{run.records_affected ?? 'N/A'}</span>
                  </div>
                  {run.results && Object.keys(run.results).length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-muted-foreground mb-2">Additional Details:</p>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
                        {JSON.stringify(run.results, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Error Message */}
              {run.error_message && (
                <Card className="border-destructive/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-destructive">
                      <XCircle className="h-4 w-4" />
                      Error
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-destructive">{run.error_message}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
