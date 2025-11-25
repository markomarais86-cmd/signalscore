import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, PlayCircle, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AutomationSetting {
  id: string;
  setting_key: string;
  enabled: boolean;
  schedule_frequency: string | null;
  last_run_at: string | null;
}

export function AutomationSettings() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, AutomationSetting>>({});
  const [triggering, setTriggering] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile?.org_id) {
      loadSettings();
    }
  }, [userProfile?.org_id]);

  const loadSettings = async () => {
    if (!userProfile?.org_id) return;

    try {
      const { data, error } = await supabase
        .from('automation_settings')
        .select('*')
        .eq('org_id', userProfile.org_id);

      if (error) throw error;

      const settingsMap: Record<string, AutomationSetting> = {};
      data?.forEach(setting => {
        settingsMap[setting.setting_key] = setting;
      });
      setSettings(settingsMap);
    } catch (error: any) {
      console.error('Error loading automation settings:', error);
      toast({
        title: "Error",
        description: "Failed to load automation settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, updates: Partial<AutomationSetting>) => {
    if (!userProfile?.org_id) return;

    try {
      const { error } = await supabase
        .from('automation_settings')
        .update(updates)
        .eq('org_id', userProfile.org_id)
        .eq('setting_key', key);

      if (error) throw error;

      setSettings(prev => ({
        ...prev,
        [key]: { ...prev[key], ...updates }
      }));

      toast({
        title: "Settings Updated",
        description: "Your automation preferences have been saved",
      });
    } catch (error: any) {
      console.error('Error updating setting:', error);
      toast({
        title: "Error",
        description: "Failed to update setting",
        variant: "destructive"
      });
    }
  };

  const triggerManual = async (type: 'match' | 'score' | 'merge') => {
    if (!userProfile?.org_id) return;

    setTriggering(type);

    try {
      let result;
      if (type === 'match') {
        const { data, error } = await supabase.rpc('match_leads_to_accounts_fast' as any, {
          p_org_id: userProfile.org_id,
          p_is_external_db: false
        });
        if (error) throw error;
        result = data;
        toast({
          title: "✓ Task Complete",
          description: `Matched ${result.total_linked} leads to accounts`,
        });
      } else if (type === 'score') {
        // Phase 3 Fix: Call bulk scoring edge function
        const { data, error } = await supabase.functions.invoke('bulk-score-accounts', {
          body: { 
            org_id: userProfile.org_id, 
            chunk_size: 5000 
          }
        });
        if (error) throw error;
        toast({
          title: "✓ Scoring Started",
          description: "Account scoring job has been queued. This may take a few minutes.",
        });
      } else if (type === 'merge') {
        const { data, error } = await supabase.rpc('merge_duplicate_accounts', {
          p_org_id: userProfile.org_id
        });
        if (error) throw error;
        result = data;
        toast({
          title: "✓ Task Complete",
          description: `Merged ${result.duplicate_accounts_merged} duplicates`,
        });
      }

      await loadSettings();
    } catch (error: any) {
      console.error(`Error triggering ${type}:`, error);
      toast({
        title: "Error",
        description: error.message || `Failed to run ${type} task`,
        variant: "destructive"
      });
    } finally {
      setTriggering(null);
    }
  };

  const formatLastRun = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading automation settings...</div>;
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Automation helps keep your data synchronized and up-to-date. Enable settings below to automate routine tasks.
        </AlertDescription>
      </Alert>

      {/* Lead-to-Account Matching */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Lead-to-Account Matching
              </CardTitle>
              <CardDescription>
                Automatically link leads to existing accounts or create new ones
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerManual('match')}
              disabled={triggering === 'match'}
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Run Now
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-match-upload">Auto-match on upload</Label>
              <p className="text-sm text-muted-foreground">
                Automatically match leads when uploading new data
              </p>
            </div>
            <Switch
              id="auto-match-upload"
              checked={settings.auto_match_on_upload?.enabled ?? true}
              onCheckedChange={(checked) => updateSetting('auto_match_on_upload', { enabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="space-y-1">
              <Label htmlFor="scheduled-match">Scheduled matching</Label>
              <p className="text-sm text-muted-foreground">
                Periodically re-match unlinked leads
              </p>
            </div>
            <Switch
              id="scheduled-match"
              checked={settings.scheduled_match?.enabled ?? false}
              onCheckedChange={(checked) => updateSetting('scheduled_match', { enabled: checked })}
            />
          </div>

          {settings.scheduled_match?.enabled && (
            <div className="space-y-2 pl-6">
              <Label htmlFor="match-frequency">Frequency</Label>
              <Select
                value={settings.scheduled_match?.schedule_frequency || 'daily'}
                onValueChange={(value) => updateSetting('scheduled_match', { schedule_frequency: value })}
              >
                <SelectTrigger id="match-frequency" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Every hour</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
            <Clock className="h-4 w-4" />
            Last run: {formatLastRun(settings.auto_match_on_upload?.last_run_at || null)}
          </div>
        </CardContent>
      </Card>

      {/* Account Scoring */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Account Scoring
              </CardTitle>
              <CardDescription>
                Automatically score accounts when they're created or updated
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerManual('score')}
              disabled={triggering === 'score'}
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              {triggering === 'score' ? 'Starting...' : 'Score Now'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-score">Auto-score new accounts</Label>
              <p className="text-sm text-muted-foreground">
                Score accounts immediately after creation
              </p>
            </div>
            <Switch
              id="auto-score"
              checked={settings.auto_score?.enabled ?? true}
              onCheckedChange={(checked) => updateSetting('auto_score', { enabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="space-y-1">
              <Label htmlFor="scheduled-score">Scheduled re-scoring</Label>
              <p className="text-sm text-muted-foreground">
                Periodically update account scores
              </p>
            </div>
            <Switch
              id="scheduled-score"
              checked={settings.scheduled_score?.enabled ?? false}
              onCheckedChange={(checked) => updateSetting('scheduled_score', { enabled: checked })}
            />
          </div>

          {settings.scheduled_score?.enabled && (
            <div className="space-y-2 pl-6">
              <Label htmlFor="score-frequency">Frequency</Label>
              <Select
                value={settings.scheduled_score?.schedule_frequency || 'daily'}
                onValueChange={(value) => updateSetting('scheduled_score', { schedule_frequency: value })}
              >
                <SelectTrigger id="score-frequency" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
            <Clock className="h-4 w-4" />
            Last run: {formatLastRun(settings.auto_score?.last_run_at || null)}
          </div>
        </CardContent>
      </Card>

      {/* Data Quality */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Data Quality
              </CardTitle>
              <CardDescription>
                Automatically maintain data hygiene and remove duplicates
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerManual('merge')}
              disabled={triggering === 'merge'}
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Run Now
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-merge">Auto-merge duplicates</Label>
              <p className="text-sm text-muted-foreground">
                Automatically merge duplicate accounts by domain
              </p>
            </div>
            <Switch
              id="auto-merge"
              checked={settings.auto_merge_duplicates?.enabled ?? false}
              onCheckedChange={(checked) => updateSetting('auto_merge_duplicates', { enabled: checked })}
            />
          </div>

          {settings.auto_merge_duplicates?.enabled && (
            <div className="space-y-2 pl-6">
              <Label htmlFor="merge-frequency">Frequency</Label>
              <Select
                value={settings.auto_merge_duplicates?.schedule_frequency || 'weekly'}
                onValueChange={(value) => updateSetting('auto_merge_duplicates', { schedule_frequency: value })}
              >
                <SelectTrigger id="merge-frequency" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
            <Clock className="h-4 w-4" />
            Last run: {formatLastRun(settings.auto_merge_duplicates?.last_run_at || null)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
