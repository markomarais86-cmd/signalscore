import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Users, CheckCircle2, AlertCircle, Loader2, RefreshCw, Database } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function ContactsBackfill() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<any>(null);

  const runBackfill = async () => {
    if (!userProfile?.org_id) {
      toast({
        title: "Error",
        description: "Organization ID not found",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    setStatus("Starting backfill process...");
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('backfill-contacts', {
        body: { orgId: userProfile.org_id }
      });

      if (error) throw error;

      setResult(data);
      setStatus("Backfill completed successfully!");
      
      toast({
        title: "✓ Backfill Complete!",
        description: `Created ${data.created} contacts from ${data.totalLeads} leads`,
      });
    } catch (error: any) {
      console.error('Backfill error:', error);
      setStatus(`Error: ${error.message}`);
      toast({
        title: "Backfill Failed",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="border-accent/20 bg-accent/5">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-accent" />
            <div>
              <CardTitle className="text-base">Contact Backfill</CardTitle>
              <CardDescription>
                One-time migration: Create contact records from existing leads
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline">
            <Database className="h-3 w-3 mr-1" />
            Migration
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {result && (
          <div className="p-4 bg-background rounded-lg border space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-[hsl(var(--signal-high))] mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Backfill Results</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Contacts Created:</span>
                    <span className="ml-2 font-medium">{result.created || 0}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Leads Processed:</span>
                    <span className="ml-2 font-medium">{result.totalLeads || 0}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Skipped:</span>
                    <span className="ml-2 font-medium">{result.skipped || 0}</span>
                  </div>
                  {result.errors && result.errors.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Errors:</span>
                      <span className="ml-2 font-medium text-destructive">{result.errors.length}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {isRunning && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{status}</span>
            </div>
            <Progress value={50} className="h-2" />
          </div>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>One-Time Operation</AlertTitle>
          <AlertDescription className="text-xs">
            This creates contact records from leads that have email addresses. Only run this once during initial setup.
          </AlertDescription>
        </Alert>

        <Button
          onClick={runBackfill}
          disabled={isRunning || !!result}
          className="w-full"
          variant="outline"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Running Backfill...
            </>
          ) : result ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Backfill Complete
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Contact Backfill
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
