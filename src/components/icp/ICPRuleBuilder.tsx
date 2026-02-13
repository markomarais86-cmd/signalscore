import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useEffectiveOrg } from '@/hooks/use-effective-org';
import { useToast } from '@/hooks/use-toast';
import { Save, RotateCcw, RefreshCw, HelpCircle, TrendingUp, AlertTriangle } from 'lucide-react';

interface WeightConfig {
  feature_name: string;
  weight: number;
  label: string;
  description: string;
}

const DEFAULT_WEIGHTS: WeightConfig[] = [
  { feature_name: 'industry', weight: 0.25, label: 'Industry Match', description: 'How well the account industry aligns with your ICP' },
  { feature_name: 'size', weight: 0.25, label: 'Company Size', description: 'Employee count fit within your target range' },
  { feature_name: 'geography', weight: 0.20, label: 'Geography', description: 'Location match against your target markets' },
  { feature_name: 'revenue', weight: 0.15, label: 'Revenue Range', description: 'Revenue band alignment with your ICP' },
  { feature_name: 'contacts', weight: 0.10, label: 'Contact Coverage', description: 'Availability of decision-maker contacts' },
  { feature_name: 'data_quality', weight: 0.05, label: 'Data Completeness', description: 'Overall data quality and enrichment level' },
];

interface ICPRuleBuilderProps {
  icpId: string;
}

export function ICPRuleBuilder({ icpId }: ICPRuleBuilderProps) {
  const { userProfile } = useAuth();
  const { effectiveOrgId } = useEffectiveOrg();
  const { toast } = useToast();
  const [weights, setWeights] = useState<WeightConfig[]>(DEFAULT_WEIGHTS);
  const [savedWeights, setSavedWeights] = useState<WeightConfig[]>(DEFAULT_WEIGHTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rescoring, setRescoring] = useState(false);

  const orgId = effectiveOrgId || userProfile?.org_id;

  useEffect(() => {
    if (orgId && icpId) loadWeights();
  }, [orgId, icpId]);

  const loadWeights = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('icp_feature_weights')
        .select('feature_name, weight')
        .eq('org_id', orgId)
        .eq('icp_id', icpId);

      if (error) throw error;

      if (data && data.length > 0) {
        const merged = DEFAULT_WEIGHTS.map(dw => {
          const found = data.find(d => d.feature_name === dw.feature_name);
          return found ? { ...dw, weight: Number(found.weight) } : dw;
        });
        setWeights(merged);
        setSavedWeights(merged);
      }
    } catch (error) {
      console.error('Error loading weights:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  const isBalanced = Math.abs(totalWeight - 1.0) < 0.01;
  const hasChanges = JSON.stringify(weights) !== JSON.stringify(savedWeights);

  const handleWeightChange = (featureName: string, newValue: number) => {
    setWeights(prev => prev.map(w =>
      w.feature_name === featureName ? { ...w, weight: newValue } : w
    ));
  };

  const normalizeWeights = () => {
    if (totalWeight === 0) return;
    setWeights(prev => prev.map(w => ({
      ...w,
      weight: Math.round((w.weight / totalWeight) * 100) / 100
    })));
  };

  const resetWeights = () => {
    setWeights(savedWeights);
  };

  const saveWeights = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      // Delete existing weights for this ICP then insert fresh
      await supabase
        .from('icp_feature_weights')
        .delete()
        .eq('org_id', orgId)
        .eq('icp_id', icpId);

      const rows = weights.map(w => ({
        org_id: orgId,
        icp_id: icpId,
        feature_name: w.feature_name,
        weight: w.weight,
        r_value: 0,
        p_value: 1,
        is_significant: false,
        computed_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('icp_feature_weights')
        .insert(rows);

      if (error) throw error;

      setSavedWeights([...weights]);
      toast({ title: 'Weights Saved', description: 'Scoring weights updated successfully' });
    } catch (error: any) {
      console.error('Error saving weights:', error);
      toast({ title: 'Error', description: 'Failed to save weights', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const triggerRescore = async () => {
    if (!orgId) return;
    setRescoring(true);
    try {
      const { error } = await supabase.functions.invoke('bulk-score-accounts', {
        body: { org_id: orgId, icp_id: icpId, chunk_size: 5000 }
      });
      if (error) throw error;
      toast({ title: 'Rescoring Started', description: 'Accounts are being rescored in the background' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to start rescoring', variant: 'destructive' });
    } finally {
      setRescoring(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scoring Weights</CardTitle>
          <CardDescription>Loading weight configuration...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Scoring Weights
            </CardTitle>
            <CardDescription>
              Adjust how much each dimension contributes to the overall fit score
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!isBalanced && (
              <Button variant="outline" size="sm" onClick={normalizeWeights}>
                Auto-Balance
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={resetWeights} disabled={!hasChanges}>
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
            <Button size="sm" onClick={saveWeights} disabled={!hasChanges || saving}>
              <Save className="h-3 w-3 mr-1" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Weight Indicator */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <span className="text-sm font-medium">Total Weight</span>
          <div className="flex items-center gap-2">
            {!isBalanced && (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            )}
            <Badge variant={isBalanced ? 'default' : 'destructive'}>
              {totalWeight.toFixed(2)} / 1.00
            </Badge>
          </div>
        </div>

        {/* Weight Sliders */}
        <TooltipProvider>
          <div className="space-y-6">
            {weights.map((w) => (
              <div key={w.feature_name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{w.label}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs max-w-48">{w.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="text-sm font-mono tabular-nums text-muted-foreground">
                    {(w.weight * 100).toFixed(0)}%
                  </span>
                </div>
                <Slider
                  value={[w.weight]}
                  min={0}
                  max={0.5}
                  step={0.01}
                  onValueChange={([val]) => handleWeightChange(w.feature_name, val)}
                />
              </div>
            ))}
          </div>
        </TooltipProvider>

        {/* Rescore Button */}
        <div className="pt-4 border-t">
          <Button
            variant="outline"
            className="w-full"
            onClick={triggerRescore}
            disabled={rescoring || hasChanges}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${rescoring ? 'animate-spin' : ''}`} />
            {rescoring ? 'Rescoring...' : hasChanges ? 'Save weights first to rescore' : 'Rescore All Accounts'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
