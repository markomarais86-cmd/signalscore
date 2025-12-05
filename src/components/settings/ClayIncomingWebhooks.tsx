import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Database, Copy, Check, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { LoadingState } from "@/components/LoadingState";
import { ClayFieldMapping } from "./ClayFieldMapping";

interface WebhookLog {
  id: string;
  webhook_type: string;
  processed: boolean;
  error: string | null;
  created_at: string;
  payload: any;
}

interface WebhookConfig {
  webhook_type: string;
  is_enabled: boolean;
}

const WEBHOOK_TYPES = [
  { value: 'clay_company_data', label: 'Company Data', description: 'Sync company/account information from Clay' },
  { value: 'clay_contact_data', label: 'Contact Data', description: 'Sync contact/lead information from Clay' },
  { value: 'clay_enrichment_data', label: 'Enrichment Data', description: 'Update existing accounts with enrichment data' },
];

// Default field mappings to save when enabling webhooks
const DEFAULT_FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  clay_company_data: {
    domain: 'domain',
    company_name: 'name',
    industry: 'industry_raw',
    employee_count: 'employee_count',
    revenue: 'revenue_range',
    location: 'country',
    technologies: 'tech_stack'
  },
  clay_contact_data: {
    email: 'email',
    first_name: 'first_name',
    last_name: 'last_name',
    title: 'title',
    company_domain: 'company',
    linkedin_url: 'linkedin_url',
    phone: 'phone',
    location: 'country'
  },
  clay_enrichment_data: {
    employee_count: 'employee_count',
    revenue: 'revenue_range',
    industry: 'industry_raw',
    technologies: 'tech_stack',
    funding_round: 'last_funding_round',
    total_funding: 'total_raised_usd'
  }
};

export function ClayIncomingWebhooks() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [configs, setConfigs] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const webhookUrl = `https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/clay-webhook-receiver`;

  useEffect(() => {
    if (userProfile?.org_id) {
      loadData();
    }
  }, [userProfile?.org_id]);

  const loadData = async () => {
    if (!userProfile?.org_id) return;

    setLoading(true);
    try {
      // Load configs
      const { data: configData, error: configError } = await supabase
        .from('clay_webhook_config')
        .select('webhook_type, is_enabled')
        .eq('org_id', userProfile.org_id);

      if (configError) throw configError;
      setConfigs(configData || []);

      // Load recent logs
      const { data: logData, error: logError } = await supabase
        .from('clay_webhook_logs')
        .select('id, webhook_type, processed, error, created_at, payload')
        .eq('org_id', userProfile.org_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (logError) throw logError;
      setLogs(logData || []);
    } catch (error) {
      console.error('Error loading webhook data:', error);
      toast({
        title: "Error",
        description: "Failed to load webhook configuration",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWebhook = async (webhookType: string, enabled: boolean) => {
    if (!userProfile?.org_id) return;

    try {
      // Use default mappings for this webhook type instead of empty object
      const defaultMappings = DEFAULT_FIELD_MAPPINGS[webhookType] || {};
      
      const { error } = await supabase
        .from('clay_webhook_config')
        .upsert({
          org_id: userProfile.org_id,
          webhook_type: webhookType,
          is_enabled: enabled,
          field_mappings: defaultMappings
        }, {
          onConflict: 'org_id,webhook_type'
        });

      if (error) throw error;

      setConfigs(prev => {
        const existing = prev.find(c => c.webhook_type === webhookType);
        if (existing) {
          return prev.map(c => c.webhook_type === webhookType ? { ...c, is_enabled: enabled } : c);
        } else {
          return [...prev, { webhook_type: webhookType, is_enabled: enabled }];
        }
      });

      toast({
        title: "Success",
        description: `Webhook ${enabled ? 'enabled' : 'disabled'}`
      });
    } catch (error) {
      console.error('Error toggling webhook:', error);
      toast({
        title: "Error",
        description: "Failed to update webhook",
        variant: "destructive"
      });
    }
  };

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied",
      description: "Webhook URL copied to clipboard"
    });
  };

  if (loading) {
    return <LoadingState message="Loading webhook configuration..." />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <CardTitle>Clay Incoming Webhooks</CardTitle>
          </div>
          <CardDescription>
            Receive and process data from Clay via Zapier webhooks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Webhook URL */}
          <div className="space-y-2">
            <Label>Your Webhook URL</Label>
            <div className="flex gap-2">
              <div className="flex-1 p-3 bg-muted rounded-md font-mono text-sm break-all">
                {webhookUrl}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyUrl}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use this URL in your Zapier webhook action. Include your org_id: <code className="bg-muted px-1 py-0.5 rounded">{userProfile?.org_id}</code>
            </p>
          </div>

          {/* Webhook Types */}
          <div className="space-y-3">
            <Label>Webhook Types</Label>
            {WEBHOOK_TYPES.map((type) => {
              const config = configs.find(c => c.webhook_type === type.value);
              const isEnabled = config?.is_enabled ?? false;

              return (
                <div key={type.value} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{type.label}</h4>
                        <Badge variant={isEnabled ? "default" : "outline"}>
                          {isEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => handleToggleWebhook(type.value, checked)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Setup Instructions */}
          <div className="border-t pt-4">
            <Button variant="outline" className="w-full" asChild>
              <a href="/CLAY_INTEGRATION_SETUP.md" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Setup Instructions
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Field Mapping */}
      <ClayFieldMapping />

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Webhook Activity</CardTitle>
          <CardDescription>
            Last 10 incoming webhooks
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No webhook activity yet
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const type = WEBHOOK_TYPES.find(t => t.value === log.webhook_type);
                const result = log.payload?.result;

                return (
                  <div key={log.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={log.processed ? "default" : log.error ? "destructive" : "secondary"}>
                          {log.processed ? 'Processed' : log.error ? 'Error' : 'Pending'}
                        </Badge>
                        <span className="text-sm font-medium">{type?.label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    
                    {result && (
                      <p className="text-xs text-muted-foreground">
                        Action: {result.action} | ID: {result.account_id || result.lead_id}
                      </p>
                    )}
                    
                    {log.error && (
                      <p className="text-xs text-destructive">
                        Error: {log.error}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
