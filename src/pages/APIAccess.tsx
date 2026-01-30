import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Key,
  Copy,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Code,
  BookOpen,
  Zap,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { LaunchPulseMark } from "@/components/BrandLogo";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
  scopes: string[] | null;
}

export default function APIAccess() {
  const { userProfile } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (userProfile?.org_id) {
      loadApiKeys();
    }
  }, [userProfile?.org_id]);

  const loadApiKeys = async () => {
    if (!userProfile?.org_id) return;
    
    try {
      const { data, error } = await supabase
        .from("api_keys")
        .select("id, name, key_prefix, created_at, last_used_at, is_active, scopes")
        .eq("org_id", userProfile.org_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (err) {
      console.error("Error loading API keys:", err);
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async () => {
    if (!userProfile?.org_id || !newKeyName.trim()) return;

    try {
      setCreating(true);
      
      const { data, error } = await supabase.functions.invoke("generate-api-key", {
        body: { name: newKeyName.trim() }
      });

      if (error) throw error;

      setNewKey(data.api_key);
      setNewKeyName("");
      await loadApiKeys();
      toast.success("API key created!");
    } catch (err) {
      console.error("Error creating API key:", err);
      toast.error("Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const revokeApiKey = async (id: string) => {
    try {
      const { error } = await supabase
        .from("api_keys")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;

      await loadApiKeys();
      toast.success("API key revoked");
    } catch (err) {
      console.error("Error revoking API key:", err);
      toast.error("Failed to revoke API key");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const baseUrl = `${window.location.protocol}//${window.location.host}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <LaunchPulseMark className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">API Access</h1>
          <p className="text-muted-foreground">
            Integrate enrichment into your applications
          </p>
        </div>
      </div>

      <Tabs defaultValue="keys" className="space-y-6">
        <TabsList>
          <TabsTrigger value="keys" className="gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="docs" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Documentation
          </TabsTrigger>
          <TabsTrigger value="examples" className="gap-2">
            <Code className="h-4 w-4" />
            Code Examples
          </TabsTrigger>
        </TabsList>

        {/* API Keys Tab */}
        <TabsContent value="keys" className="space-y-6">
          {/* New Key Alert */}
          {newKey && (
            <Alert className="border-green-500/30 bg-green-500/5">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium text-green-700">Your new API key:</p>
                  <code className="text-sm bg-background px-2 py-1 rounded border">
                    {showKey ? newKey : "•".repeat(32)}
                  </code>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => copyToClipboard(newKey)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setNewKey(null)}
                  >
                    Done
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Create New Key */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Create API Key</CardTitle>
              <CardDescription>
                Generate a new key to access the enrichment API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Key name (e.g., Production, Development)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createApiKey()}
                />
                <Button onClick={createApiKey} disabled={creating || !newKeyName.trim()}>
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Create Key
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Existing Keys */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your API Keys</CardTitle>
              <CardDescription>
                Manage your existing API keys
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Key className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No API keys yet. Create one to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {apiKeys.map((key) => (
                    <div 
                      key={key.id} 
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        key.is_active ? "bg-background" : "bg-muted/50 opacity-60"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{key.name}</span>
                          {key.is_active ? (
                            <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Revoked</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <code>{key.key_prefix}•••••••</code>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Created {new Date(key.created_at).toLocaleDateString()}
                          </span>
                          {key.last_used_at && (
                            <span>Last used {new Date(key.last_used_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      {key.is_active && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => revokeApiKey(key.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documentation Tab */}
        <TabsContent value="docs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Quick Start
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>The Launch Pulse API allows you to enrich company data programmatically.</p>
              
              <div className="space-y-2">
                <h4 className="font-medium">Base URL</h4>
                <code className="block p-3 rounded-lg bg-muted text-sm">
                  https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1
                </code>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Authentication</h4>
                <p className="text-sm text-muted-foreground">
                  Include your API key in the Authorization header:
                </p>
                <code className="block p-3 rounded-lg bg-muted text-sm">
                  Authorization: Bearer YOUR_API_KEY
                </code>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Endpoints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Single Company Enrich */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500/10 text-green-600">POST</Badge>
                  <code className="text-sm">/enrich-unified</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Unified enrichment endpoint for companies and contacts.
                </p>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Request Body:</p>
                  <pre className="p-3 rounded-lg bg-muted text-xs overflow-x-auto">
{`{
  "org_id": "your-org-id",
  "record_type": "account",  // or "lead"
  "records": [
    { "external_id": "abc123", "name": "Stripe", "domain": "stripe.com" }
  ],
  "config": {
    "aggregateProviders": true
  }
}`}
                  </pre>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Response:</p>
                  <pre className="p-3 rounded-lg bg-muted text-xs overflow-x-auto">
{`{
  "success": true,
  "job_id": "job-uuid",
  "summary": {
    "total": 1,
    "enriched": 1,
    "failed": 0
  }
}`}
                  </pre>
                </div>
              </div>

              <Separator />

              {/* Search Companies */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500/10 text-green-600">POST</Badge>
                  <code className="text-sm">/search-apollo-by-icp</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Search for companies matching your ICP criteria.
                </p>
              </div>

              <Separator />

              {/* Bulk Enrich */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500/10 text-green-600">POST</Badge>
                  <code className="text-sm">/enrich-unified</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Bulk enrichment - pass multiple records in the records array.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Rate Limits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border">
                  <p className="text-2xl font-bold">100</p>
                  <p className="text-sm text-muted-foreground">Requests per minute</p>
                </div>
                <div className="p-4 rounded-lg border">
                  <p className="text-2xl font-bold">10,000</p>
                  <p className="text-sm text-muted-foreground">Requests per day</p>
                </div>
                <div className="p-4 rounded-lg border">
                  <p className="text-2xl font-bold">Unlimited</p>
                  <p className="text-sm text-muted-foreground">AI enrichment calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Code Examples Tab */}
        <TabsContent value="examples" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">JavaScript / TypeScript</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="p-4 rounded-lg bg-muted text-sm overflow-x-auto">
{`// Enrich accounts using unified API
const response = await fetch(
  'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/enrich-unified',
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      org_id: 'your-org-id',
      record_type: 'account',
      records: [{ external_id: 'abc123', domain: 'stripe.com' }],
      config: { aggregateProviders: true }
    }),
  }
);

const data = await response.json();
console.log(data.summary);
// { total: 1, enriched: 1, failed: 0 }`}
              </pre>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => copyToClipboard(`const response = await fetch(
  'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/enrich-unified',
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      org_id: 'your-org-id',
      record_type: 'account',
      records: [{ external_id: 'abc123', domain: 'stripe.com' }],
      config: { aggregateProviders: true }
    }),
  }
);

const data = await response.json();
console.log(data.summary);`)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Code
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Python</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="p-4 rounded-lg bg-muted text-sm overflow-x-auto">
{`import requests

response = requests.post(
    'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/enrich-unified',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json',
    },
    json={
        'org_id': 'your-org-id',
        'record_type': 'account',
        'records': [{'external_id': 'abc123', 'domain': 'stripe.com'}],
        'config': {'aggregateProviders': True}
    }
)

data = response.json()
print(data['summary'])`}
              </pre>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => copyToClipboard(`import requests

response = requests.post(
    'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/enrich-unified',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json',
    },
    json={
        'org_id': 'your-org-id',
        'record_type': 'account',
        'records': [{'external_id': 'abc123', 'domain': 'stripe.com'}],
        'config': {'aggregateProviders': True}
    }
)

data = response.json()
print(data['summary'])`)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Code
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">cURL</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="p-4 rounded-lg bg-muted text-sm overflow-x-auto">
{`curl -X POST \\
  'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/enrich-unified' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{"org_id":"your-org-id","record_type":"account","records":[{"external_id":"abc123","domain":"stripe.com"}],"config":{"aggregateProviders":true}}'`}
              </pre>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => copyToClipboard(`curl -X POST \\
  'https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/enrich-unified' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{"org_id":"your-org-id","record_type":"account","records":[{"external_id":"abc123","domain":"stripe.com"}],"config":{"aggregateProviders":true}}'`)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Code
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
