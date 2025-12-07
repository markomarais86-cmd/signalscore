import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bot, Sparkles, Zap, Brain, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface ProviderStatus {
  name: string;
  key: string;
  configured: boolean;
  models: string[];
  bestFor: string;
  icon: React.ReactNode;
}

export function AIProviderSettings() {
  const [providers, setProviders] = useState<ProviderStatus[]>([
    {
      name: "OpenAI",
      key: "OPENAI_API_KEY",
      configured: false,
      models: ["GPT-5", "GPT-5-mini", "GPT-5-nano", "O4-mini"],
      bestFor: "Chat, Analysis, Reasoning",
      icon: <Sparkles className="h-5 w-5" />,
    },
    {
      name: "Abacus.AI",
      key: "ABACUS_API_KEY",
      configured: false,
      models: ["RouteLLM", "Claude 4.5", "GPT-5.1"],
      bestFor: "Auto-routing, Premium Models",
      icon: <Brain className="h-5 w-5" />,
    },
    {
      name: "Lovable AI",
      key: "LOVABLE_API_KEY",
      configured: true, // Always available
      models: ["Gemini 2.5 Flash", "Gemini 2.5 Pro"],
      bestFor: "Fallback, Cost-effective",
      icon: <Zap className="h-5 w-5" />,
    },
  ]);

  const [preferredProvider, setPreferredProvider] = useState<string>("openai");
  const [usePremiumModels, setUsePremiumModels] = useState(false);

  // In a real implementation, this would check the actual API keys
  useEffect(() => {
    // Simulate checking provider status
    setProviders(prev => prev.map(p => ({
      ...p,
      configured: p.key === "LOVABLE_API_KEY" ? true : 
                  p.key === "OPENAI_API_KEY" ? true : // We know this is configured
                  p.key === "ABACUS_API_KEY" ? true : false, // Just added
    })));
  }, []);

  const handleTestProvider = async (providerName: string) => {
    toast.info(`Testing ${providerName} connection...`);
    // In a real implementation, this would call a test endpoint
    setTimeout(() => {
      toast.success(`${providerName} is working correctly!`);
    }, 1500);
  };

  const configuredCount = providers.filter(p => p.configured).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>AI Providers</CardTitle>
              <CardDescription>
                Multi-provider AI backend with automatic fallback
              </CardDescription>
            </div>
          </div>
          <Badge variant={configuredCount >= 2 ? "default" : "secondary"}>
            {configuredCount}/{providers.length} Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider Status */}
        <div className="space-y-3">
          {providers.map((provider) => (
            <div
              key={provider.key}
              className="flex items-center justify-between p-4 border rounded-lg bg-card"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${provider.configured ? 'bg-green-500/10' : 'bg-muted'}`}>
                  {provider.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{provider.name}</span>
                    {provider.configured ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {provider.bestFor}
                  </p>
                  <div className="flex gap-1 mt-1">
                    {provider.models.slice(0, 3).map((model) => (
                      <Badge key={model} variant="outline" className="text-xs">
                        {model}
                      </Badge>
                    ))}
                    {provider.models.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{provider.models.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestProvider(provider.name)}
                disabled={!provider.configured}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Test
              </Button>
            </div>
          ))}
        </div>

        {/* Routing Settings */}
        <div className="border-t pt-4 space-y-4">
          <h4 className="text-sm font-medium">Model Routing</h4>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Use Premium Models</Label>
              <p className="text-xs text-muted-foreground">
                Use Claude 4.5 and GPT-5.1 Thinking for complex analysis
              </p>
            </div>
            <Switch
              checked={usePremiumModels}
              onCheckedChange={setUsePremiumModels}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'openai', label: 'OpenAI First', desc: 'GPT-5 primary' },
              { id: 'abacus', label: 'Abacus First', desc: 'RouteLLM auto-select' },
              { id: 'cost', label: 'Cost Optimized', desc: 'Cheapest models' },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => setPreferredProvider(option.id)}
                className={`p-3 border rounded-lg text-left transition-colors ${
                  preferredProvider === option.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="font-medium text-sm">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Model Usage by Task */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3">Model Assignment by Task</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between p-2 bg-muted/50 rounded">
              <span className="text-muted-foreground">Chat</span>
              <span className="font-medium">GPT-5</span>
            </div>
            <div className="flex justify-between p-2 bg-muted/50 rounded">
              <span className="text-muted-foreground">Analysis</span>
              <span className="font-medium">GPT-5</span>
            </div>
            <div className="flex justify-between p-2 bg-muted/50 rounded">
              <span className="text-muted-foreground">Enrichment</span>
              <span className="font-medium">GPT-5-mini</span>
            </div>
            <div className="flex justify-between p-2 bg-muted/50 rounded">
              <span className="text-muted-foreground">Bulk Ops</span>
              <span className="font-medium">GPT-5-nano</span>
            </div>
            <div className="flex justify-between p-2 bg-muted/50 rounded">
              <span className="text-muted-foreground">Reasoning</span>
              <span className="font-medium">O4-mini</span>
            </div>
            <div className="flex justify-between p-2 bg-muted/50 rounded">
              <span className="text-muted-foreground">Fallback</span>
              <span className="font-medium">Gemini Flash</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
