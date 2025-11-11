import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, HelpCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface FeatureWeight {
  feature_name: string;
  r_value: number;
  p_value: number;
  weight: number;
  is_significant: boolean;
  sample_size: number;
}

interface FeatureImportanceCardProps {
  icpId?: string;
}

export function FeatureImportanceCard({ icpId }: FeatureImportanceCardProps) {
  const { userProfile } = useAuth();
  const [weights, setWeights] = useState<FeatureWeight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.org_id) {
      loadWeights();
    }
  }, [userProfile?.org_id, icpId]);

  const loadWeights = async () => {
    if (!userProfile?.org_id) return;

    setLoading(true);
    try {
      let query = supabase
        .from('icp_feature_weights')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .order('weight', { ascending: false });

      if (icpId) {
        query = query.eq('icp_id', icpId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setWeights(data || []);
    } catch (error) {
      console.error('Error loading feature weights:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFeatureLabel = (name: string) => {
    const labels: Record<string, string> = {
      industry: 'Industry Match',
      size: 'Company Size',
      revenue: 'Revenue Range',
      geography: 'Geographic Location',
      contacts: 'Contact Availability',
      data_quality: 'Data Completeness'
    };
    return labels[name] || name;
  };

  const getSignificanceLabel = (pValue: number) => {
    if (pValue < 0.01) return 'Highly Significant';
    if (pValue < 0.05) return 'Significant';
    if (pValue < 0.1) return 'Relevant';
    return 'Not Significant';
  };

  const getSignificanceColor = (pValue: number) => {
    if (pValue < 0.05) return 'text-green-600 dark:text-green-400';
    if (pValue < 0.1) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-muted-foreground';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Feature Importance</CardTitle>
          <CardDescription>Loading correlation weights...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (weights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Feature Importance</CardTitle>
          <CardDescription>Run correlation analysis to see which factors predict closed-won deals</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No feature weights available yet. Analyze your closed-won deals to generate predictive weights.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get max weight for normalization
  const maxWeight = Math.max(...weights.map(w => w.weight));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Feature Importance</CardTitle>
            <CardDescription>
              Statistical correlation with closed-won deals (n={weights[0]?.sample_size || 0})
            </CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Weight = |correlation| × (1 - p-value). Higher weights indicate stronger predictive power.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {weights.map((weight) => (
            <div key={weight.feature_name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{getFeatureLabel(weight.feature_name)}</span>
                  {weight.r_value > 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={getSignificanceColor(weight.p_value)}
                  >
                    {getSignificanceLabel(weight.p_value)}
                  </Badge>
                  <span className="text-sm font-semibold tabular-nums">
                    {weight.weight.toFixed(3)}
                  </span>
                </div>
              </div>
              
              <Progress 
                value={(weight.weight / maxWeight) * 100} 
                className="h-2"
              />
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>r = {weight.r_value.toFixed(3)}</span>
                <span>p = {weight.p_value.toFixed(4)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
