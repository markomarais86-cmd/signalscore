import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { 
  UserSearch, 
  Sparkles, 
  Target, 
  Users, 
  Info,
  ChevronDown,
  ChevronUp,
  Building2
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const DEFAULT_TARGET_TITLES = [
  'CEO', 'Chief Executive Officer',
  'CTO', 'Chief Technology Officer',
  'CFO', 'Chief Financial Officer',
  'COO', 'Chief Operating Officer',
  'CMO', 'Chief Marketing Officer',
  'VP Sales', 'VP Marketing', 'VP Engineering',
  'Director of Sales', 'Director of Marketing', 'Director of Engineering',
  'Head of Sales', 'Head of Marketing', 'Head of Engineering'
];

const TITLE_GROUPS = {
  'C-Suite': ['CEO', 'CTO', 'CFO', 'COO', 'CMO', 'CRO', 'CIO'],
  'VP Level': ['VP Sales', 'VP Marketing', 'VP Engineering', 'VP Product', 'VP Operations'],
  'Director Level': ['Director of Sales', 'Director of Marketing', 'Director of Engineering', 'Director of Product'],
  'Head of Department': ['Head of Sales', 'Head of Marketing', 'Head of Engineering', 'Head of Product', 'Head of Growth']
};

interface DiscoveryConfig {
  enabled: boolean;
  targetTitles: string[];
  maxContactsPerAccount: number;
  minFitScore: number;
}

export function EnrichmentDiscoverySettings() {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [config, setConfig] = useState<DiscoveryConfig>({
    enabled: false,
    targetTitles: ['CEO', 'CTO', 'VP Sales', 'Director of Sales'],
    maxContactsPerAccount: 5,
    minFitScore: 70
  });
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [discoveredCount, setDiscoveredCount] = useState(0);

  useEffect(() => {
    loadConfig();
    loadDiscoveredCount();
  }, [userProfile?.org_id]);

  const loadConfig = async () => {
    if (!userProfile?.org_id) return;
    
    try {
      const { data } = await supabase
        .from('automation_settings')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .eq('setting_key', 'contact_discovery')
        .maybeSingle();

      if (data) {
        // Parse stored config from schedule_frequency (used as JSON storage)
        try {
          const storedConfig = JSON.parse(data.schedule_frequency || '{}');
          setConfig({
            enabled: data.enabled,
            targetTitles: storedConfig.targetTitles || config.targetTitles,
            maxContactsPerAccount: storedConfig.maxContactsPerAccount || 5,
            minFitScore: storedConfig.minFitScore || 70
          });
        } catch {
          setConfig(prev => ({ ...prev, enabled: data.enabled }));
        }
      }
    } catch (error) {
      console.error('Error loading discovery config:', error);
    }
  };

  const loadDiscoveredCount = async () => {
    if (!userProfile?.org_id) return;
    
    try {
      const { count } = await supabase
        .from('Leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .eq('enrichment_source', 'ai_discovered');
      
      setDiscoveredCount(count || 0);
    } catch (error) {
      console.error('Error loading discovered count:', error);
    }
  };

  const saveConfig = async () => {
    if (!userProfile?.org_id) return;
    
    setIsSaving(true);
    try {
      const configJson = JSON.stringify({
        targetTitles: config.targetTitles,
        maxContactsPerAccount: config.maxContactsPerAccount,
        minFitScore: config.minFitScore
      });

      const { error } = await supabase
        .from('automation_settings')
        .upsert({
          org_id: userProfile.org_id,
          setting_key: 'contact_discovery',
          enabled: config.enabled,
          schedule_frequency: configJson,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'org_id,setting_key'
        });

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: config.enabled 
          ? "Contact discovery will run during enrichment jobs"
          : "Contact discovery is now disabled"
      });
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTitle = (title: string) => {
    setConfig(prev => ({
      ...prev,
      targetTitles: prev.targetTitles.includes(title)
        ? prev.targetTitles.filter(t => t !== title)
        : [...prev.targetTitles, title]
    }));
  };

  const toggleGroup = (groupTitles: string[]) => {
    const allSelected = groupTitles.every(t => config.targetTitles.includes(t));
    
    setConfig(prev => ({
      ...prev,
      targetTitles: allSelected
        ? prev.targetTitles.filter(t => !groupTitles.includes(t))
        : [...new Set([...prev.targetTitles, ...groupTitles])]
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserSearch className="h-5 w-5 text-primary" />
          Contact Discovery
        </CardTitle>
        <CardDescription>
          Automatically discover decision-makers at accounts during enrichment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <Label htmlFor="discovery-toggle" className="font-medium">
                Enable Contact Discovery
              </Label>
              <p className="text-sm text-muted-foreground">
                Find decision-makers when enriching accounts
              </p>
            </div>
          </div>
          <Switch
            id="discovery-toggle"
            checked={config.enabled}
            onCheckedChange={(enabled) => setConfig(prev => ({ ...prev, enabled }))}
          />
        </div>

        {/* Stats */}
        {discoveredCount > 0 && (
          <Alert>
            <Users className="h-4 w-4" />
            <AlertDescription>
              <strong>{discoveredCount.toLocaleString()}</strong> contacts discovered via AI enrichment
            </AlertDescription>
          </Alert>
        )}

        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Discovery Configuration
              </span>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-6 pt-4">
            {/* Target Titles */}
            <div className="space-y-4">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Target Job Titles
              </Label>
              <p className="text-sm text-muted-foreground">
                Select which decision-maker roles to discover at each account
              </p>
              
              {Object.entries(TITLE_GROUPS).map(([groupName, titles]) => (
                <div key={groupName} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleGroup(titles)}
                      className="h-6 px-2 text-xs"
                    >
                      {titles.every(t => config.targetTitles.includes(t)) ? 'Deselect' : 'Select'} All
                    </Button>
                    <span className="text-sm font-medium">{groupName}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 ml-4">
                    {titles.map(title => (
                      <Badge
                        key={title}
                        variant={config.targetTitles.includes(title) ? "default" : "outline"}
                        className="cursor-pointer hover:opacity-80"
                        onClick={() => toggleTitle(title)}
                      >
                        {title}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            {/* Max Contacts Per Account */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Max Contacts Per Account</Label>
                <span className="text-sm font-medium">{config.maxContactsPerAccount}</span>
              </div>
              <Slider
                value={[config.maxContactsPerAccount]}
                onValueChange={([value]) => setConfig(prev => ({ ...prev, maxContactsPerAccount: value }))}
                min={1}
                max={10}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Limit how many contacts are discovered per account (reduces AI costs)
              </p>
            </div>

            {/* Minimum Fit Score */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Minimum ICP Fit Score</Label>
                <span className="text-sm font-medium">{config.minFitScore}+</span>
              </div>
              <Slider
                value={[config.minFitScore]}
                onValueChange={([value]) => setConfig(prev => ({ ...prev, minFitScore: value }))}
                min={0}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                Only discover contacts at accounts with this fit score or higher
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            When enabled, the enrichment orchestrator will automatically discover contacts at 
            high-fit accounts. Discovered contacts are added to your Leads with source "ai_discovered".
          </AlertDescription>
        </Alert>

        {/* Save Button */}
        <Button 
          onClick={saveConfig} 
          disabled={isSaving}
          className="w-full"
        >
          {isSaving ? 'Saving...' : 'Save Discovery Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}