import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Users, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function ContactsBackfill() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
    total_leads: number;
    errors?: string[];
  } | null>(null);
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const runBackfill = async () => {
    if (!userProfile?.org_id) {
      toast({
        title: "Error",
        description: "Organization not found",
        variant: "destructive"
      });
      return;
    }

    setIsRunning(true);
    setResult(null);

    try {
      console.log('🔄 Starting contacts backfill...');
      
      const { data, error } = await supabase.functions.invoke('backfill-contacts', {
        body: {
          orgId: userProfile.org_id,
          batchSize: 1000
        }
      });

      if (error) {
        throw error;
      }

      console.log('✅ Backfill complete:', data);
      setResult(data);

      toast({
        title: "Success",
        description: `Created ${data.created} new contacts from linked leads`,
      });

    } catch (error) {
      console.error('❌ Backfill error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to run backfill",
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Create Contacts from Leads
            </CardTitle>
            <CardDescription>
              One-time operation to convert linked leads into contact records
            </CardDescription>
          </div>
          <Button
            onClick={runBackfill}
            disabled={isRunning || (result?.created === 0 && result?.skipped > 0)}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : result?.created === 0 && result?.skipped > 0 ? (
              'Already Complete'
            ) : (
              'Run Backfill'
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This will create contact records from all linked leads that have email addresses.
            Contacts already exist will be skipped. This is safe to run multiple times.
          </AlertDescription>
        </Alert>

        {isRunning && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Processing leads...</span>
            </div>
            <Progress value={50} className="h-2" />
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Backfill Complete</span>
            </div>
            
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold">{result.total_leads.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contacts Created</p>
                <p className="text-2xl font-bold text-green-600">{result.created.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Already Existed</p>
                <p className="text-2xl font-bold text-muted-foreground">{result.skipped.toLocaleString()}</p>
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">Errors occurred:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    {result.errors.map((error, i) => (
                      <li key={i} className="text-sm">{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {result.created === 0 && result.skipped > 0 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  All linked leads already have contact records. No action needed.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>What this does:</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Finds all leads linked to accounts with email addresses</li>
            <li>Creates contact records with name, email, title, and persona</li>
            <li>Skips contacts that already exist</li>
            <li>Maps job titles to personas automatically</li>
            <li>Increases your campaign-ready accounts count</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
