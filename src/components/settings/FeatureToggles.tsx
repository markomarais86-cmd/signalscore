import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function FeatureToggles() {
  const { flags, isLoading, updateFlag } = useFeatureFlags();

  const handleToggle = async (key: keyof typeof flags, enabled: boolean) => {
    try {
      await updateFlag(key, enabled);
      toast.success(`${key.replace(/_/g, ' ')} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to update feature flag');
    }
  };

  const features = [
    {
      key: 'icp_manager' as const,
      label: 'ICP Manager',
      description: 'Manage ideal customer profiles and templates'
    },
    {
      key: 'icp_tam_intelligence' as const,
      label: 'ICP + TAM Intelligence',
      description: 'Total addressable market analysis and insights'
    },
    {
      key: 'personas_segments' as const,
      label: 'Personas & Segments',
      description: 'Buyer persona segmentation and targeting'
    },
    {
      key: 'pipeline_efficiency' as const,
      label: 'Pipeline Efficiency',
      description: 'Sales pipeline performance metrics'
    },
    {
      key: 'capital_efficiency' as const,
      label: 'Capital Efficiency',
      description: 'CAC, LTV, and capital efficiency analytics'
    },
    {
      key: 'ai_agents' as const,
      label: 'AI Agents & ML',
      description: 'AI-powered agents and machine learning features'
    },
    {
      key: 'demo_mode' as const,
      label: 'Demo Mode',
      description: 'Show static demo data for demonstrations'
    }
  ];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Feature Toggles</CardTitle>
          <CardDescription>Control which modules are enabled</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Toggles</CardTitle>
        <CardDescription>
          Control which modules are enabled for your organization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {features.map((feature) => (
          <div key={feature.key} className="flex items-center justify-between space-x-4">
            <div className="flex-1">
              <Label htmlFor={feature.key} className="text-base font-medium">
                {feature.label}
              </Label>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
            <Switch
              id={feature.key}
              checked={flags[feature.key]}
              onCheckedChange={(checked) => handleToggle(feature.key, checked)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
