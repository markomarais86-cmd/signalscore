import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Flag, RefreshCw, Building } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Organization {
  id: string;
  name: string;
}

interface FeatureFlag {
  feature_key: string;
  enabled: boolean;
}

const FEATURE_FLAG_LABELS: Record<string, { label: string; description: string; phase: string }> = {
  icp_manager: { label: "ICP Manager", description: "Manage Ideal Customer Profiles", phase: "MVP" },
  icp_tam_intelligence: { label: "TAM Intelligence", description: "Market sizing and TAM analysis", phase: "MVP" },
  personas_segments: { label: "Personas & Segments", description: "Define buyer personas", phase: "Growth" },
  pipeline_efficiency: { label: "Pipeline Efficiency", description: "Pipeline analytics", phase: "Labs" },
  capital_efficiency: { label: "Capital Efficiency", description: "Investment tracking", phase: "Labs" },
  ai_agents: { label: "AI Agents", description: "Automated AI workflows", phase: "Growth" },
  demo_mode: { label: "Demo Mode", description: "Demo data for testing", phase: "Labs" },
  custom_reports: { label: "Custom Reports", description: "Build custom reports", phase: "Labs" },
  cohort_analysis: { label: "Cohort Analysis", description: "Analyze customer cohorts", phase: "Labs" },
  predictive_scoring: { label: "Predictive Scoring", description: "AI-powered scoring", phase: "Labs" },
  advanced_segmentation: { label: "Advanced Segmentation", description: "Complex segmentation rules", phase: "Labs" },
  trend_analysis: { label: "Trend Analysis", description: "Analyze trends over time", phase: "Labs" },
  data_enrichment: { label: "Data Enrichment", description: "Account and contact enrichment", phase: "MVP" },
};

export function OrganizationFeatureFlags({ organizations }: { organizations: Organization[] }) {
  const { toast } = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (selectedOrgId) {
      loadFlagsForOrg(selectedOrgId);
    }
  }, [selectedOrgId]);

  const loadFlagsForOrg = async (orgId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('feature_key, enabled')
        .eq('org_id', orgId);

      if (error) throw error;
      setFlags(data || []);
    } catch (error) {
      console.error('Error loading flags:', error);
      toast({
        title: "Error",
        description: "Failed to load feature flags",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFlag = async (featureKey: string, enabled: boolean) => {
    if (!selectedOrgId) return;
    
    setUpdating(featureKey);
    try {
      const { error } = await supabase
        .from('feature_flags')
        .upsert({
          org_id: selectedOrgId,
          feature_key: featureKey,
          enabled
        }, {
          onConflict: 'org_id,feature_key'
        });

      if (error) throw error;

      setFlags(prev => {
        const existing = prev.find(f => f.feature_key === featureKey);
        if (existing) {
          return prev.map(f => f.feature_key === featureKey ? { ...f, enabled } : f);
        }
        return [...prev, { feature_key: featureKey, enabled }];
      });

      toast({
        title: "Feature Updated",
        description: `${FEATURE_FLAG_LABELS[featureKey]?.label || featureKey} ${enabled ? 'enabled' : 'disabled'}`
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUpdating(null);
    }
  };

  const getFlagValue = (featureKey: string): boolean => {
    const flag = flags.find(f => f.feature_key === featureKey);
    if (flag) return flag.enabled;
    // Return default values for flags not explicitly set
    const defaults: Record<string, boolean> = {
      icp_manager: true,
      icp_tam_intelligence: true,
      personas_segments: true,
      ai_agents: true,
      data_enrichment: true,
    };
    return defaults[featureKey] ?? false;
  };

  const getPhaseBadge = (phase: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      "MVP": "default",
      "Growth": "secondary",
      "Labs": "outline"
    };
    return <Badge variant={variants[phase] || "outline"} className="text-xs">{phase}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flag className="h-5 w-5" />
          Per-Organization Feature Flags
        </CardTitle>
        <CardDescription>
          Enable or disable features for specific customer organizations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Organization Selector */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building className="h-4 w-4" />
            <span className="text-sm font-medium">Organization:</span>
          </div>
          <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select an organization" />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedOrgId && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => loadFlagsForOrg(selectedOrgId)}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Feature Flags List */}
        {!selectedOrgId ? (
          <div className="text-center py-8 text-muted-foreground">
            <Flag className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Select an organization to manage its feature flags</p>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {Object.entries(FEATURE_FLAG_LABELS).map(([key, config]) => (
              <div 
                key={key} 
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getPhaseBadge(config.phase)}
                  <div>
                    <p className="font-medium text-sm">{config.label}</p>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  </div>
                </div>
                <Switch
                  checked={getFlagValue(key)}
                  onCheckedChange={(enabled) => handleToggleFlag(key, enabled)}
                  disabled={updating === key}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
