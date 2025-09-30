import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Zap, Plus, Trash2, TestTube, ExternalLink, CheckCircle, XCircle, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ZapierWebhook {
  id: string;
  name: string;
  webhook_url: string;
  event_type: string;
  is_active: boolean;
  last_triggered_at?: string;
  created_at: string;
}

const EVENT_TYPES = [
  { value: 'account_created', label: 'New Account Created', description: 'Triggered when a new account is added' },
  { value: 'contact_created', label: 'New Contact Created', description: 'Triggered when a new contact is added' },
  { value: 'lead_created', label: 'New Lead Created', description: 'Triggered when a new lead is created' },
  { value: 'score_updated', label: 'Score Updated', description: 'Triggered when an account score changes' },
];

export function ZapierIntegration() {
  const [webhooks, setWebhooks] = useState<ZapierWebhook[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    webhook_url: '',
    event_type: 'account_created',
  });
  
  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (userProfile?.org_id) {
      loadWebhooks();
    }
  }, [userProfile]);

  const loadWebhooks = async () => {
    try {
      const { data, error } = await supabase
        .from('zapier_webhooks')
        .select('*')
        .eq('org_id', userProfile?.org_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWebhooks(data || []);
    } catch (error: any) {
      console.error('Error loading webhooks:', error);
      toast({
        title: "Error",
        description: "Failed to load Zapier webhooks",
        variant: "destructive",
      });
    }
  };

  const handleAddWebhook = async () => {
    if (!newWebhook.name || !newWebhook.webhook_url) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('zapier_webhooks')
        .insert({
          org_id: userProfile?.org_id,
          name: newWebhook.name,
          webhook_url: newWebhook.webhook_url,
          event_type: newWebhook.event_type,
          is_active: true,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Zapier webhook added successfully",
      });

      setIsAddDialogOpen(false);
      setNewWebhook({ name: '', webhook_url: '', event_type: 'account_created' });
      loadWebhooks();
    } catch (error: any) {
      console.error('Error adding webhook:', error);
      toast({
        title: "Error",
        description: "Failed to add webhook",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('zapier_webhooks')
        .update({ is_active: !currentState })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Webhook ${!currentState ? 'enabled' : 'disabled'}`,
      });

      loadWebhooks();
    } catch (error: any) {
      console.error('Error toggling webhook:', error);
      toast({
        title: "Error",
        description: "Failed to update webhook",
        variant: "destructive",
      });
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      const { error } = await supabase
        .from('zapier_webhooks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Webhook deleted successfully",
      });

      loadWebhooks();
    } catch (error: any) {
      console.error('Error deleting webhook:', error);
      toast({
        title: "Error",
        description: "Failed to delete webhook",
        variant: "destructive",
      });
    }
  };

  const handleTestWebhook = async (webhook: ZapierWebhook) => {
    setIsTesting(webhook.id);
    try {
      const { data, error } = await supabase.functions.invoke('zapier-sync', {
        body: {
          event_type: webhook.event_type,
          data: {
            test: true,
            message: 'This is a test event from TAM Intelligence',
            timestamp: new Date().toISOString(),
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Test Successful",
        description: `Test event sent to ${webhook.name}`,
      });
    } catch (error: any) {
      console.error('Error testing webhook:', error);
      toast({
        title: "Test Failed",
        description: error.message || "Failed to send test event",
        variant: "destructive",
      });
    } finally {
      setIsTesting(null);
    }
  };

  const getEventTypeLabel = (eventType: string) => {
    return EVENT_TYPES.find(et => et.value === eventType)?.label || eventType;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Zap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle>Zapier Integration</CardTitle>
              <CardDescription>
                Connect your CRM via Zapier webhooks - faster than OAuth
              </CardDescription>
            </div>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Webhook
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add Zapier Webhook</DialogTitle>
                <DialogDescription>
                  Configure a new Zapier webhook to sync data automatically
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="webhook-name">Webhook Name *</Label>
                  <Input
                    id="webhook-name"
                    placeholder="e.g., Salesforce Account Sync"
                    value={newWebhook.name}
                    onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="webhook-url">Webhook URL *</Label>
                  <Input
                    id="webhook-url"
                    placeholder="https://hooks.zapier.com/..."
                    value={newWebhook.webhook_url}
                    onChange={(e) => setNewWebhook({ ...newWebhook, webhook_url: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Get this from your Zap's "Webhooks by Zapier" trigger
                  </p>
                </div>
                <div>
                  <Label htmlFor="event-type">Trigger Event *</Label>
                  <Select
                    value={newWebhook.event_type}
                    onValueChange={(value) => setNewWebhook({ ...newWebhook, event_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((et) => (
                        <SelectItem key={et.value} value={et.value}>
                          <div>
                            <div className="font-medium">{et.label}</div>
                            <div className="text-xs text-muted-foreground">{et.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddWebhook}>Add Webhook</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {webhooks.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Zapier Webhooks</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add your first webhook to start syncing data automatically
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold truncate">{webhook.name}</h4>
                    <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                      {webhook.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline">{getEventTypeLabel(webhook.event_type)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mb-1">
                    {webhook.webhook_url}
                  </p>
                  {webhook.last_triggered_at && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last triggered: {new Date(webhook.last_triggered_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Switch
                    checked={webhook.is_active}
                    onCheckedChange={() => handleToggleActive(webhook.id, webhook.is_active)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestWebhook(webhook)}
                    disabled={isTesting === webhook.id}
                  >
                    <TestTube className="h-4 w-4 mr-1" />
                    {isTesting === webhook.id ? 'Testing...' : 'Test'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteWebhook(webhook.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 pt-6 border-t">
          <h4 className="font-semibold mb-3">How to Set Up</h4>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="font-semibold">1.</span>
              <span>Create a new Zap in Zapier with "Webhooks by Zapier" as the trigger</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold">2.</span>
              <span>Choose "Catch Hook" and copy the webhook URL</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold">3.</span>
              <span>Add the webhook above with the URL and select the trigger event</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold">4.</span>
              <span>Connect your CRM as the action (Salesforce, HubSpot, etc.)</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold">5.</span>
              <span>Use the "Test" button to verify the connection works</span>
            </li>
          </ol>
          <Button variant="link" className="mt-4 p-0 h-auto" asChild>
            <a href="https://zapier.com/apps/webhooks/integrations" target="_blank" rel="noopener noreferrer">
              Learn more about Zapier Webhooks <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
