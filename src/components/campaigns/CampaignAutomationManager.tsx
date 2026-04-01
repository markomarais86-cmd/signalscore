import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap, Plus, Trash2, Clock, TrendingUp, Cpu, Users, Building2, Rocket, Activity } from "lucide-react";
import { useAutomationRules, AutomationRule } from "@/hooks/use-automation-rules";
import { FUEL_LINE_TYPES, SIGNAL_FUEL_LINE_MAP, SEQUENCE_TEMPLATES } from "./constants/campaign-config";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const SIGNAL_OPTIONS = [
  { value: "intent", label: "Intent Signals", icon: TrendingUp },
  { value: "tech_change", label: "Tech Changes", icon: Cpu },
  { value: "funding", label: "New Funding", icon: Zap },
  { value: "expansion", label: "Expansion", icon: Building2 },
  { value: "new_hire", label: "New Hires", icon: Users },
];

const SIGNAL_ICON_MAP: Record<string, typeof Zap> = {
  intent: TrendingUp,
  tech_change: Cpu,
  funding: Zap,
  expansion: Building2,
  new_hire: Users,
};

const DEFAULT_RULE: Partial<AutomationRule> = {
  name: "",
  signal_type: "intent",
  fuel_line_type: "abm",
  sequence_template: "enterprise",
  min_signals: 3,
  min_accounts: 2,
  priority_filter: ["high", "critical"],
  cooldown_hours: 72,
};

export function CampaignAutomationManager() {
  const { rules, log, isLoading, createRule, deleteRule, toggleRule } = useAutomationRules();
  const [showCreate, setShowCreate] = useState(false);
  const [newRule, setNewRule] = useState<Partial<AutomationRule>>(DEFAULT_RULE);

  const handleCreate = () => {
    if (!newRule.name?.trim()) return;
    createRule.mutate(newRule, { onSuccess: () => { setShowCreate(false); setNewRule(DEFAULT_RULE); } });
  };

  const handleSignalTypeChange = (signalType: string) => {
    const mapping = SIGNAL_FUEL_LINE_MAP[signalType];
    setNewRule((prev) => ({
      ...prev,
      signal_type: signalType,
      fuel_line_type: mapping?.fuelLine || prev.fuel_line_type,
      sequence_template: mapping?.template || prev.sequence_template,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Campaign Automation Rules
          </h2>
          <p className="text-sm text-muted-foreground">
            Auto-create campaigns when signals meet your thresholds
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Rule
        </Button>
      </div>

      {/* Rules List */}
      {rules.length === 0 && !isLoading ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Rocket className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium">No automation rules yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Create rules to automatically launch campaigns when signals hit your thresholds
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rules.map((rule) => {
            const Icon = SIGNAL_ICON_MAP[rule.signal_type] || Zap;
            const fuelLabel = FUEL_LINE_TYPES[rule.fuel_line_type as keyof typeof FUEL_LINE_TYPES]?.label || rule.fuel_line_type;
            return (
              <Card key={rule.id} className={cn("transition-all", !rule.is_enabled && "opacity-60")}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{rule.name}</span>
                      <Badge variant="secondary" className="text-xs">{fuelLabel}</Badge>
                      <Badge variant="outline" className="text-xs">
                        ≥{rule.min_signals} signals / {rule.min_accounts} accounts
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {rule.cooldown_hours}h cooldown
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {rule.trigger_count} triggers
                      </span>
                      {rule.last_triggered_at && (
                        <span>
                          Last: {formatDistanceToNow(new Date(rule.last_triggered_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={rule.is_enabled}
                    onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, enabled: checked })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive/60 hover:text-destructive"
                    onClick={() => deleteRule.mutate(rule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Recent Automation Log */}
      {log.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Auto-Triggered Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2">
                {log.slice(0, 10).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                    <div>
                      <span className="font-medium">{entry.campaign_name || entry.rule_name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        {entry.signal_count} signals · {entry.account_count} accounts
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={entry.status === "created" ? "default" : "secondary"} className="text-xs">
                        {entry.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Create Rule Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Automation Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rule Name</Label>
              <Input
                placeholder="e.g., High-Intent ABM Auto-Launch"
                value={newRule.name || ""}
                onChange={(e) => setNewRule((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div>
              <Label>Signal Type</Label>
              <Select value={newRule.signal_type} onValueChange={handleSignalTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SIGNAL_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fuel Line</Label>
                <Select value={newRule.fuel_line_type} onValueChange={(v) => setNewRule((p) => ({ ...p, fuel_line_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FUEL_LINE_TYPES).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sequence</Label>
                <Select value={newRule.sequence_template} onValueChange={(v) => setNewRule((p) => ({ ...p, sequence_template: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEQUENCE_TEMPLATES).map(([key, tmpl]) => (
                      <SelectItem key={key} value={key}>{tmpl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Min Signals</Label>
                <Input
                  type="number"
                  min={1}
                  value={newRule.min_signals}
                  onChange={(e) => setNewRule((p) => ({ ...p, min_signals: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div>
                <Label className="text-xs">Min Accounts</Label>
                <Input
                  type="number"
                  min={1}
                  value={newRule.min_accounts}
                  onChange={(e) => setNewRule((p) => ({ ...p, min_accounts: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div>
                <Label className="text-xs">Cooldown (hrs)</Label>
                <Input
                  type="number"
                  min={1}
                  value={newRule.cooldown_hours}
                  onChange={(e) => setNewRule((p) => ({ ...p, cooldown_hours: parseInt(e.target.value) || 24 }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newRule.name?.trim() || createRule.isPending}>
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
