import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, TestTube, CheckCircle2, XCircle, Zap, Search, Users, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface TestResult {
  provider: string;
  status: "pending" | "success" | "error";
  enrichedData?: any;
  error?: string;
  duration?: number;
}

interface AISearchResult {
  success: boolean;
  enriched_data?: any;
  extra_contacts?: any[];
  sources?: string[];
  confidence?: string;
  error?: string;
}

export function EnrichmentTester() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [aiSearchResult, setAiSearchResult] = useState<AISearchResult | null>(null);
  const [aiSearchTesting, setAiSearchTesting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Test inputs for AI Search
  const [testName, setTestName] = useState("Elon Musk");
  const [testCompany, setTestCompany] = useState("Tesla");
  const [testTitle, setTestTitle] = useState("CEO");

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

  const runAISearchTest = async () => {
    setAiSearchTesting(true);
    setAiSearchResult(null);
    const startTime = Date.now();

    try {
      const { data, error } = await supabase.functions.invoke("agent-search-enrichment", {
        body: {
          record_type: "lead",
          search_data: {
            first_name: testName.split(" ")[0] || "",
            last_name: testName.split(" ").slice(1).join(" ") || "",
            company_name: testCompany,
            title: testTitle,
          },
          target_titles: ["CEO", "CTO", "CFO", "VP", "Director"],
        }
      });

      const duration = Date.now() - startTime;

      if (error) throw error;

      setAiSearchResult(data);

      toast({
        title: "AI Search completed",
        description: `Found ${data.extra_contacts?.length || 0} extra contacts in ${(duration / 1000).toFixed(2)}s`,
      });
    } catch (error: any) {
      setAiSearchResult({ success: false, error: error.message });
      toast({
        title: "AI Search failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAiSearchTesting(false);
    }
  };

  const clearResults = () => {
    setResults([]);
    setAiSearchResult(null);
  };

  const renderFieldScore = (score: number | undefined) => {
    if (score === undefined || score === null) return null;
    const colors = {
      0: "bg-destructive/20 text-destructive",
      1: "bg-yellow-500/20 text-yellow-700",
      2: "bg-green-500/20 text-green-700",
    };
    return (
      <Badge className={colors[score as keyof typeof colors] || "bg-muted"}>
        {score}/2
      </Badge>
    );
  };

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
              Test enrichment providers and the new AI-powered search agent
            </CardDescription>
          </div>
          {(results.length > 0 || aiSearchResult) && (
            <Button variant="outline" size="sm" onClick={clearResults}>
              Clear Results
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AI Search Test Section */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Search className="h-4 w-4" />
            AI-Powered Contact Search (Eugene's 48-Column Schema)
          </h4>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <Label htmlFor="test-name" className="text-xs">Full Name</Label>
              <Input
                id="test-name"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="e.g., Elon Musk"
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="test-company" className="text-xs">Company</Label>
              <Input
                id="test-company"
                value={testCompany}
                onChange={(e) => setTestCompany(e.target.value)}
                placeholder="e.g., Tesla"
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="test-title" className="text-xs">Title</Label>
              <Input
                id="test-title"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                placeholder="e.g., CEO"
                className="h-9"
              />
            </div>
          </div>
          <Button
            onClick={runAISearchTest}
            disabled={aiSearchTesting || !testName}
            className="w-full"
          >
            {aiSearchTesting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            Test AI Contact Search
          </Button>
        </div>

        {/* AI Search Results */}
        {aiSearchResult && (
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                {aiSearchResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                AI Search Results
              </h4>
              {aiSearchResult.confidence && (
                <Badge variant="outline">
                  Confidence: {aiSearchResult.confidence}
                </Badge>
              )}
            </div>

            {aiSearchResult.error ? (
              <p className="text-sm text-destructive">{aiSearchResult.error}</p>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {/* Primary Contact */}
                {aiSearchResult.enriched_data && (
                  <AccordionItem value="primary">
                    <AccordionTrigger className="text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Primary Contact Data
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ScrollArea className="h-64">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(aiSearchResult.enriched_data).map(([key, value]) => (
                            <div key={key} className="flex justify-between border-b pb-1">
                              <span className="font-medium text-muted-foreground">{key}:</span>
                              <span className="text-right max-w-[60%] truncate">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value || '-')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Extra Contacts */}
                {aiSearchResult.extra_contacts && aiSearchResult.extra_contacts.length > 0 && (
                  <AccordionItem value="extra">
                    <AccordionTrigger className="text-sm">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Extra Contacts Discovered ({aiSearchResult.extra_contacts.length})
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ScrollArea className="h-48">
                        <div className="space-y-3">
                          {aiSearchResult.extra_contacts.map((contact, idx) => (
                            <div key={idx} className="border rounded p-2 text-xs">
                              <div className="font-medium">
                                {contact.first_name} {contact.last_name}
                              </div>
                              <div className="text-muted-foreground">{contact.title}</div>
                              {contact.email && <div>Email: {contact.email}</div>}
                              {contact.linkedin_url && (
                                <a 
                                  href={contact.linkedin_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  LinkedIn
                                </a>
                              )}
                              {contact.confidence && (
                                <Badge variant="outline" className="mt-1">
                                  {Math.round(contact.confidence * 100)}% confident
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Sources */}
                {aiSearchResult.sources && aiSearchResult.sources.length > 0 && (
                  <AccordionItem value="sources">
                    <AccordionTrigger className="text-sm">
                      Sources ({aiSearchResult.sources.length})
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-1 text-xs">
                        {aiSearchResult.sources.map((source, idx) => (
                          <a
                            key={idx}
                            href={source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-primary hover:underline truncate"
                          >
                            {source}
                          </a>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            )}
          </div>
        )}

        {/* Legacy Provider Tests */}
        <div className="border-t pt-4">
          <h4 className="font-semibold text-sm mb-3">Legacy Provider Tests</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Test domain: <code className="bg-muted px-2 py-1 rounded">{testDomain}</code>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => runTest("clearbit_free")}
              disabled={testing}
              size="sm"
            >
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Test Clearbit Free
            </Button>
            <Button
              variant="outline"
              onClick={() => runTest("ai")}
              disabled={testing}
              size="sm"
            >
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Test AI Enrichment
            </Button>
            <Button
              variant="outline"
              onClick={() => runTest("pdl")}
              disabled={testing}
              size="sm"
            >
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Test PDL
            </Button>
            <Button
              variant="outline"
              onClick={() => runTest("smart_sequential")}
              disabled={testing}
              size="sm"
            >
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
              Test Smart Enrich
            </Button>
          </div>
        </div>

        {/* Legacy Results */}
        {results.length > 0 && (
          <div className="space-y-3 border rounded-lg p-4">
            <h4 className="font-semibold text-sm">Legacy Test Results</h4>
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
