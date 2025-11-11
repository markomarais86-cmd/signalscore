import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Plus, Trash2, ExternalLink, Activity, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { LoadingState } from "@/components/LoadingState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Webhook {
  id: string;
  name: string;
  webhook_url: string;
  event_type: string;
  is_active: boolean;
  last_triggered_at: string | null;
}

const EVENT_TYPES = [
  { value: 'account_high_score', label: 'High Score Account (≥70)', description: 'Trigger when account scores 70+' },
  { value: 'icp_updated', label: 'ICP Profile Updated', description: 'Trigger when ICP is modified' },
  { value: 'lead_qualified', label: 'Lead Qualified', description: 'Trigger when lead status changes to qualified' },
  { value: 'enrichment_complete', label: 'Enrichment Complete', description: 'Trigger when enrichment finishes' },
];

export function ZapierWebhookManager() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    webhook_url: '',
    event_type: 'account_high_score'
  });
  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (userProfile?.org_id) {
      loadWebhooks();
    }
  }, [userProfile?.org_id]);

  const loadWebhooks = async () => {
    if (!userProfile?.org_id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('zapier_webhooks')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWebhooks(data || []);
    } catch (error) {
      console.error('Error loading webhooks:', error);
      toast({
        title: "Error",
        description: "Failed to load webhooks",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWebhook = async () => {
    if (!userProfile?.org_id) return;
    if (!newWebhook.name || !newWebhook.webhook_url) {
      toast({
        title: "Validation Error",
        description: "Name and webhook URL are required",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('zapier_webhooks')
        .insert({
          org_id: userProfile.org_id,
          name: newWebhook.name,
          webhook_url: newWebhook.webhook_url,
          event_type: newWebhook.event_type,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Webhook created successfully"
      });

      setDialogOpen(false);
      setNewWebhook({ name: '', webhook_url: '', event_type: 'account_high_score' });
      loadWebhooks();
    } catch (error) {
      console.error('Error creating webhook:', error);
      toast({
        title: "Error",
        description: "Failed to create webhook",
        variant: "destructive"
      });
    }
  };

  const handleToggleWebhook = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('zapier_webhooks')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;

      setWebhooks(webhooks.map(w => w.id === id ? { ...w, is_active: isActive } : w));
      toast({
        title: "Success",
        description: `Webhook ${isActive ? 'enabled' : 'disabled'}`
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

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      const { error } = await supabase
        .from('zapier_webhooks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setWebhooks(webhooks.filter(w => w.id !== id));
      toast({
        title: "Success",
        description: "Webhook deleted"
      });
    } catch (error) {
      console.error('Error deleting webhook:', error);
      toast({
        title: "Error",
        description: "Failed to delete webhook",
        variant: "destructive"
      });
    }
  };

  const testWebhook = async (webhook: Webhook) => {
    try {
      const response = await fetch(webhook.webhook_url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test: true,
          event_type: webhook.event_type,
          timestamp: new Date().toISOString()
        })
      });

      toast({
        title: "Test Sent",
        description: "Check your Zapier history to confirm delivery"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send test webhook",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <LoadingState message="Loading webhook configuration..." />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            <CardTitle>Zapier Webhooks</CardTitle>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Webhook
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Zapier Webhook</DialogTitle>
                <DialogDescription>
                  Connect your ICP platform to Zapier to automate workflows
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="webhook-name">Webhook Name</Label>
                  <Input
                    id="webhook-name"
                    placeholder="e.g., New High Score Accounts"
                    value={newWebhook.name}
                    onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input
                    id="webhook-url"
                    placeholder="https://hooks.zapier.com/hooks/catch/..."
                    value={newWebhook.webhook_url}
                    onChange={(e) => setNewWebhook({ ...newWebhook, webhook_url: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Get this URL from your Zap's "Webhooks by Zapier" trigger
                  </p>
                </div>
                <div>
                  <Label htmlFor="event-type">Event Type</Label>
                  <Select
                    value={newWebhook.event_type}
                    onValueChange={(value) => setNewWebhook({ ...newWebhook, event_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateWebhook} className="w-full">
                  Create Webhook
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription>
          Automatically trigger Zapier workflows when specific events occur
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {webhooks.length === 0 ? (
          <div className="text-center py-8">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">No webhooks configured yet</p>
            <Button variant="outline" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Webhook
            </Button>
          </div>
        ) : (
          webhooks.map((webhook) => {
            const eventType = EVENT_TYPES.find(t => t.value === webhook.event_type);
            return (
              <div key={webhook.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{webhook.name}</h4>
                      <Badge variant={webhook.is_active ? "default" : "outline"}>
                        {webhook.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{eventType?.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {webhook.webhook_url.substring(0, 50)}...
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={webhook.is_active}
                      onCheckedChange={(checked) => handleToggleWebhook(webhook.id, checked)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => testWebhook(webhook)}
                      title="Test webhook"
                    >
                      <Activity className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteWebhook(webhook.id)}
                      title="Delete webhook"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {webhook.last_triggered_at && (
                  <p className="text-xs text-muted-foreground">
                    Last triggered: {new Date(webhook.last_triggered_at).toLocaleString()}
                  </p>
                )}
              </div>
            );
          })
        )}

        <div className="pt-4 border-t space-y-2">
          <Button variant="outline" className="w-full" asChild>
            <a href="https://zapier.com" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Zapier Dashboard
            </a>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <a href="/CLAY_INTEGRATION_SETUP.md" target="_blank" rel="noopener noreferrer">
              <Database className="h-4 w-4 mr-2" />
              Clay Integration Guide
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

