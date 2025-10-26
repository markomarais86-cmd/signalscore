import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { toast } from "sonner";
import { Loader2, Rocket, Zap, TrendingUp, Sparkles } from "lucide-react";

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

  const featurePhases = [
    {
      phase: 'Phase 1 - MVP (Live)',
      badge: 'LIVE',
      icon: Rocket,
      description: 'Core TAM intelligence features - always available',
      features: [
        {
          key: 'icp_manager' as const,
          label: 'ICP Manager',
          description: 'Define and manage Ideal Customer Profiles',
        },
        {
          key: 'icp_tam_intelligence' as const,
          label: 'TAM Intelligence',
          description: 'Coverage analysis, whitespace, and TAM estimation',
        },
      ]
    },
    {
      phase: 'Phase 2 - Scoring & Reporting',
      badge: 'LABS',
      icon: Zap,
      description: 'Advanced scoring engine and board-ready reporting',
      features: [
        {
          key: 'personas_segments' as const,
          label: 'Personas & Segments',
          description: 'Advanced persona segmentation and analysis',
        },
      ]
    },
    {
      phase: 'Phase 3 - Pipeline Intelligence',
      badge: 'LABS',
      icon: TrendingUp,
      description: 'Pipeline efficiency and conversion analytics',
      features: [
        {
          key: 'pipeline_efficiency' as const,
          label: 'Pipeline Efficiency',
          description: 'Funnel analysis and conversion benchmarks',
        },
        {
          key: 'capital_efficiency' as const,
          label: 'Capital Efficiency',
          description: 'ROI tracking and capital allocation metrics',
        },
      ]
    },
    {
      phase: 'Phase 4 - AI Propensity',
      badge: 'FUTURE',
      icon: Sparkles,
      description: 'AI-powered propensity models and recommendations',
      features: [
        {
          key: 'ai_agents' as const,
          label: 'AI Agents & ML',
          description: 'Propensity scoring and intelligent automation',
        },
      ]
    },
    {
      phase: 'Phase 6 - Advanced Analytics',
      badge: 'LABS',
      icon: TrendingUp,
      description: 'Custom reporting, cohort analysis, and predictive models',
      features: [
        {
          key: 'custom_reports' as const,
          label: 'Custom Reports',
          description: 'Build and schedule custom reports',
        },
        {
          key: 'cohort_analysis' as const,
          label: 'Cohort Analysis',
          description: 'Analyze account cohorts and lifetime value',
        },
        {
          key: 'predictive_scoring' as const,
          label: 'Predictive Scoring v2',
          description: 'ML-powered propensity scoring models',
        },
        {
          key: 'advanced_segmentation' as const,
          label: 'Advanced Segmentation',
          description: 'Create dynamic account segments',
        },
        {
          key: 'trend_analysis' as const,
          label: 'Trend Analysis',
          description: 'Historical trends and forecasting',
        },
      ]
    },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Labs & Feature Phases</CardTitle>
          <CardDescription>
            Enable upcoming features as they become available. MVP features are always active.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {featurePhases.map((phase) => {
            const PhaseIcon = phase.icon;
            return (
              <div key={phase.phase} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <PhaseIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{phase.phase}</h3>
                      <Badge variant={phase.badge === 'LIVE' ? 'default' : phase.badge === 'LABS' ? 'secondary' : 'outline'}>
                        {phase.badge}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{phase.description}</p>
                  </div>
                </div>
                <div className="ml-11 space-y-4 border-l-2 border-muted pl-6">
                  {phase.features.map((feature) => (
                    <div key={feature.key} className="flex items-center justify-between space-x-4">
                      <div className="flex-1 space-y-1">
                        <Label 
                          htmlFor={feature.key} 
                          className={`text-sm font-medium ${phase.badge === 'LIVE' ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                          {feature.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                      <Switch
                        id={feature.key}
                        checked={flags[feature.key]}
                        onCheckedChange={(checked) => handleToggle(feature.key, checked)}
                        disabled={phase.badge === 'LIVE'}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Demo Mode</CardTitle>
          <CardDescription>
            Enable demo mode to populate the app with sample data for testing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="demo_mode" className="text-base font-medium">
                Demo Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically generate sample accounts, ICPs, and scores
              </p>
            </div>
            <Switch
              id="demo_mode"
              checked={flags.demo_mode}
              onCheckedChange={(checked) => handleToggle('demo_mode', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
