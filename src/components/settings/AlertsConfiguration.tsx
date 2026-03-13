import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { 
  Bell, Plus, Edit, Trash2, Send, Slack, Webhook, Mail,
  AlertTriangle, Activity, TrendingDown, DollarSign, ShieldAlert, Zap, Loader2,
  Bot, Megaphone, Radio
} from "lucide-react";
import { useEffectiveOrg } from "@/hooks/use-effective-org";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Alert {
  id: string;
  name: string;
  alert_type: string;
  threshold_value: number | null;
  threshold_operator: string | null;
  is_active: boolean;
  notification_channels: any;
  slack_webhook_url: string | null;
  webhook_url: string | null;
  teams_webhook_url: string | null;
  email_recipients: string[] | null;
  last_triggered_at: string | null;
  trigger_count: number;
  created_at: string;
}

const ALERT_TYPE_CONFIG: Record<string, { label: string; icon: any; description: string; unit: string }> = {
  api_credits_low: { label: "API Credits Low", icon: Zap, description: "Fires when API credits drop below threshold", unit: "credits" },
  service_degraded: { label: "Service Degraded", icon: ShieldAlert, description: "Fires when provider failures exceed threshold", unit: "failures" },
  velocity_drop: { label: "Velocity Drop", icon: TrendingDown, description: "Fires when sales velocity change exceeds threshold", unit: "%" },
  win_rate_decline: { label: "Win Rate Decline", icon: Activity, description: "Fires when win rate change exceeds threshold", unit: "%" },
  slippage_increase: { label: "Pipeline Slippage", icon: AlertTriangle, description: "Fires when deal slippage exceeds threshold", unit: "%" },
  pipeline_threshold: { label: "Pipeline Threshold", icon: DollarSign, description: "Fires when pipeline value drops below threshold", unit: "$" },
  deal_at_risk: { label: "Deals at Risk", icon: AlertTriangle, description: "Fires when overdue deals exceed threshold", unit: "deals" },
  high_priority_signal: { label: "High-Priority Signal", icon: Radio, description: "Fires when a high/critical priority signal is detected", unit: "signals" },
  agent_completed: { label: "Agent Completed", icon: Bot, description: "Fires when an AI agent run completes", unit: "records" },
  campaign_completed: { label: "Campaign Completed", icon: Megaphone, description: "Fires when a campaign reaches completed/sent status", unit: "contacts" },
};

const OPERATOR_OPTIONS = [
  { value: "lt", label: "Less than" },
  { value: "lte", label: "Less than or equal" },
  { value: "gt", label: "Greater than" },
  { value: "gte", label: "Greater than or equal" },
  { value: "eq", label: "Equal to" },
];

// Teams icon as inline SVG since lucide doesn't have it
const TeamsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zm-6.75 13.5h-1.5v-6h-2.25V9h6v1.5h-2.25v6z"/>
  </svg>
);

const emptyForm = (): Partial<Alert> => ({
  name: "",
  alert_type: "api_credits_low",
  threshold_value: 100,
  threshold_operator: "lt",
  is_active: true,
  notification_channels: { slack: false, webhook: false, email: false, teams: false },
  slack_webhook_url: null,
  webhook_url: null,
  teams_webhook_url: null,
  email_recipients: [],
});

export function AlertsConfiguration() {
  const { effectiveOrgId } = useEffectiveOrg();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [form, setForm] = useState<Partial<Alert>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    if (effectiveOrgId) loadAlerts();
  }, [effectiveOrgId]);

  const loadAlerts = async () => {
    if (!effectiveOrgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .eq("org_id", effectiveOrgId)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to load alerts", variant: "destructive" });
    } else {
      setAlerts(data || []);
    }
    setLoading(false);
  };

  const openCreate = () => {
    setEditingAlert(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (alert: Alert) => {
    setEditingAlert(alert);
    const channels = typeof alert.notification_channels === 'object' && alert.notification_channels
      ? alert.notification_channels
      : { slack: false, webhook: false, email: false, teams: false };
    setForm({
      name: alert.name,
      alert_type: alert.alert_type,
      threshold_value: alert.threshold_value,
      threshold_operator: alert.threshold_operator,
      is_active: alert.is_active,
      notification_channels: channels,
      slack_webhook_url: alert.slack_webhook_url,
      webhook_url: alert.webhook_url,
      teams_webhook_url: alert.teams_webhook_url,
      email_recipients: alert.email_recipients,
    });
    setDialogOpen(true);
  };

  const saveAlert = async () => {
    if (!effectiveOrgId || !form.name || !form.alert_type) return;
    setSaving(true);

    const payload = {
      name: form.name,
      alert_type: form.alert_type,
      threshold_value: form.threshold_value,
      threshold_operator: form.threshold_operator || "lt",
      is_active: form.is_active ?? true,
      notification_channels: form.notification_channels || {},
      slack_webhook_url: form.slack_webhook_url || null,
      webhook_url: form.webhook_url || null,
      teams_webhook_url: form.teams_webhook_url || null,
      email_recipients: form.email_recipients || [],
      org_id: effectiveOrgId,
    };

    let error;
    if (editingAlert) {
      ({ error } = await supabase.from("alerts").update(payload).eq("id", editingAlert.id));
    } else {
      ({ error } = await supabase.from("alerts").insert(payload));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: editingAlert ? "Alert updated" : "Alert created" });
      setDialogOpen(false);
      loadAlerts();
    }
    setSaving(false);
  };

  const toggleActive = async (alert: Alert) => {
    const { error } = await supabase
      .from("alerts")
      .update({ is_active: !alert.is_active })
      .eq("id", alert.id);

    if (error) {
      toast({ title: "Error", description: "Failed to toggle alert", variant: "destructive" });
    } else {
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, is_active: !a.is_active } : a));
    }
  };

  const deleteAlert = async (id: string) => {
    const { error } = await supabase.from("alerts").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete alert", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Alert removed" });
      setAlerts(prev => prev.filter(a => a.id !== id));
    }
  };

  const testAlert = async (alertId: string) => {
    if (!effectiveOrgId) return;
    setTesting(alertId);
    try {
      const { data, error } = await supabase.functions.invoke("check-alerts", {
        body: { orgId: effectiveOrgId, testMode: true, testAlertId: alertId },
      });
      if (error) throw error;
      toast({ title: "Test Sent", description: `Test notification dispatched. Result: ${JSON.stringify(data)}` });
    } catch (err: any) {
      toast({ title: "Test Failed", description: err.message, variant: "destructive" });
    }
    setTesting(null);
  };

  const getTypeConfig = (type: string) =>
    ALERT_TYPE_CONFIG[type] || { label: type, icon: Bell, description: "", unit: "" };

  const getOperatorLabel = (op: string | null) =>
    OPERATOR_OPTIONS.find(o => o.value === op)?.label || op || "—";

  const getChannelBadges = (alert: Alert) => {
    const badges: Array<{ label: string; icon: any; ok: boolean }> = [];
    const ch = typeof alert.notification_channels === 'object' && alert.notification_channels ? alert.notification_channels : {};
    if ((ch as any).slack && alert.slack_webhook_url) badges.push({ label: "Slack", icon: Slack, ok: true });
    else if ((ch as any).slack) badges.push({ label: "Slack", icon: Slack, ok: false });
    if ((ch as any).teams && alert.teams_webhook_url) badges.push({ label: "Teams", icon: TeamsIcon, ok: true });
    else if ((ch as any).teams) badges.push({ label: "Teams", icon: TeamsIcon, ok: false });
    if ((ch as any).webhook && alert.webhook_url) badges.push({ label: "Webhook", icon: Webhook, ok: true });
    else if ((ch as any).webhook) badges.push({ label: "Webhook", icon: Webhook, ok: false });
    if ((ch as any).email && alert.email_recipients?.length) badges.push({ label: "Email", icon: Mail, ok: true });
    else if ((ch as any).email) badges.push({ label: "Email", icon: Mail, ok: false });
    return badges;
  };

  const updateChannel = (key: string, val: boolean) => {
    setForm(prev => ({
      ...prev,
      notification_channels: { ...(prev.notification_channels || {}), [key]: val },
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Alerts & Notifications
              </CardTitle>
              <CardDescription>
                Configure alerts for signals, agent completions, campaigns, and pipeline metrics with Slack &amp; Teams delivery
              </CardDescription>
            </div>
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Alert
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No alerts configured</p>
              <p className="text-sm mt-1">Create an alert to get notified about critical changes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map(alert => {
                const config = getTypeConfig(alert.alert_type);
                const Icon = config.icon;
                const channels = getChannelBadges(alert);
                return (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{alert.name}</span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {config.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span>
                            {getOperatorLabel(alert.threshold_operator)}{" "}
                            {alert.threshold_value} {config.unit}
                          </span>
                          {alert.last_triggered_at && (
                            <>
                              <span>•</span>
                              <span>
                                Last triggered:{" "}
                                {new Date(alert.last_triggered_at).toLocaleDateString()}
                              </span>
                            </>
                          )}
                          {alert.trigger_count > 0 && (
                            <>
                              <span>•</span>
                              <span>{alert.trigger_count}× fired</span>
                            </>
                          )}
                        </div>
                        {channels.length > 0 && (
                          <div className="flex gap-1.5 mt-1.5">
                            {channels.map(ch => (
                              <Badge
                                key={ch.label}
                                variant={ch.ok ? "default" : "outline"}
                                className="text-xs gap-1"
                              >
                                <ch.icon className="h-3 w-3" />
                                {ch.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <Switch
                        checked={alert.is_active}
                        onCheckedChange={() => toggleActive(alert)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => testAlert(alert.id)}
                        disabled={testing === alert.id}
                        title="Send test notification"
                      >
                        {testing === alert.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(alert)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAlert(alert.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAlert ? "Edit Alert" : "Create Alert"}</DialogTitle>
            <DialogDescription>
              {editingAlert
                ? "Update alert configuration and notification channels"
                : "Set up a new alert with threshold and notification channels"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div>
              <Label>Alert Name</Label>
              <Input
                placeholder="e.g. High-Priority Signal Alert"
                value={form.name || ""}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            {/* Type */}
            <div>
              <Label>Alert Type</Label>
              <Select
                value={form.alert_type}
                onValueChange={v => setForm(prev => ({ ...prev, alert_type: v }))}
                disabled={!!editingAlert}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ALERT_TYPE_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {getTypeConfig(form.alert_type || "").description}
              </p>
            </div>

            {/* Threshold */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Operator</Label>
                <Select
                  value={form.threshold_operator || "lt"}
                  onValueChange={v => setForm(prev => ({ ...prev, threshold_operator: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPERATOR_OPTIONS.map(op => (
                      <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Threshold ({getTypeConfig(form.alert_type || "").unit})</Label>
                <Input
                  type="number"
                  value={form.threshold_value ?? ""}
                  onChange={e => setForm(prev => ({ ...prev, threshold_value: Number(e.target.value) }))}
                />
              </div>
            </div>

            <Separator />

            {/* Notification Channels */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Notification Channels</Label>

              {/* Slack */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Slack className="h-4 w-4" />
                    <span className="text-sm font-medium">Slack</span>
                  </div>
                  <Switch
                    checked={(form.notification_channels as any)?.slack || false}
                    onCheckedChange={v => updateChannel("slack", v)}
                  />
                </div>
                {(form.notification_channels as any)?.slack && (
                  <Input
                    placeholder="https://hooks.slack.com/services/..."
                    value={form.slack_webhook_url || ""}
                    onChange={e => setForm(prev => ({ ...prev, slack_webhook_url: e.target.value }))}
                  />
                )}
              </div>

              {/* Microsoft Teams */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TeamsIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">Microsoft Teams</span>
                  </div>
                  <Switch
                    checked={(form.notification_channels as any)?.teams || false}
                    onCheckedChange={v => updateChannel("teams", v)}
                  />
                </div>
                {(form.notification_channels as any)?.teams && (
                  <div className="space-y-1">
                    <Input
                      placeholder="https://outlook.office.com/webhook/..."
                      value={(form as any).teams_webhook_url || ""}
                      onChange={e => setForm(prev => ({ ...prev, teams_webhook_url: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Paste the Incoming Webhook URL from your Teams channel connector
                    </p>
                  </div>
                )}
              </div>

              {/* Webhook */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Webhook className="h-4 w-4" />
                    <span className="text-sm font-medium">Webhook</span>
                  </div>
                  <Switch
                    checked={(form.notification_channels as any)?.webhook || false}
                    onCheckedChange={v => updateChannel("webhook", v)}
                  />
                </div>
                {(form.notification_channels as any)?.webhook && (
                  <Input
                    placeholder="https://your-endpoint.com/webhook"
                    value={form.webhook_url || ""}
                    onChange={e => setForm(prev => ({ ...prev, webhook_url: e.target.value }))}
                  />
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span className="text-sm font-medium">Email</span>
                  </div>
                  <Switch
                    checked={(form.notification_channels as any)?.email || false}
                    onCheckedChange={v => updateChannel("email", v)}
                  />
                </div>
                {(form.notification_channels as any)?.email && (
                  <Input
                    placeholder="admin@company.com, ops@company.com"
                    value={(form.email_recipients || []).join(", ")}
                    onChange={e =>
                      setForm(prev => ({
                        ...prev,
                        email_recipients: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
                      }))
                    }
                  />
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveAlert} disabled={saving || !form.name}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingAlert ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AlertsConfiguration;
