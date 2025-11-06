import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Database, 
  Zap, 
  Users, 
  BarChart3,
  Plus,
  Settings as SettingsIcon,
  Calendar,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  GitBranch
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import CRMFieldMappingDialog from "./CRMFieldMappingDialog";

interface Integration {
  id: string;
  name: string;
  category: 'crm' | 'data_enrichment' | 'sales_engagement' | 'forecasting';
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  description: string;
  last_sync?: string;
  sync_status?: 'success' | 'error' | 'in_progress';
  records_synced?: number;
  config?: any;
  oauth_required: boolean;
}

const INTEGRATION_CATEGORIES = {
  crm: { label: 'CRM', icon: Database, color: 'bg-blue-500' },
  data_enrichment: { label: 'Data Enrichment', icon: Users, color: 'bg-green-500' },
  sales_engagement: { label: 'Sales Engagement', icon: Zap, color: 'bg-purple-500' },
  forecasting: { label: 'Forecasting', icon: BarChart3, color: 'bg-orange-500' }
};

const AVAILABLE_INTEGRATIONS: Integration[] = [
  // CRM
  { id: 'salesforce', name: 'Salesforce', category: 'crm', status: 'disconnected', description: 'Sync accounts, contacts, and opportunities', oauth_required: false },
  { id: 'hubspot', name: 'HubSpot', category: 'crm', status: 'disconnected', description: 'Complete CRM and marketing automation', oauth_required: true },
  
  // Data Enrichment
  { id: 'zoominfo', name: 'ZoomInfo', category: 'data_enrichment', status: 'connected', description: 'Contact and company data enrichment', oauth_required: false, last_sync: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), sync_status: 'success', records_synced: 342 },
  { id: 'apollo', name: 'Apollo', category: 'data_enrichment', status: 'error', description: 'B2B database and sales intelligence', oauth_required: false, last_sync: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), sync_status: 'error' },
  
  // Sales Engagement
  { id: 'outreach', name: 'Outreach', category: 'sales_engagement', status: 'disconnected', description: 'Sales engagement and sequence automation', oauth_required: true },
  { id: 'salesloft', name: 'SalesLoft', category: 'sales_engagement', status: 'disconnected', description: 'Sales engagement platform', oauth_required: true },
  { id: 'groove', name: 'Groove', category: 'sales_engagement', status: 'disconnected', description: 'Sales engagement for Salesforce', oauth_required: true },
  
  // Forecasting
  { id: 'gong', name: 'Gong', category: 'forecasting', status: 'disconnected', description: 'Revenue intelligence and conversation analytics', oauth_required: true },
  { id: 'clari', name: 'Clari', category: 'forecasting', status: 'disconnected', description: 'Revenue platform and forecasting', oauth_required: true }
];

export default function IntegrationManager() {
  const [integrations, setIntegrations] = useState<Integration[]>(AVAILABLE_INTEGRATIONS);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isFieldMappingOpen, setIsFieldMappingOpen] = useState(false);
  const [credentials, setCredentials] = useState({
    instanceUrl: '',
    username: '',
    password: '',
    securityToken: ''
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();
  const { userProfile } = useAuth();

  const getStatusBadge = (status: Integration['status']) => {
    const variants = {
      connected: { variant: 'default' as const, label: 'Connected', color: 'text-green-600' },
      disconnected: { variant: 'secondary' as const, label: 'Disconnected', color: 'text-gray-500' },
      error: { variant: 'destructive' as const, label: 'Error', color: 'text-red-600' },
      syncing: { variant: 'outline' as const, label: 'Syncing...', color: 'text-blue-600' }
    };
    const config = variants[status];
    return <Badge variant={config.variant} className={config.color}>{config.label}</Badge>;
  };

  const getSyncStatusIcon = (syncStatus?: string) => {
    switch (syncStatus) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'in_progress': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const handleConnect = (integration: Integration) => {
    setSelectedIntegration(integration);
    setIsConfiguring(true);
  };

  const handleDisconnect = (integration: Integration) => {
    setIntegrations(prev => prev.map(i => 
      i.id === integration.id 
        ? { ...i, status: 'disconnected', last_sync: undefined, sync_status: undefined }
        : i
    ));
    toast({ title: "Disconnected", description: `Disconnected from ${integration.name}` });
  };

  const handleSync = async (integration: Integration) => {
    if (!userProfile?.org_id) {
      toast({ 
        title: "Error", 
        description: "Organization not found",
        variant: "destructive"
      });
      return;
    }

    setIntegrations(prev => prev.map(i => 
      i.id === integration.id 
        ? { ...i, status: 'syncing', sync_status: 'in_progress' }
        : i
    ));

    try {
      // Call integration service to trigger sync
      const { data, error } = await supabase.functions.invoke('integration-service', {
        body: {
          action: 'sync',
          org_id: userProfile.org_id,
          provider: integration.id,
        },
      });

      if (error) throw error;

      setIntegrations(prev => prev.map(i => 
        i.id === integration.id 
          ? { 
              ...i, 
              status: 'connected', 
              sync_status: 'success',
              last_sync: new Date().toISOString(),
              records_synced: data?.stats?.total_processed || 0
            }
          : i
      ));
      
      toast({ 
        title: "Sync Complete", 
        description: `${integration.name}: ${data?.stats?.total_processed || 0} records synced`
      });
    } catch (error: any) {
      console.error('Sync error:', error);
      setIntegrations(prev => prev.map(i => 
        i.id === integration.id 
          ? { ...i, status: 'error', sync_status: 'error' }
          : i
      ));
      toast({ 
        title: "Sync Failed", 
        description: error.message || "Failed to sync data",
        variant: "destructive"
      });
    }
  };

  const handleTestConnection = async () => {
    if (!credentials.instanceUrl || !credentials.username || !credentials.password || !credentials.securityToken) {
      setTestResult({ 
        success: false, 
        message: "Please fill in all required fields" 
      });
      return;
    }

    if (!userProfile?.org_id) {
      setTestResult({ 
        success: false, 
        message: "Organization not found" 
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('integration-service', {
        body: {
          action: 'test',
          org_id: userProfile.org_id,
          provider_name: 'salesforce',
          salesforce_credentials: {
            username: credentials.username,
            password: credentials.password,
            securityToken: credentials.securityToken,
            instanceUrl: credentials.instanceUrl,
          },
        },
      });

      if (error) throw error;

      if (data?.success) {
        setTestResult({ 
          success: true, 
          message: "Connection successful! You can now save your configuration." 
        });
      } else {
        throw new Error(data?.message || "Connection test failed");
      }
    } catch (error: any) {
      console.error('Test connection error:', error);
      setTestResult({ 
        success: false, 
        message: error.message || "Failed to connect to Salesforce. Please check your credentials." 
      });
    } finally {
      setIsTesting(false);
    }
  };

  const groupedIntegrations = integrations.reduce((acc, integration) => {
    if (!acc[integration.category]) {
      acc[integration.category] = [];
    }
    acc[integration.category].push(integration);
    return acc;
  }, {} as Record<string, Integration[]>);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="crm" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {Object.entries(INTEGRATION_CATEGORIES).map(([key, category]) => {
            const Icon = category.icon;
            return (
              <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {category.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {Object.entries(INTEGRATION_CATEGORIES).map(([categoryKey, category]) => (
          <TabsContent key={categoryKey} value={categoryKey} className="space-y-4">
            <div className="grid gap-4">
              {groupedIntegrations[categoryKey as keyof typeof groupedIntegrations]?.map((integration) => {
                const Icon = category.icon;
                return (
                  <Card key={integration.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 ${category.color} rounded-lg flex items-center justify-center`}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold">{integration.name}</h4>
                              {getStatusBadge(integration.status)}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{integration.description}</p>
                            
                            {integration.last_sync && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {getSyncStatusIcon(integration.sync_status)}
                                <span>Last sync: {new Date(integration.last_sync).toLocaleString()}</span>
                                {integration.records_synced && (
                                  <span>• {integration.records_synced} records</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          {integration.status === 'connected' ? (
                            <>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleSync(integration)}
                              >
                               <RefreshCw className="h-4 w-4 mr-2" />
                                Sync
                              </Button>
                              {(integration.id === 'salesforce' || integration.id === 'hubspot') && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedIntegration(integration);
                                    setIsFieldMappingOpen(true);
                                  }}
                                >
                                  <GitBranch className="h-4 w-4 mr-2" />
                                  Field Mapping
                                </Button>
                              )}
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedIntegration(integration);
                                  setIsConfiguring(true);
                                }}
                              >
                                <SettingsIcon className="h-4 w-4 mr-2" />
                                Configure
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDisconnect(integration)}
                              >
                                Disconnect
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" onClick={() => handleConnect(integration)}>
                              Connect
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Configuration Dialog */}
      <Dialog open={isConfiguring} onOpenChange={setIsConfiguring}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure {selectedIntegration?.name}</DialogTitle>
            <DialogDescription>
              Set up connection parameters and sync preferences
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedIntegration?.oauth_required ? (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">This integration requires OAuth authentication. Click connect to authorize access.</p>
              </div>
            ) : selectedIntegration?.id === 'salesforce' ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Salesforce Instance URL</label>
                  <Input 
                    placeholder="https://yourinstance.salesforce.com" 
                    value={credentials.instanceUrl}
                    onChange={(e) => {
                      setCredentials({...credentials, instanceUrl: e.target.value});
                      setTestResult(null);
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Your Salesforce domain (e.g., na1.salesforce.com or mycompany.my.salesforce.com)</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Username</label>
                  <Input 
                    placeholder="user@company.com" 
                    value={credentials.username}
                    onChange={(e) => {
                      setCredentials({...credentials, username: e.target.value});
                      setTestResult(null);
                    }}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Password</label>
                  <Input 
                    type="password" 
                    placeholder="Your Salesforce password" 
                    value={credentials.password}
                    onChange={(e) => {
                      setCredentials({...credentials, password: e.target.value});
                      setTestResult(null);
                    }}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Security Token</label>
                  <Input 
                    type="password" 
                    placeholder="Your Salesforce security token" 
                    value={credentials.securityToken}
                    onChange={(e) => {
                      setCredentials({...credentials, securityToken: e.target.value});
                      setTestResult(null);
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Get your token: Setup → Personal Setup → Reset My Security Token
                  </p>
                </div>

                {/* Test Connection Button and Result */}
                <div className="space-y-2">
                  <Button 
                    type="button"
                    variant="outline" 
                    className="w-full"
                    onClick={handleTestConnection}
                    disabled={isTesting || !credentials.instanceUrl || !credentials.username || !credentials.password || !credentials.securityToken}
                  >
                    {isTesting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Testing Connection...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Test Connection
                      </>
                    )}
                  </Button>
                  
                  {testResult && (
                    <div className={`p-3 rounded-lg border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-start gap-2">
                        {testResult.success ? (
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                        )}
                        <p className={`text-sm ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                          {testResult.message}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">API Key</label>
                  <Input placeholder="Enter your API key" type="password" />
                </div>
              </div>
            )}

            {/* Sync Frequency Configuration (for all CRMs) */}
            {(selectedIntegration?.id === 'salesforce' || selectedIntegration?.id === 'hubspot') && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div>
                  <label className="text-sm font-medium">Auto-Sync Frequency</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Configure how often data should automatically sync from {selectedIntegration.name}
                  </p>
                  <select 
                    className="w-full p-2 border rounded-md"
                    value={selectedIntegration?.config?.sync_frequency || 'manual'}
                    onChange={(e) => {
                      if (selectedIntegration) {
                        setIntegrations(prev => prev.map(i => 
                          i.id === selectedIntegration.id 
                            ? { 
                                ...i, 
                                config: { 
                                  ...i.config, 
                                  sync_frequency: e.target.value 
                                } 
                              }
                            : i
                        ));
                        setSelectedIntegration({
                          ...selectedIntegration,
                          config: {
                            ...selectedIntegration.config,
                            sync_frequency: e.target.value
                          }
                        });
                      }
                    }}
                  >
                    <option value="manual">Manual only (no auto-sync)</option>
                    <option value="hourly">Every hour</option>
                    <option value="daily">Daily at 2 AM</option>
                    <option value="weekly">Weekly (Monday at 2 AM)</option>
                  </select>
                </div>
                {selectedIntegration?.config?.last_scheduled_sync && (
                  <div className="text-xs text-muted-foreground">
                    Last auto-sync: {new Date(selectedIntegration.config.last_scheduled_sync).toLocaleString()}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsConfiguring(false);
              setTestResult(null);
              setCredentials({
                instanceUrl: '',
                username: '',
                password: '',
                securityToken: ''
              });
            }}>
              Cancel
            </Button>
            <Button 
              disabled={selectedIntegration?.id === 'salesforce' && (!testResult || !testResult.success)}
              onClick={async () => {
              if (selectedIntegration?.oauth_required) {
                // Handle OAuth flow for HubSpot and other OAuth integrations
                if (!userProfile?.org_id) {
                  toast({ 
                    title: "Error", 
                    description: "Organization not found",
                    variant: "destructive"
                  });
                  return;
                }

                try {
                  // Initiate OAuth flow
                  const { data, error } = await supabase.functions.invoke('oauth-initiate', {
                    body: {
                      provider: selectedIntegration.id,
                      org_id: userProfile.org_id,
                      redirect_url: `${window.location.origin}/settings?tab=integrations`
                    }
                  });

                  if (error) throw error;

                  // Redirect to OAuth provider
                  if (data?.authUrl) {
                    window.location.href = data.authUrl;
                  }
                } catch (error: any) {
                  console.error('OAuth initiation error:', error);
                  toast({ 
                    title: "Connection Failed", 
                    description: error.message || "Failed to initiate OAuth flow",
                    variant: "destructive"
                  });
                }
              } else if (selectedIntegration?.id === 'salesforce') {
                if (!credentials.instanceUrl || !credentials.username || !credentials.password || !credentials.securityToken) {
                  toast({ 
                    title: "Missing credentials", 
                    description: "Please fill in all required fields",
                    variant: "destructive"
                  });
                  return;
                }

                if (!userProfile?.org_id) {
                  toast({ 
                    title: "Error", 
                    description: "Organization not found",
                    variant: "destructive"
                  });
                  return;
                } else {
                  // For OAuth integrations, just update the config
                  if (!userProfile?.org_id || !selectedIntegration?.config?.integration_config_id) {
                    toast({ 
                      title: "Error", 
                      description: "Missing configuration",
                      variant: "destructive"
                    });
                    return;
                  }

                  try {
                    // Get current config
                    const { data: currentConfig, error: fetchError } = await supabase
                      .from('integration_configs')
                      .select('config')
                      .eq('id', selectedIntegration.config.integration_config_id)
                      .single();

                    if (fetchError) throw fetchError;

                    const existingConfig = (currentConfig?.config as any) || {};
                    const updatedConfig = {
                      ...existingConfig,
                      sync_frequency: selectedIntegration.config?.sync_frequency || 'manual'
                    };

                    const { error: updateError } = await supabase
                      .from('integration_configs')
                      .update({ config: updatedConfig as any })
                      .eq('id', selectedIntegration.config.integration_config_id);

                    if (updateError) throw updateError;

                    toast({ 
                      title: "Updated", 
                      description: `Sync frequency updated for ${selectedIntegration.name}` 
                    });
                  } catch (error: any) {
                    console.error('Update error:', error);
                    toast({ 
                      title: "Update Failed", 
                      description: error.message || "Failed to update configuration",
                      variant: "destructive"
                    });
                  }
                }

                try {
                  // Call integration service to connect
                  const { data, error } = await supabase.functions.invoke('integration-service', {
                    body: {
                      action: 'connect',
                      org_id: userProfile.org_id,
                      provider: 'salesforce',
                      integration_type: 'crm',
                      credentials: {
                        username: credentials.username,
                        password: credentials.password,
                        security_token: credentials.securityToken,
                        instance_url: credentials.instanceUrl,
                      },
                      sync_frequency: selectedIntegration.config?.sync_frequency || 'manual',
                    },
                  });

                  if (error) throw error;

                  setIntegrations(prev => prev.map(i => 
                    i.id === selectedIntegration.id 
                      ? { 
                          ...i, 
                          status: 'connected', 
                          last_sync: new Date().toISOString(), 
                          sync_status: 'success', 
                          config: { 
                            ...credentials, 
                            integration_config_id: data?.integration_id || data?.config_id,
                            sync_frequency: selectedIntegration.config?.sync_frequency || 'manual'
                          }
                        }
                      : i
                  ));
                  
                  toast({ 
                    title: "Connected", 
                    description: `Successfully connected to ${selectedIntegration.name}` 
                  });
                } catch (error: any) {
                  console.error('Connection error:', error);
                  toast({ 
                    title: "Connection Failed", 
                    description: error.message || "Failed to connect to Salesforce",
                    variant: "destructive"
                  });
                }
              }
              setIsConfiguring(false);
              setTestResult(null);
              setCredentials({
                instanceUrl: '',
                username: '',
                password: '',
                securityToken: ''
              });
            }}>
              {selectedIntegration?.id === 'salesforce' && (!testResult || !testResult.success) 
                ? 'Test Connection First' 
                : 'Save & Connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field Mapping Dialog */}
      {selectedIntegration && (selectedIntegration.id === 'salesforce' || selectedIntegration.id === 'hubspot') && (
        <CRMFieldMappingDialog
          open={isFieldMappingOpen}
          onOpenChange={setIsFieldMappingOpen}
          integrationId={selectedIntegration.config?.integration_config_id || ''}
          provider={selectedIntegration.id as 'salesforce' | 'hubspot'}
          orgId={userProfile?.org_id || ''}
        />
      )}
    </div>
  );
}