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

// DEPRECATED: This component references a deprecated backfill-contacts edge function
// The leads table is the primary source, and this backfill is no longer needed
export function LeadsBackfill() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<any>(null);

  const runBackfill = async () => {
    toast({
      title: "Deprecated",
      description: "This backfill operation is no longer needed. Leads are now the primary data source.",
      variant: "destructive",
    });
  };

  return (
    <Card className="border-accent/20 bg-accent/5">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-accent" />
            <div>
              <CardTitle className="text-base">Lead Backfill</CardTitle>
              <CardDescription>
                One-time migration: Create lead records from existing data
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline">
            <Database className="h-3 w-3 mr-1" />
            Deprecated
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Longer Needed</AlertTitle>
          <AlertDescription className="text-xs">
            This migration tool is deprecated. The Leads table is now the primary source for all lead/contact data.
          </AlertDescription>
        </Alert>

        <Button
          onClick={runBackfill}
          disabled={true}
          className="w-full"
          variant="outline"
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Backfill Not Required
        </Button>
      </CardContent>
    </Card>
  );
}
