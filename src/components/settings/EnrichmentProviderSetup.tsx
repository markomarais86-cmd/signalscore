import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, CheckCircle2, XCircle, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface ProviderConfig {
  name: string;
  key: string;
  envVar: string;
  provider: string;
  status: 'configured' | 'missing' | 'testing';
  description: string;
  setupUrl: string;
}

export function EnrichmentProviderSetup() {
  const [configs, setConfigs] = useState<ProviderConfig[]>([
    {
      name: "People Data Labs (PDL)",
      key: "",
      envVar: "PDL_API_KEY",
      provider: "pdl",
      status: "missing",
      description: "Premium firmographic and contact data",
      setupUrl: "https://www.peopledatalabs.com/"
    },
    {
      name: "Clearbit (Premium)",
      key: "",
      envVar: "CLEARBIT_API_KEY",
      provider: "clearbit",
      status: "missing",
      description: "B2B data enrichment and intelligence",
      setupUrl: "https://clearbit.com/"
    }
  ]);
  
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const { toast } = useToast();
  const { userProfile } = useAuth();

  useEffect(() => {
    checkConfiguredProviders();
  }, [userProfile]);

  const checkConfiguredProviders = async () => {
    if (!userProfile?.org_id) {
      console.log('[EnrichmentProviderSetup] No org_id, skipping check');
      return;
    }

    console.log('[EnrichmentProviderSetup] Starting check for providers...');

    try {
      // Check each provider's secrets via edge function
      const results = await Promise.all(
        configs.map(async (config) => {
          console.log(`[EnrichmentProviderSetup] Checking ${config.provider}...`);
          
          const { data, error } = await supabase.functions.invoke('integration-service', {
            body: { action: 'check-secrets', provider: config.provider }
          });
          
          console.log(`[EnrichmentProviderSetup] Response for ${config.provider}:`, { 
            data, 
            error,
            configured: data?.configured 
          });
          
          if (error) {
            console.error(`[EnrichmentProviderSetup] Error for ${config.provider}:`, error);
          }
          
          return { provider: config.provider, configured: data?.configured || false };
        })
      );

      console.log('[EnrichmentProviderSetup] All results:', results);

      setConfigs(prev => {
        const updated = prev.map(config => {
          const result = results.find(r => r.provider === config.provider);
          const newStatus = result?.configured ? 'configured' as const : 'missing' as const;
          console.log(`[EnrichmentProviderSetup] Updating ${config.provider} from ${config.status} to ${newStatus}`);
          return {
            ...config,
            status: newStatus
          };
        });
        console.log('[EnrichmentProviderSetup] Updated configs:', updated);
        return updated;
      });
      
      console.log('[EnrichmentProviderSetup] State update complete');
    } catch (error) {
      console.error('[EnrichmentProviderSetup] Error checking providers:', error);
    }
  };

  const handleTest = async (provider: string) => {
    const config = configs.find(c => c.provider === provider);
    if (!config?.key) return;

    setTestingProvider(provider);
    
    try {
      const { data, error } = await supabase.functions.invoke('integration-service', {
        body: { 
          action: 'test',
          provider_name: provider,
          api_key: config.key
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Connection Successful",
          description: data.message || `${config.name} is configured correctly`,
        });
        // Update status to configured
        setConfigs(prev => prev.map(c => 
          c.provider === provider ? { ...c, status: 'configured' as const } : c
        ));
      } else {
        toast({
          title: "Connection Failed",
          description: data?.message || "API key is invalid or account has issues",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Test error:', error);
      toast({
        title: "Test Failed",
        description: error.message || "Failed to test connection",
        variant: "destructive",
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const toggleShowKey = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const updateKey = (provider: string, value: string) => {
    setConfigs(prev => prev.map(config => 
      config.provider === provider ? { ...config, key: value } : config
    ));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'configured':
        return <Badge className="bg-executive-green text-white"><CheckCircle2 className="h-3 w-3 mr-1" />Configured</Badge>;
      case 'testing':
        return <Badge className="bg-blue-500 text-white"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Testing</Badge>;
      default:
        return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Not Configured</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {configs.map((config) => (
        <Card key={config.provider}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{config.name}</CardTitle>
                <CardDescription>{config.description}</CardDescription>
              </div>
              {getStatusBadge(testingProvider === config.provider ? 'testing' : config.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${config.provider}-key`}>API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id={`${config.provider}-key`}
                    type={showKeys[config.provider] ? "text" : "password"}
                    value={config.key}
                    onChange={(e) => updateKey(config.provider, e.target.value)}
                    placeholder={`Enter ${config.name} API key`}
                    className="pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => toggleShowKey(config.provider)}
                  >
                    {showKeys[config.provider] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button 
                  onClick={() => handleTest(config.provider)}
                  disabled={!config.key || testingProvider === config.provider}
                  variant="outline"
                >
                  {testingProvider === config.provider ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Test"
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This key must be added to Supabase Secrets as <code className="bg-muted px-1 py-0.5 rounded">{config.envVar}</code>
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <a 
                href={config.setupUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Get API key from {config.name}
              </a>
            </div>

            <div className="pt-2 border-t space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  <strong>Setup Instructions:</strong> After obtaining your API key, add it to your Supabase project's secrets via the Supabase Dashboard → Project Settings → Edge Functions → Manage Secrets. Use the exact environment variable name: <code className="bg-muted px-1 py-0.5 rounded">{config.envVar}</code>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={checkConfiguredProviders}
                className="w-full"
              >
                Refresh Status
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
