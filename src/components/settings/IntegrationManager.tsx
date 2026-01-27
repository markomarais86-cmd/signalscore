import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toastError } from "@/lib/friendly-errors";
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
import { SalesforceSetupWizard } from "./SalesforceSetupWizard";
import { HubSpotSetupWizard } from "./HubSpotSetupWizard";

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
  
  // Data Enrichment - all start as disconnected, real status loaded from DB
  { id: 'zoominfo', name: 'ZoomInfo', category: 'data_enrichment', status: 'disconnected', description: 'Contact and company data enrichment', oauth_required: false },
  { id: 'apollo', name: 'Apollo', category: 'data_enrichment', status: 'disconnected', description: 'B2B database and sales intelligence', oauth_required: false },
  { id: 'clearbit', name: 'Clearbit', category: 'data_enrichment', status: 'disconnected', description: 'Company and contact enrichment', oauth_required: false },
  { id: 'pdl', name: 'People Data Labs', category: 'data_enrichment', status: 'disconnected', description: 'Person and company data API', oauth_required: false },
  
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

  // Load integration statuses from database on mount
  useEffect(() => {
    const loadIntegrationStatuses = async () => {
      if (!userProfile?.org_id) return;

      try {
        const { data, error } = await supabase.functions.invoke('integration-service', {
          body: {
            action: 'list',
            org_id: userProfile.org_id,
          },
        });

        if (error) throw error;

        if (data?.integrations) {
          // Merge database statuses with AVAILABLE_INTEGRATIONS
          const updatedIntegrations = AVAILABLE_INTEGRATIONS.map(integration => {
            const dbIntegration = data.integrations.find(
              (db: any) => db.provider_name === integration.id
            );

            if (dbIntegration) {
              return {
                ...integration,
                status: (dbIntegration.status === 'active' ? 'connected' : 'disconnected') as Integration['status'],
                last_sync: dbIntegration.last_sync_at,
                sync_status: dbIntegration.last_sync_status,
                config: dbIntegration
              };
            }

            return integration;
          });

          setIntegrations(updatedIntegrations);
        }
      } catch (error) {
        console.error('Failed to load integration statuses:', error);
      }
    };

    loadIntegrationStatuses();
  }, [userProfile?.org_id]);

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
      // Phase 1 Fix: Call appropriate sync function based on provider
      let syncFunctionName = 'integration-service';
      let syncBody: any = {
        action: 'sync',
        org_id: userProfile.org_id,
        provider: integration.id,
      };

      if (integration.id === 'salesforce') {
        syncFunctionName = 'salesforce-sync';
        syncBody = { org_id: userProfile.org_id };
      } else if (integration.id === 'hubspot') {
        syncFunctionName = 'hubspot-sync';
        syncBody = { org_id: userProfile.org_id };
      }

      const { data, error } = await supabase.functions.invoke(syncFunctionName, {
        body: syncBody,
      });

      if (error) throw error;

      setIntegrations(prev => prev.map(i => 
        i.id === integration.id 
          ? { 
              ...i, 
              status: 'connected', 
              sync_status: 'success',
              last_sync: new Date().toISOString(),
              records_synced: data?.stats?.accounts || data?.stats?.total_processed || 0
            }
          : i
      ));
      
      toast({ 
        title: "Sync Complete", 
        description: `${integration.name}: ${data?.stats?.accounts || data?.stats?.total_processed || 0} records synced`
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
        description: toastError(error, "Failed to sync data"),
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure {selectedIntegration?.name}</DialogTitle>
            <DialogDescription>
              {selectedIntegration?.id === 'salesforce' || selectedIntegration?.id === 'hubspot'
                ? "Follow the steps below to connect your CRM"
                : "Set up connection parameters and sync preferences"}
            </DialogDescription>
          </DialogHeader>
          
          {/* Salesforce Setup Wizard */}
          {selectedIntegration?.id === 'salesforce' && (
            <SalesforceSetupWizard
              orgId={userProfile?.org_id || ''}
              onSuccess={() => {
                setIntegrations(prev => prev.map(i => 
                  i.id === 'salesforce' 
                    ? { ...i, status: 'connected', last_sync: new Date().toISOString(), sync_status: 'success' }
                    : i
                ));
                setIsConfiguring(false);
                toast({ title: "Connected", description: "Successfully connected to Salesforce" });
              }}
              onCancel={() => setIsConfiguring(false)}
              existingConfig={selectedIntegration?.config}
            />
          )}

          {/* HubSpot Setup Wizard */}
          {selectedIntegration?.id === 'hubspot' && (
            <HubSpotSetupWizard
              orgId={userProfile?.org_id || ''}
              onSuccess={() => {
                setIntegrations(prev => prev.map(i => 
                  i.id === 'hubspot' 
                    ? { ...i, status: 'connected', last_sync: new Date().toISOString(), sync_status: 'success' }
                    : i
                ));
                setIsConfiguring(false);
                toast({ title: "Connected", description: "Successfully connected to HubSpot" });
              }}
              onCancel={() => setIsConfiguring(false)}
              existingConfig={selectedIntegration?.config}
            />
          )}

          {/* Generic API Key form for other integrations */}
          {selectedIntegration && selectedIntegration.id !== 'salesforce' && selectedIntegration.id !== 'hubspot' && (
            <div className="space-y-4">
              {selectedIntegration.oauth_required ? (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm">This integration requires OAuth authentication. Click connect to authorize access.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">API Key</label>
                    <Input placeholder="Enter your API key" type="password" />
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsConfiguring(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={async () => {
                    if (selectedIntegration?.oauth_required) {
                      if (!userProfile?.org_id) {
                        toast({ 
                          title: "Error", 
                          description: "Organization not found",
                          variant: "destructive"
                        });
                        return;
                      }

                      try {
                        const { data, error } = await supabase.functions.invoke('oauth-initiate', {
                          body: {
                            provider: selectedIntegration.id,
                            org_id: userProfile.org_id,
                            redirect_url: `${window.location.origin}/settings?tab=integrations`
                          }
                        });

                        if (error) throw error;

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
                    }
                    setIsConfiguring(false);
                  }}
                >
                  {selectedIntegration?.oauth_required ? 'Connect' : 'Save'}
                </Button>
              </DialogFooter>
            </div>
          )}
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