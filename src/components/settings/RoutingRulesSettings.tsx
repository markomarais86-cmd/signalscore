import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit, Route, Clock } from "lucide-react";
import { useRoutingRules, type RoutingRule } from "@/hooks/use-routing-rules";
import { useAuth } from "@/hooks/use-auth";

function RuleForm({ rule, onSave, onCancel }: {
  rule?: RoutingRule;
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const { userProfile } = useAuth();
  const [name, setName] = useState(rule?.name || "");
  const [priority, setPriority] = useState(rule?.priority?.toString() || "100");
  const [slaMinutes, setSlaMinutes] = useState(rule?.sla_minutes?.toString() || "60");
  const [geography, setGeography] = useState((rule?.conditions?.geography || []).join(", "));
  const [minScore, setMinScore] = useState(rule?.conditions?.min_qualification_score?.toString() || "");
  const [sizeMin, setSizeMin] = useState(rule?.conditions?.company_size_min?.toString() || "");
  const [sizeMax, setSizeMax] = useState(rule?.conditions?.company_size_max?.toString() || "");
  const [industries, setIndustries] = useState((rule?.conditions?.industries || []).join(", "));

  const handleSubmit = () => {
    if (!name || !userProfile?.org_id) return;
    const conditions: Record<string, any> = {};
    if (geography.trim()) conditions.geography = geography.split(",").map(s => s.trim()).filter(Boolean);
    if (minScore) conditions.min_qualification_score = parseInt(minScore);
    if (sizeMin) conditions.company_size_min = parseInt(sizeMin);
    if (sizeMax) conditions.company_size_max = parseInt(sizeMax);
    if (industries.trim()) conditions.industries = industries.split(",").map(s => s.trim()).filter(Boolean);

    onSave({
      org_id: userProfile.org_id,
      name,
      priority: parseInt(priority),
      sla_minutes: parseInt(slaMinutes),
      conditions,
      auto_tasks: rule?.auto_tasks || [
        { type: "call", title: "Initial outreach call", due_offset_minutes: parseInt(slaMinutes) },
        { type: "email", title: "Send intro email", due_offset_minutes: parseInt(slaMinutes) * 2 },
      ],
      is_active: rule?.is_active ?? true,
      assigned_to: rule?.assigned_to || null,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Rule Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enterprise US leads" />
        </div>
        <div>
          <Label>Priority (lower = higher)</Label>
          <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>SLA Response Time (minutes)</Label>
        <Input type="number" value={slaMinutes} onChange={(e) => setSlaMinutes(e.target.value)} />
      </div>
      <div className="border-t pt-4">
        <p className="text-sm font-medium mb-3">Conditions</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Countries (comma-separated)</Label>
            <Input value={geography} onChange={(e) => setGeography(e.target.value)} placeholder="US, CA, UK" />
          </div>
          <div>
            <Label>Min Qualification Score</Label>
            <Input type="number" value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="70" />
          </div>
          <div>
            <Label>Min Company Size</Label>
            <Input type="number" value={sizeMin} onChange={(e) => setSizeMin(e.target.value)} placeholder="50" />
          </div>
          <div>
            <Label>Max Company Size</Label>
            <Input type="number" value={sizeMax} onChange={(e) => setSizeMax(e.target.value)} placeholder="500" />
          </div>
          <div className="col-span-2">
            <Label>Industries (comma-separated)</Label>
            <Input value={industries} onChange={(e) => setIndustries(e.target.value)} placeholder="SaaS, Technology" />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={!name}>Save Rule</Button>
      </div>
    </div>
  );
}

export function RoutingRulesSettings() {
  const { rules, isLoading, createRule, updateRule, deleteRule, toggleRule } = useRoutingRules();
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = (data: any) => {
    createRule.mutate(data);
    setShowCreate(false);
  };

  const handleUpdate = (data: any) => {
    if (!editingRule) return;
    updateRule.mutate({ id: editingRule.id, updates: data });
    setEditingRule(null);
  };

  const summarizeConditions = (conditions: Record<string, any>) => {
    const parts: string[] = [];
    if (conditions.geography?.length) parts.push(`📍 ${conditions.geography.join(", ")}`);
    if (conditions.min_qualification_score) parts.push(`🎯 Score ≥ ${conditions.min_qualification_score}`);
    if (conditions.company_size_min || conditions.company_size_max) {
      parts.push(`👥 ${conditions.company_size_min || 0}–${conditions.company_size_max || "∞"}`);
    }
    if (conditions.industries?.length) parts.push(`🏢 ${conditions.industries.join(", ")}`);
    return parts.length ? parts.join(" · ") : "No conditions (matches all)";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Route className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Lead Routing Rules</CardTitle>
              <CardDescription>
                Automatically assign incoming leads to reps with tier-based SLAs (P1: 5m, P2: 2h, P3: 24h)
              </CardDescription>
            </div>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Rule</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Routing Rule</DialogTitle></DialogHeader>
              <RuleForm onSave={handleCreate} onCancel={() => setShowCreate(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm py-4">Loading rules...</p>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Route className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No routing rules yet</p>
            <p className="text-sm">Create your first rule to automatically assign leads to reps.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{rule.name}</p>
                    <Badge variant="outline">P{rule.priority}</Badge>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {rule.sla_minutes}m SLA
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{summarizeConditions(rule.conditions)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, is_active: checked })}
                  />
                  <Dialog open={editingRule?.id === rule.id} onOpenChange={(open) => !open && setEditingRule(null)}>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="ghost" onClick={() => setEditingRule(rule)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader><DialogTitle>Edit Routing Rule</DialogTitle></DialogHeader>
                      <RuleForm rule={rule} onSave={handleUpdate} onCancel={() => setEditingRule(null)} />
                    </DialogContent>
                  </Dialog>
                  <Button size="icon" variant="ghost" onClick={() => deleteRule.mutate(rule.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
