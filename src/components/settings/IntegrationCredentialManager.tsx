import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Provider {
  name: string;
  displayName: string;
  type: 'data_enrichment';
  description: string;
  docsUrl: string;
  testEndpoint?: string;
}

const PROVIDERS: Provider[] = [
  {
    name: 'zoominfo',
    displayName: 'ZoomInfo',
    type: 'data_enrichment',
    description: 'Access B2B contact and company data',
    docsUrl: 'https://api-docs.zoominfo.com/',
  },
  {
    name: 'apollo',
    displayName: 'Apollo.io',
    type: 'data_enrichment',
    description: 'Sales intelligence and engagement platform',
    docsUrl: 'https://apolloio.github.io/apollo-api-docs/',
  },
  {
    name: 'clearbit',
    displayName: 'Clearbit',
    type: 'data_enrichment',
    description: 'Real-time company and contact enrichment',
    docsUrl: 'https://clearbit.com/docs',
  },
  {
    name: 'peopledatalabs',
    displayName: 'People Data Labs',
    type: 'data_enrichment',
    description: 'Person and company data API',
    docsUrl: 'https://docs.peopledatalabs.com/',
  },
];

export function IntegrationCredentialManager() {
  const { toast } = useToast();
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<Record<string, 'success' | 'error' | null>>({});

  const handleTest = async (provider: Provider) => {
    const apiKey = credentials[provider.name];
    
    if (!apiKey) {
      toast({
        title: "API Key Required",
        description: "Please enter an API key before testing",
        variant: "destructive",
      });
      return;
    }

    setTesting(prev => ({ ...prev, [provider.name]: true }));

    try {
      const { data, error } = await supabase.functions.invoke('integration-service', {
        body: {
          action: 'test',
          provider_name: provider.name,
          api_key: apiKey,
        },
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };

      setStatus(prev => ({ ...prev, [provider.name]: result.success ? 'success' : 'error' }));

      toast({
        title: result.success ? "Connection Successful" : "Connection Failed",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    } catch (error) {
      console.error('Test error:', error);
      setStatus(prev => ({ ...prev, [provider.name]: 'error' }));
      toast({
        title: "Test Failed",
        description: error.message || "Failed to test connection",
        variant: "destructive",
      });
    } finally {
      setTesting(prev => ({ ...prev, [provider.name]: false }));
    }
  };

  const handleSave = async (provider: Provider) => {
    const apiKey = credentials[provider.name];
    
    if (!apiKey) {
      toast({
        title: "API Key Required",
        description: "Please enter an API key",
        variant: "destructive",
      });
      return;
    }

    setSaving(prev => ({ ...prev, [provider.name]: true }));

    try {
      const { error } = await supabase.functions.invoke('integration-service', {
        body: {
          action: 'connect',
          provider_name: provider.name,
          integration_type: provider.type,
          api_key: apiKey,
        },
      });

      if (error) throw error;

      toast({
        title: "API Key Saved",
        description: `${provider.displayName} has been configured successfully`,
      });

      // Clear the input after saving
      setCredentials(prev => ({ ...prev, [provider.name]: '' }));
      setStatus(prev => ({ ...prev, [provider.name]: 'success' }));
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save API key",
        variant: "destructive",
      });
    } finally {
      setSaving(prev => ({ ...prev, [provider.name]: false }));
    }
  };

  const toggleShowKey = (providerName: string) => {
    setShowKey(prev => ({ ...prev, [providerName]: !prev[providerName] }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Data Enrichment Providers</h3>
        <p className="text-sm text-muted-foreground">
          Configure API keys for data enrichment integrations. Your credentials are encrypted and stored securely.
        </p>
      </div>

      <div className="grid gap-6">
        {PROVIDERS.map((provider) => (
          <Card key={provider.name} className="p-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{provider.displayName}</h4>
                    {status[provider.name] === 'success' && (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    )}
                    {status[provider.name] === 'error' && (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                        <XCircle className="h-3 w-3 mr-1" />
                        Error
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {provider.description}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(provider.docsUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Docs
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${provider.name}-key`}>API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id={`${provider.name}-key`}
                      type={showKey[provider.name] ? "text" : "password"}
                      placeholder="Enter your API key"
                      value={credentials[provider.name] || ''}
                      onChange={(e) => setCredentials(prev => ({ 
                        ...prev, 
                        [provider.name]: e.target.value 
                      }))}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => toggleShowKey(provider.name)}
                    >
                      {showKey[provider.name] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleTest(provider)}
                    disabled={testing[provider.name] || !credentials[provider.name]}
                  >
                    {testing[provider.name] ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Testing
                      </>
                    ) : (
                      'Test'
                    )}
                  </Button>
                  <Button
                    onClick={() => handleSave(provider)}
                    disabled={saving[provider.name] || !credentials[provider.name]}
                  >
                    {saving[provider.name] ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving
                      </>
                    ) : (
                      'Save'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}