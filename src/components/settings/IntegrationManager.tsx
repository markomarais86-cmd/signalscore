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
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  { id: 'salesforce', name: 'Salesforce', category: 'crm', status: 'connected', description: 'Sync accounts, contacts, and opportunities', oauth_required: true, last_sync: new Date(Date.now() - 30 * 60 * 1000).toISOString(), sync_status: 'success', records_synced: 1247 },
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
  const { toast } = useToast();

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
    if (integration.oauth_required) {
      // Simulate OAuth flow
      toast({ title: "Redirecting to OAuth", description: `Connecting to ${integration.name}...` });
      setTimeout(() => {
        setIntegrations(prev => prev.map(i => 
          i.id === integration.id 
            ? { ...i, status: 'connected', last_sync: new Date().toISOString(), sync_status: 'success' }
            : i
        ));
        toast({ title: "Connected", description: `Successfully connected to ${integration.name}` });
      }, 2000);
    } else {
      setSelectedIntegration(integration);
      setIsConfiguring(true);
    }
  };

  const handleDisconnect = (integration: Integration) => {
    setIntegrations(prev => prev.map(i => 
      i.id === integration.id 
        ? { ...i, status: 'disconnected', last_sync: undefined, sync_status: undefined }
        : i
    ));
    toast({ title: "Disconnected", description: `Disconnected from ${integration.name}` });
  };

  const handleSync = (integration: Integration) => {
    setIntegrations(prev => prev.map(i => 
      i.id === integration.id 
        ? { ...i, status: 'syncing', sync_status: 'in_progress' }
        : i
    ));
    
    setTimeout(() => {
      setIntegrations(prev => prev.map(i => 
        i.id === integration.id 
          ? { 
              ...i, 
              status: 'connected', 
              sync_status: 'success',
              last_sync: new Date().toISOString(),
              records_synced: Math.floor(Math.random() * 1000) + 100
            }
          : i
      ));
      toast({ title: "Sync Complete", description: `${integration.name} data synced successfully` });
    }, 3000);
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
                              disabled={integration.status === 'syncing'}
                            >
                              <RefreshCw className={`h-4 w-4 mr-2 ${integration.status === 'syncing' ? 'animate-spin' : ''}`} />
                                Sync
                              </Button>
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
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">API Key</label>
                  <Input placeholder="Enter your API key" type="password" />
                </div>
                <div>
                  <label className="text-sm font-medium">Sync Frequency</label>
                  <select className="w-full p-2 border rounded-md">
                    <option>Every 15 minutes</option>
                    <option>Every hour</option>
                    <option>Every 6 hours</option>
                    <option>Daily</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfiguring(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setIsConfiguring(false);
              if (selectedIntegration && !selectedIntegration.oauth_required) {
                handleConnect(selectedIntegration);
              }
            }}>
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}