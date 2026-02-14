import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Save, TrendingUp, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveOrg } from '@/hooks/use-effective-org';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/utils/revenue-modeling';

export function RevenueModelingSettings() {
  const { effectiveOrgId } = useEffectiveOrg();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [acvSource, setAcvSource] = useState<string>('manual');
  const [acvValue, setAcvValue] = useState<number>(75000);
  const [winRateSource, setWinRateSource] = useState<string>('manual');
  const [winRateValue, setWinRateValue] = useState<number>(15);
  const [conservative, setConservative] = useState<number>(70);
  const [aggressive, setAggressive] = useState<number>(150);

  const { data: existing, isLoading } = useQuery({
    queryKey: ['revenue-assumptions', effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return null;
      const { data, error } = await supabase
        .from('revenue_assumptions' as any)
        .select('*')
        .eq('org_id', effectiveOrgId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!effectiveOrgId,
  });

  useEffect(() => {
    if (existing) {
      setAcvSource(existing.acv_source || 'manual');
      setAcvValue(Number(existing.acv_value) || 75000);
      setWinRateSource(existing.win_rate_source || 'manual');
      setWinRateValue(Math.round((Number(existing.win_rate_value) || 0.15) * 100));
      const scenarios = existing.scenarios || {};
      setConservative(Math.round((scenarios.conservative || 0.7) * 100));
      setAggressive(Math.round((scenarios.aggressive || 1.5) * 100));
    }
  }, [existing]);

  const handleSave = async () => {
    if (!effectiveOrgId) return;
    setSaving(true);
    try {
      const payload = {
        org_id: effectiveOrgId,
        acv_source: acvSource,
        acv_value: acvValue,
        win_rate_source: winRateSource,
        win_rate_value: winRateValue / 100,
        scenarios: {
          conservative: conservative / 100,
          base: 1.0,
          aggressive: aggressive / 100,
        },
      };

      const { error } = await supabase
        .from('revenue_assumptions' as any)
        .upsert(payload, { onConflict: 'org_id' });

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['revenue-assumptions'] });
      toast.success('Revenue assumptions saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <TrendingUp className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Revenue Modeling</h2>
          <p className="text-sm text-muted-foreground">
            Configure assumptions used in all reports and dashboards
          </p>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          These values drive TAM/SAM/SOM calculations, pipeline estimates, and board reports. 
          Upload closed-won deals to auto-calculate ACV and win rate.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        {/* ACV */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4" />
              Average Contract Value (ACV)
            </CardTitle>
            <CardDescription>
              {acvSource === 'manual' 
                ? 'Manually set — upload closed-won deals to calibrate' 
                : 'Calculated from closed-won deals'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Source</Label>
              <Select value={acvSource} onValueChange={setAcvSource}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                  <SelectItem value="closed-won">From Closed-Won Deals</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ACV Value</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={acvValue}
                  onChange={(e) => setAcvValue(Number(e.target.value))}
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Current: {formatCurrency(acvValue)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Win Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Win Rate
            </CardTitle>
            <CardDescription>
              {winRateSource === 'manual'
                ? 'Manually set — upload deal data to calibrate'
                : 'Calculated from deal pipeline'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Source</Label>
              <Select value={winRateSource} onValueChange={setWinRateSource}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                  <SelectItem value="closed-won">From Deal Pipeline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Win Rate</Label>
                <Badge variant="outline">{winRateValue}%</Badge>
              </div>
              <Slider
                value={[winRateValue]}
                min={1}
                max={100}
                step={1}
                onValueChange={(v) => setWinRateValue(v[0])}
                className="mt-2"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scenario Multipliers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scenario Multipliers</CardTitle>
          <CardDescription>
            Used in reports: Conservative / Base (1.0×) / Aggressive
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <div className="flex items-center justify-between">
                <Label>Conservative</Label>
                <Badge variant="secondary">{conservative}%</Badge>
              </div>
              <Slider
                value={[conservative]}
                min={30}
                max={100}
                step={5}
                onValueChange={(v) => setConservative(v[0])}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Pipeline × {(conservative / 100).toFixed(2)} = {formatCurrency(acvValue * (conservative / 100))} per account
              </p>
            </div>
            <div className="text-center">
              <Label>Base</Label>
              <div className="text-2xl font-bold mt-2">1.0×</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(acvValue)} per account
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Aggressive</Label>
                <Badge variant="secondary">{aggressive}%</Badge>
              </div>
              <Slider
                value={[aggressive]}
                min={100}
                max={300}
                step={10}
                onValueChange={(v) => setAggressive(v[0])}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Pipeline × {(aggressive / 100).toFixed(2)} = {formatCurrency(acvValue * (aggressive / 100))} per account
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Assumptions'}
        </Button>
      </div>
    </div>
  );
}
