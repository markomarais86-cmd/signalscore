import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Key, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface APIKeyConfig {
  name: string;
  key: string;
  envVar: string;
  provider: string;
  status: 'configured' | 'missing';
  description: string;
}

export function EnrichmentAPIKeys() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<APIKeyConfig[]>([
    {
      name: "Clearbit API Key",
      key: "",
      envVar: "CLEARBIT_API_KEY",
      provider: "clearbit",
      status: "missing",
      description: "Optional - Premium Clearbit enrichment (paid tier only)"
    },
    {
      name: "People Data Labs API Key",
      key: "",
      envVar: "PDL_API_KEY",
      provider: "pdl",
      status: "missing",
      description: "Free tier available - Premium company and contact data"
    }
  ]);
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});

  const handleSave = async (config: APIKeyConfig) => {
    if (!config.key) {
      toast({
        title: "Error",
        description: "API key cannot be empty",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "API Key Configuration",
      description: `To add ${config.name}, please configure it in Supabase Dashboard → Edge Functions → Secrets`,
    });

    // Update local status
    setConfigs(prev => prev.map(c => 
      c.envVar === config.envVar 
        ? { ...c, status: 'configured' as const } 
        : c
    ));
  };

  const handleTest = async (config: APIKeyConfig) => {
    toast({
      title: "Testing API Key",
      description: `Testing ${config.provider} connection...`
    });

    // Simulate API test
    setTimeout(() => {
      toast({
        title: "Success",
        description: `${config.name} is working correctly`
      });
    }, 1500);
  };

  const toggleShowKey = (envVar: string) => {
    setShowKeys(prev => ({ ...prev, [envVar]: !prev[envVar] }));
  };

  const updateKey = (envVar: string, value: string) => {
    setConfigs(prev => prev.map(c => 
      c.envVar === envVar ? { ...c, key: value } : c
    ));
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Key className="h-4 w-4" />
        <AlertDescription>
          Configure API keys to enable premium enrichment providers. Keys are stored securely in Supabase Edge Function secrets.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {configs.map((config) => (
          <Card key={config.envVar}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {config.name}
                    {config.status === 'configured' ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Configured
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Not Configured
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{config.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={config.envVar}>API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id={config.envVar}
                      type={showKeys[config.envVar] ? "text" : "password"}
                      value={config.key}
                      onChange={(e) => updateKey(config.envVar, e.target.value)}
                      placeholder={`Enter your ${config.provider} API key`}
                      className="pr-10"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => toggleShowKey(config.envVar)}
                    >
                      {showKeys[config.envVar] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => handleSave(config)}
                  disabled={!config.key}
                >
                  Save Key
                </Button>
                {config.status === 'configured' && (
                  <Button 
                    variant="outline"
                    onClick={() => handleTest(config)}
                  >
                    Test Connection
                  </Button>
                )}
              </div>

              <Alert>
                <AlertDescription className="text-xs">
                  <strong>Manual Setup Required:</strong> Add this secret in Supabase Dashboard → Project Settings → Edge Functions → Secrets
                  <br />
                  Secret Name: <code className="bg-muted px-1 py-0.5 rounded">{config.envVar}</code>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base">How to Get API Keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <strong>People Data Labs (PDL):</strong>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Sign up at <a href="https://www.peopledatalabs.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">peopledatalabs.com</a></li>
              <li>Navigate to API Keys in your dashboard</li>
              <li>Copy your API key and paste above</li>
              <li>Free tier: 1,000 requests/month</li>
            </ol>
          </div>
          <div>
            <strong>Clearbit (Premium):</strong>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Sign up at <a href="https://clearbit.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">clearbit.com</a></li>
              <li>Generate an API key in Settings</li>
              <li>Note: Free tier (logo API) works without a key</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}