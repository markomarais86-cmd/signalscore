import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Play, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Zap, 
  Brain,
  Loader2,
  RefreshCw,
  Terminal
} from "lucide-react";

interface ProviderResult {
  provider: string;
  success: boolean;
  responseTime: number;
  statusCode?: number;
  error?: string;
}

interface TestResult {
  success: boolean;
  requestId: string;
  provider?: string;
  model?: string;
  responseTime?: number;
  totalTime?: number;
  availableProviders: string[];
  providerResults: ProviderResult[];
  testResponse?: string;
  error?: string;
}

const PROVIDER_INFO = {
  openai: { name: "OpenAI", icon: Brain, color: "text-green-500", description: "GPT-4o-mini" },
  abacus: { name: "Abacus.AI", icon: Zap, color: "text-purple-500", description: "RouteLLM" },
  lovable: { name: "Lovable AI", icon: Zap, color: "text-blue-500", description: "Gemini 2.5 Flash" },
};

export default function AITest() {
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState("Hello! Please respond with a brief greeting and confirm which AI model you are.");

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const runTest = async () => {
    setIsLoading(true);
    setTestResult(null);
    setLogs([]);
    
    addLog("Starting AI provider test...");
    addLog(`Test prompt: "${customPrompt.slice(0, 50)}..."`);

    try {
      const startTime = Date.now();
      addLog("Calling ai-chat edge function in test mode...");

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [{ role: 'user', content: customPrompt }],
          context: { currentPage: '/ai-test' },
          testMode: true,
        },
      });

      const totalClientTime = Date.now() - startTime;
      addLog(`Response received in ${totalClientTime}ms`);

      if (error) {
        addLog(`ERROR: ${error.message}`);
        toast.error("Test failed", { description: error.message });
        setTestResult({
          success: false,
          requestId: 'client-error',
          error: error.message,
          availableProviders: [],
          providerResults: [],
        });
        return;
      }

      addLog(`Success: ${data.success}`);
      addLog(`Provider used: ${data.provider || 'none'}`);
      addLog(`Model: ${data.model || 'unknown'}`);
      addLog(`Server response time: ${data.responseTime}ms`);
      addLog(`Available providers: ${data.availableProviders?.join(', ') || 'none'}`);

      if (data.providerResults) {
        data.providerResults.forEach((result: ProviderResult) => {
          const status = result.success ? '✅' : '❌';
          addLog(`${status} ${result.provider}: ${result.responseTime}ms ${result.error ? `(${result.error.slice(0, 50)})` : ''}`);
        });
      }

      setTestResult(data);
      
      if (data.success) {
        toast.success("AI Test Passed!", { 
          description: `${data.provider} responded in ${data.responseTime}ms` 
        });
      } else {
        toast.error("AI Test Failed", { description: data.error });
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addLog(`EXCEPTION: ${message}`);
      toast.error("Test failed", { description: message });
      setTestResult({
        success: false,
        requestId: 'exception',
        error: message,
        availableProviders: [],
        providerResults: [],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setTestResult(null);
    setLogs([]);
  };

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Provider Test</h1>
          <p className="text-muted-foreground">
            Test and verify all configured AI providers
          </p>
        </div>
        <Button variant="outline" onClick={clearResults} disabled={isLoading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Clear
        </Button>
      </div>

      {/* Test Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Test Configuration</CardTitle>
          <CardDescription>Customize the test prompt</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Enter a test prompt..."
            rows={3}
          />
          <Button onClick={runTest} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing Providers...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run AI Provider Test
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Provider Status Cards */}
      {testResult && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['openai', 'abacus', 'lovable'] as const).map((provider) => {
            const info = PROVIDER_INFO[provider];
            const Icon = info.icon;
            const isAvailable = testResult.availableProviders.includes(provider);
            const result = testResult.providerResults.find(r => r.provider === provider);
            const wasUsed = testResult.provider === provider;

            return (
              <Card key={provider} className={wasUsed ? 'ring-2 ring-primary' : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${info.color}`} />
                      <span className="font-medium">{info.name}</span>
                    </div>
                    {wasUsed && (
                      <Badge variant="default" className="text-xs">Used</Badge>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      {isAvailable ? (
                        <Badge variant="outline" className="text-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Configured
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600">
                          <XCircle className="h-3 w-3 mr-1" />
                          Not Configured
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Model</span>
                      <span>{info.description}</span>
                    </div>

                    {result && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Result</span>
                          {result.success ? (
                            <Badge variant="outline" className="text-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Response</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {result.responseTime}ms
                          </span>
                        </div>
                        {result.error && (
                          <p className="text-xs text-red-500 mt-2 truncate">
                            {result.error}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Test Response */}
      {testResult?.testResponse && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Response
            </CardTitle>
            <CardDescription>
              Response from {testResult.provider} ({testResult.model})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg">
              <p className="whitespace-pre-wrap">{testResult.testResponse}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Debug Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {testResult && (
        <Card className={testResult.success ? 'border-green-500' : 'border-red-500'}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              {testResult.success ? (
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              ) : (
                <XCircle className="h-8 w-8 text-red-500" />
              )}
              <div>
                <h3 className="font-semibold text-lg">
                  {testResult.success ? 'All Systems Operational' : 'Test Failed'}
                </h3>
                <p className="text-muted-foreground">
                  {testResult.success 
                    ? `${testResult.provider} responded successfully in ${testResult.responseTime}ms`
                    : testResult.error
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
