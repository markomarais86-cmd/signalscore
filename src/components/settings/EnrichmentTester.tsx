import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, TestTube, CheckCircle2, XCircle, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface TestResult {
  provider: string;
  status: "pending" | "success" | "error";
  enrichedData?: any;
  error?: string;
  duration?: number;
}

export function EnrichmentTester() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  const testDomain = "stripe.com";

  const runTest = async (provider: string) => {
    setTesting(true);
    const startTime = Date.now();
    
    setResults(prev => [...prev, { provider, status: "pending" }]);

    try {
      const orgId = user?.user_metadata?.organization_id;
      if (!orgId) throw new Error("Organization ID not found");

      // Create a test enrichment job
      const { data: job, error: jobError } = await supabase
        .from("enrichment_jobs")
        .insert([{
          org_id: orgId,
          provider,
          job_type: "test",
          status: "processing",
          total_records: 1,
          filter_criteria: { test_domain: testDomain }
        }])
        .select()
        .single();

      if (jobError) throw jobError;

      // Call the appropriate enrichment function
      let functionName = "";
      if (provider === "clearbit_free") functionName = "enrich-clearbit-free";
      else if (provider === "ai") functionName = "enrich-firmographics";
      else if (provider === "pdl") functionName = "enrich-pdl";
      else if (provider === "smart_sequential") functionName = "smart-enrich";

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { jobId: job.id }
      });

      const duration = Date.now() - startTime;

      if (error) throw error;

      setResults(prev =>
        prev.map(r =>
          r.provider === provider
            ? { ...r, status: "success", enrichedData: data, duration }
            : r
        )
      );

      toast({
        title: `${provider} test successful`,
        description: `Completed in ${(duration / 1000).toFixed(2)}s`,
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      setResults(prev =>
        prev.map(r =>
          r.provider === provider
            ? { ...r, status: "error", error: error.message, duration }
            : r
        )
      );

      toast({
        title: `${provider} test failed`,
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const clearResults = () => setResults([]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Enrichment Testing
            </CardTitle>
            <CardDescription>
              Test each enrichment provider with test domain: <code className="text-sm bg-muted px-2 py-1 rounded">{testDomain}</code>
            </CardDescription>
          </div>
          {results.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearResults}>
              Clear Results
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={() => runTest("clearbit_free")}
            disabled={testing}
          >
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Test Clearbit Free
          </Button>
          <Button
            variant="outline"
            onClick={() => runTest("ai")}
            disabled={testing}
          >
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Test AI Enrichment
          </Button>
          <Button
            variant="outline"
            onClick={() => runTest("pdl")}
            disabled={testing}
          >
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Test PDL
          </Button>
          <Button
            variant="outline"
            onClick={() => runTest("smart_sequential")}
            disabled={testing}
            className="col-span-2"
          >
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Test Smart Enrich (All Tiers)
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-3 border rounded-lg p-4">
            <h4 className="font-semibold text-sm">Test Results</h4>
            {results.map((result, idx) => (
              <div key={idx} className="flex items-start justify-between border-b pb-3 last:border-b-0 last:pb-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{result.provider}</span>
                    {result.status === "pending" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {result.status === "success" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    {result.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                  </div>
                  {result.duration && (
                    <p className="text-sm text-muted-foreground">
                      Duration: {(result.duration / 1000).toFixed(2)}s
                    </p>
                  )}
                  {result.error && (
                    <p className="text-sm text-destructive">{result.error}</p>
                  )}
                  {result.enrichedData && (
                    <div className="text-xs bg-muted p-2 rounded mt-2">
                      <div className="flex flex-wrap gap-2">
                        {result.enrichedData.enriched && (
                          <Badge variant="secondary">✓ {result.enrichedData.enriched} enriched</Badge>
                        )}
                        {result.enrichedData.failed && result.enrichedData.failed > 0 && (
                          <Badge variant="destructive">✗ {result.enrichedData.failed} failed</Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
