import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, DollarSign, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

interface DeepResearchConfig {
  auto_enabled: boolean;
  score_threshold: number;
  monthly_budget: number;
  confidence_threshold: number;
  max_per_job: number;
  priority_strategy: 'high_icp' | 'newest' | 'manual';
}

export function DeepResearchSettings() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [monthlySpent, setMonthlySpent] = useState(0);
  
  const [config, setConfig] = useState<DeepResearchConfig>({
    auto_enabled: false,
    score_threshold: 80,
    monthly_budget: 50,
    confidence_threshold: 70,
    max_per_job: 50,
    priority_strategy: 'high_icp'
  });

  useEffect(() => {
    loadConfig();
    loadMonthlySpending();
  }, [userProfile]);

  const loadConfig = async () => {
    if (!userProfile?.org_id) return;

    try {
      const { data, error } = await supabase
        .from('automation_settings')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .eq('setting_key', 'deep_research_auto')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(prev => ({ 
          ...prev, 
          auto_enabled: data.enabled,
          // Store additional config in schedule_frequency as JSON for now
          ...(data.schedule_frequency ? JSON.parse(data.schedule_frequency) : {})
        }));
      }
    } catch (error) {
      console.error('Error loading deep research config:', error);
    }
  };

  const loadMonthlySpending = async () => {
    if (!userProfile?.org_id) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    try {
      const { data, error } = await supabase
        .from('enrichment_spending')
        .select('total_spent')
        .eq('org_id', userProfile.org_id)
        .eq('phase', 'deep_research')
        .eq('month_start', monthStart.toISOString().split('T')[0]);

      if (!error && data && data.length > 0) {
        setMonthlySpent(data.reduce((sum, r) => sum + Number(r.total_spent), 0));
      }
    } catch (error) {
      console.error('Error loading spending:', error);
    }
  };

  const saveConfig = async () => {
    if (!userProfile?.org_id) return;

    setLoading(true);
    try {
      // Store config as JSON in schedule_frequency field temporarily
      const configJson = JSON.stringify({
        score_threshold: config.score_threshold,
        monthly_budget: config.monthly_budget,
        confidence_threshold: config.confidence_threshold,
        max_per_job: config.max_per_job,
        priority_strategy: config.priority_strategy
      });

      const { error } = await supabase
        .from('automation_settings')
        .upsert({
          org_id: userProfile.org_id,
          setting_key: 'deep_research_auto',
          enabled: config.auto_enabled,
          schedule_frequency: configJson
        }, {
          onConflict: 'org_id,setting_key'
        });

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Deep research configuration updated successfully"
      });
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const budgetUsedPercent = (monthlySpent / config.monthly_budget) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>Deep Research Settings</CardTitle>
        </div>
        <CardDescription>
          Configure AI-powered deep research for high-value accounts (10x cost, 95%+ confidence)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Budget Status */}
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Monthly Budget</span>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="font-bold">${monthlySpent.toFixed(2)} / ${config.monthly_budget}</span>
            </div>
          </div>
          <div className="w-full bg-background rounded-full h-2">
            <div 
              className={`h-full rounded-full transition-all ${
                budgetUsedPercent >= 100 ? 'bg-destructive' : 
                budgetUsedPercent >= 80 ? 'bg-[hsl(var(--signal-medium))]' : 
                'bg-primary'
              }`}
              style={{ width: `${Math.min(budgetUsedPercent, 100)}%` }}
            />
          </div>
          {budgetUsedPercent >= 80 && (
            <div className="flex items-center gap-2 text-sm text-[hsl(var(--signal-medium))]">
              <AlertTriangle className="h-4 w-4" />
              <span>{budgetUsedPercent >= 100 ? 'Budget exceeded' : 'Budget 80% used'}</span>
            </div>
          )}
        </div>

        {/* Auto-Enable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-enable">Enable Auto Deep Research</Label>
            <p className="text-sm text-muted-foreground">
              Automatically enrich high-value accounts with deep research
            </p>
          </div>
          <Switch
            id="auto-enable"
            checked={config.auto_enabled}
            onCheckedChange={(checked) => setConfig(prev => ({ ...prev, auto_enabled: checked }))}
          />
        </div>

        {/* ICP Score Threshold */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>ICP Score Threshold</Label>
            <Badge variant="outline">{config.score_threshold}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Only accounts scoring above this threshold will trigger deep research
          </p>
          <Slider
            value={[config.score_threshold]}
            onValueChange={([value]) => setConfig(prev => ({ ...prev, score_threshold: value }))}
            min={70}
            max={95}
            step={5}
            disabled={!config.auto_enabled}
          />
        </div>

        {/* Monthly Budget Cap */}
        <div className="space-y-2">
          <Label htmlFor="budget">Monthly Budget Cap ($)</Label>
          <p className="text-sm text-muted-foreground">
            Maximum to spend on deep research per month
          </p>
          <Input
            id="budget"
            type="number"
            value={config.monthly_budget}
            onChange={(e) => setConfig(prev => ({ ...prev, monthly_budget: Number(e.target.value) }))}
            min={10}
            max={1000}
            step={10}
          />
        </div>

        {/* Confidence Threshold */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Confidence Threshold (%)</Label>
            <Badge variant="outline">{config.confidence_threshold}%</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Minimum confidence required to auto-apply deep research results
          </p>
          <Slider
            value={[config.confidence_threshold]}
            onValueChange={([value]) => setConfig(prev => ({ ...prev, confidence_threshold: value }))}
            min={60}
            max={90}
            step={5}
            disabled={!config.auto_enabled}
          />
        </div>

        {/* Max Accounts per Job */}
        <div className="space-y-2">
          <Label htmlFor="max-accounts">Max Accounts per Job</Label>
          <p className="text-sm text-muted-foreground">
            Limit deep research to control costs (default: 50)
          </p>
          <Input
            id="max-accounts"
            type="number"
            value={config.max_per_job}
            onChange={(e) => setConfig(prev => ({ ...prev, max_per_job: Number(e.target.value) }))}
            min={1}
            max={100}
            step={5}
            disabled={!config.auto_enabled}
          />
        </div>

        {/* Priority Strategy */}
        <div className="space-y-2">
          <Label htmlFor="priority">Priority Strategy</Label>
          <p className="text-sm text-muted-foreground">
            Which accounts to prioritize when limits are reached
          </p>
          <Select
            value={config.priority_strategy}
            onValueChange={(value: any) => setConfig(prev => ({ ...prev, priority_strategy: value }))}
            disabled={!config.auto_enabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high_icp">Highest ICP Score First</SelectItem>
              <SelectItem value="newest">Newest Accounts First</SelectItem>
              <SelectItem value="manual">Manual Selection Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Save Button */}
        <Button onClick={saveConfig} disabled={loading} className="w-full">
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}
