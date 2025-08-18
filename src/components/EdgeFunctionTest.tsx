import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function EdgeFunctionTest() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { userProfile } = useAuth();

  const testRecommendationsFunction = async () => {
    if (!userProfile?.org_id) {
      setError("User profile not loaded");
      return;
    }

    setTesting(true);
    setResult(null);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('generate-icp-recommendations', {
        body: { org_id: userProfile.org_id }
      });

      if (functionError) {
        throw functionError;
      }

      setResult(data);
      console.log('Edge function test result:', data);
    } catch (err: any) {
      console.error('Edge function test error:', err);
      setError(err.message || 'Unknown error occurred');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Edge Function Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testRecommendationsFunction}
          disabled={testing}
          className="w-full"
        >
          {testing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Testing generate-icp-recommendations...
            </>
          ) : (
            "Test ICP Recommendations Function"
          )}
        </Button>

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {result && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Success!</strong> Edge function returned data:
              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}