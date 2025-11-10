// Phase 4: External Database Integration
// Component for managing external data provider connections

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Database, Check, X, Loader2, UserCheck, Sparkles } from "lucide-react";

interface Provider {
  id: string;
  provider: string;
  api_key_configured: boolean;
  is_active: boolean;
  total_accounts: number;
  total_contacts: number;
  last_synced_at?: string;
}

const PROVIDERS = [
  { key: 'zoominfo', name: 'ZoomInfo', description: 'B2B contact and company information' },
  { key: 'apollo', name: 'Apollo.io', description: 'Sales intelligence and engagement platform' },
  { key: 'cognism', name: 'Cognism', description: 'Global B2B sales intelligence' },
];

export function ExternalDataProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [contactStats, setContactStats] = useState({ total: 0, enriched: 0, pending: 0 });
  const { toast } = useToast();
  const { userProfile } = useAuth();

  useEffect(() => {
    loadProviders();
    loadContactStats();
  }, [userProfile.org_id]);

  const loadContactStats = async () => {
    if (!userProfile.org_id) return;

    try {
      // Get total leads
      const { count: totalCount } = await supabase
        .from('Leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id);

      // Get enriched leads (have persona and not 'Unknown')
      const { count: enrichedCount } = await supabase
        .from('Leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .not('persona', 'is', null)
        .neq('persona', 'Unknown');

      setContactStats({
        total: totalCount || 0,
        enriched: enrichedCount || 0,
        pending: (totalCount || 0) - (enrichedCount || 0)
      });
    } catch (error) {
      console.error('Error loading contact stats:', error);
    }
  };

  const enrichContacts = async () => {
    if (!userProfile.org_id) return;
    setEnriching(true);

    try {
      toast({
        title: "Contact Enrichment Started",
        description: "Mapping job titles to personas...",
      });

      const { data, error } = await supabase.functions.invoke('enrich-contacts-persona', {
        body: { orgId: userProfile.org_id }
      });

      if (error) throw error;

      await loadContactStats();

      toast({
        title: "✓ Enrichment Complete!",
        description: `Enriched ${data.enriched} contacts with persona data`,
      });
    } catch (error: any) {
      console.error('Enrichment error:', error);
      toast({
        title: "Enrichment Failed",
        description: error.message || "Failed to enrich contacts",
        variant: "destructive",
      });
    } finally {
      setEnriching(false);
    }
  };

  const loadProviders = async () => {
    if (!userProfile.org_id) return;

    try {
      const { data, error } = await supabase
        .from('external_data_sources')
        .select('*')
        .eq('org_id', userProfile.org_id);

      if (error) throw error;
      
      // Auto-fix any providers where is_active is true but api_key_configured is false
      const providersToFix = (data || []).filter(p => p.is_active && !p.api_key_configured);
      if (providersToFix.length > 0) {
        await Promise.all(
          providersToFix.map(p => 
            supabase
              .from('external_data_sources')
              .update({ api_key_configured: true })
              .eq('id', p.id)
          )
        );
        // Reload to get updated data
        const { data: refreshedData } = await supabase
          .from('external_data_sources')
          .select('*')
          .eq('org_id', userProfile.org_id);
        setProviders(refreshedData || []);
      } else {
        setProviders(data || []);
      }
    } catch (error) {
      console.error('Error loading providers:', error);
      toast({
        title: "Error",
        description: "Failed to load provider configurations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleProvider = async (providerKey: string, isActive: boolean) => {
    if (!userProfile.org_id) return;
    setSaving(providerKey);

    try {
      const existingProvider = providers.find(p => p.provider === providerKey);

      if (existingProvider) {
        const { error } = await supabase
          .from('external_data_sources')
          .update({ 
            is_active: isActive,
            api_key_configured: isActive 
          })
          .eq('id', existingProvider.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('external_data_sources')
          .insert({
            org_id: userProfile.org_id,
            provider: providerKey,
            is_active: isActive,
            api_key_configured: isActive,
          });

        if (error) throw error;
      }

      await loadProviders();
      toast({
        title: "Success",
        description: `${providerKey} ${isActive ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Error toggling provider:', error);
      toast({
        title: "Error",
        description: "Failed to update provider status",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const syncProvider = async (providerKey: string) => {
    if (!userProfile.org_id) return;
    setSaving(providerKey);
    
    try {
      toast({
        title: "Sync started",
        description: `Syncing data from ${providerKey}...`,
      });
      
      // Call edge function to sync external provider
      const { data: syncResult, error: syncError } = await supabase.functions.invoke('sync-external-provider', {
        body: {
          org_id: userProfile.org_id,
          provider: providerKey,
        },
      });

      if (syncError) {
        throw syncError;
      }

      await loadProviders();
      
      toast({
        title: "Sync complete",
        description: `Successfully synced ${syncResult.totalAccounts} accounts and ${syncResult.totalContacts} contacts from ${providerKey}`,
      });
    } catch (error: any) {
      console.error('Error syncing provider:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to sync provider data",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Contact Persona Enrichment</h3>
        <p className="text-sm text-muted-foreground">
          Automatically map job titles to standardized personas for existing contacts. This helps segment and target contacts based on their role (Technical Decision Maker, Business Influencer, etc.).
        </p>
      </div>

      {/* Contact Enrichment Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Contact Persona Enrichment</CardTitle>
                <CardDescription>Automatically map job titles to standardized personas</CardDescription>
              </div>
            </div>
            <Badge variant="outline">
              <UserCheck className="h-3 w-3 mr-1" />
              AI-Powered
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4 p-4 bg-background rounded-lg border">
            <div>
              <p className="text-sm text-muted-foreground">Total Contacts</p>
              <p className="text-2xl font-bold">{contactStats.total.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Enriched</p>
              <p className="text-2xl font-bold text-[hsl(var(--signal-high))]">{contactStats.enriched.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-[hsl(var(--signal-medium))]">{contactStats.pending.toLocaleString()}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Personas include: Technical Decision Maker, Business Decision Maker, IT Decision Maker, Technical Influencer, Business Influencer, and more.
            </p>
            <Button
              onClick={enrichContacts}
              disabled={enriching || contactStats.pending === 0}
              className="w-full"
            >
              {enriching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enriching Contacts...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Enrich {contactStats.pending.toLocaleString()} Contacts
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* External Data Provider Connections */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-2">External Database Connections</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Connect to external B2B databases to identify whitespace opportunities and discover new accounts.
        </p>
      </div>

      <div className="grid gap-6">
        {PROVIDERS.map((provider) => {
          const connected = providers.find(p => p.provider === provider.key);
          const isActive = connected?.is_active || false;
          const isSyncing = saving === provider.key;

          return (
            <Card key={provider.key}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">{provider.name}</CardTitle>
                      <CardDescription>{provider.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={isActive ? "default" : "secondary"}>
                    {isActive ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Active
                      </>
                    ) : (
                      <>
                        <X className="h-3 w-3 mr-1" />
                        Inactive
                      </>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {connected && isActive && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Accounts Available</p>
                      <p className="text-2xl font-bold">{connected.total_accounts.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Contacts Available</p>
                      <p className="text-2xl font-bold">{connected.total_contacts.toLocaleString()}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={isActive}
                      onCheckedChange={(checked) => toggleProvider(provider.key, checked)}
                      disabled={isSyncing}
                    />
                    <Label className="text-sm">Enable {provider.name}</Label>
                  </div>

                  {isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncProvider(provider.key)}
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        'Sync Now'
                      )}
                    </Button>
                  )}
                </div>

                {connected?.last_synced_at && (
                  <p className="text-xs text-muted-foreground">
                    Last synced: {new Date(connected.last_synced_at).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
