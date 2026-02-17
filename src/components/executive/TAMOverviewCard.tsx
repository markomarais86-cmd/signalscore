import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { TrendingUp, Target, DollarSign, Database, RefreshCw, Loader2 } from "lucide-react";
import { formatCurrency, formatAbbreviated } from "@/utils/format-numbers";
import { calculateExternalTAMMetrics } from "@/utils/external-tam-calculator";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";

interface TAMData {
  provider: string;
  totalAccounts: number;
  totalContacts: number;
  industryBreakdown: Record<string, { accounts: number; contacts: number }>;
  geographyBreakdown: Record<string, { accounts: number; contacts: number }>;
  lastSyncedAt: string | null;
}

interface ICPData {
  industries: string[];
  geographies: string[];
}

export function TAMOverviewCard() {
  const { userProfile } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: tamData, refetch } = useQuery({
    queryKey: ['tam-data', userProfile?.org_id],
    queryFn: async (): Promise<TAMData | null> => {
      if (!userProfile?.org_id) return null;

      const { data, error } = await supabase
        .from('external_data_sources')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .eq('provider', 'apollo')
        .single();

      if (error || !data) return null;

      return {
        provider: data.provider,
        totalAccounts: data.total_accounts || 0,
        totalContacts: data.total_contacts || 0,
        industryBreakdown: (data.industry_breakdown as Record<string, { accounts: number; contacts: number }>) || {},
        geographyBreakdown: (data.geography_breakdown as Record<string, { accounts: number; contacts: number }>) || {},
        lastSyncedAt: data.last_synced_at
      };
    },
    enabled: !!userProfile?.org_id
  });

  const { data: icpData } = useQuery({
    queryKey: ['icp-data', userProfile?.org_id],
    queryFn: async (): Promise<ICPData | null> => {
      if (!userProfile?.org_id) return null;

      const { data, error } = await supabase
        .from('icp_profiles')
        .select('industries, geographies')
        .eq('org_id', userProfile.org_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      return {
        industries: (data.industries as string[]) || [],
        geographies: (data.geographies as string[]) || []
      };
    },
    enabled: !!userProfile?.org_id
  });

  const { data: crmStats } = useQuery({
    queryKey: ['crm-stats', userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) return { total: 0, highFit: 0 };

      const { count: total } = await supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id);

      const { count: highFit } = await supabase
        .from('scores')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .gte('fit_score', 70);

      return { total: total || 0, highFit: highFit || 0 };
    },
    enabled: !!userProfile?.org_id
  });

  const handleSyncTAM = async () => {
    if (!userProfile?.org_id) return;
    
    setIsSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('sync-external-provider', {
        body: { org_id: userProfile.org_id, provider: 'apollo' }
      });

      if (error) throw error;

      toast.success('Apollo TAM data synced successfully');
      refetch();
    } catch (error: any) {
      console.error('Error syncing TAM:', error);
      toast.error(error.message || 'Failed to sync TAM data');
    } finally {
      setIsSyncing(false);
    }
  };

  // Calculate TAM/SAM/SOM
  const averageDealSize = 75000; // TODO: wire to useOrgSettings when this component is used standalone
  
  const externalTAM = (tamData?.totalAccounts || 0) * averageDealSize;
  
  const { sam, som } = tamData ? calculateExternalTAMMetrics(
    {
      totalAccounts: tamData.totalAccounts,
      totalLeads: tamData.totalContacts,
      provider: tamData.provider,
      industry_breakdown: tamData.industryBreakdown,
      geography_breakdown: tamData.geographyBreakdown
    },
    icpData ? { industries: icpData.industries, geographies: icpData.geographies } : null
  ) : { sam: 0, som: 0 };

  const samValue = sam * averageDealSize;
  const somValue = som * averageDealSize;

  const penetration = tamData?.totalAccounts && crmStats?.total
    ? (crmStats.total / tamData.totalAccounts) * 100
    : 0;

  // Get top industries and geographies
  const topIndustries = Object.entries(tamData?.industryBreakdown || {})
    .sort((a, b) => b[1].accounts - a[1].accounts)
    .slice(0, 3);

  const topGeographies = Object.entries(tamData?.geographyBreakdown || {})
    .sort((a, b) => b[1].accounts - a[1].accounts)
    .slice(0, 3);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-medium text-muted-foreground">
              Market Intelligence
            </CardTitle>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-3xl font-bold text-primary">
                {formatCurrency(externalTAM || 0)}
              </span>
              <Badge variant="outline" className="text-xs">
                via {tamData?.provider || 'Apollo'}
              </Badge>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncTAM}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Sync</span>
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* TAM/SAM/SOM Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1 bg-muted/30 rounded-lg p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Database className="h-3 w-3" />
              TAM
            </div>
            <div className="text-lg font-bold">{formatCurrency(externalTAM)}</div>
            <div className="text-xs text-muted-foreground">
              {formatAbbreviated(tamData?.totalAccounts || 0)} accounts
            </div>
          </div>

          <div className="space-y-1 bg-primary/10 rounded-lg p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Target className="h-3 w-3" />
              SAM
            </div>
            <div className="text-lg font-bold text-primary">{formatCurrency(samValue)}</div>
            <div className="text-xs text-muted-foreground">
              {formatAbbreviated(sam)} ICP-fit
            </div>
          </div>

          <div className="space-y-1 bg-green-500/10 rounded-lg p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              SOM
            </div>
            <div className="text-lg font-bold text-green-600">{formatCurrency(somValue)}</div>
            <div className="text-xs text-muted-foreground">
              {formatAbbreviated(som)} 12mo target
            </div>
          </div>
        </div>

        {/* Market Penetration */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Market Penetration</span>
            <span className="font-medium">{penetration.toFixed(2)}%</span>
          </div>
          <Progress value={Math.min(penetration * 10, 100)} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {formatAbbreviated(crmStats?.total || 0)} accounts in CRM of {formatAbbreviated(tamData?.totalAccounts || 0)} total market
          </p>
        </div>

        {/* Top Markets */}
        {topGeographies.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium">Top Markets</p>
            <div className="flex flex-wrap gap-2">
              {topGeographies.map(([geo, data]) => (
                <Badge key={geo} variant="secondary" className="text-xs">
                  {geo}: {formatAbbreviated(data.accounts)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Top Industries */}
        {topIndustries.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium">Top Industries</p>
            <div className="flex flex-wrap gap-2">
              {topIndustries.map(([ind, data]) => (
                <Badge key={ind} variant="outline" className="text-xs">
                  {ind}: {formatAbbreviated(data.accounts)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Last Synced */}
        {tamData?.lastSyncedAt && (
          <p className="text-xs text-muted-foreground pt-2 border-t">
            Last synced: {new Date(tamData.lastSyncedAt).toLocaleDateString()}
          </p>
        )}

        {!tamData?.totalAccounts && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm text-amber-600">
              No TAM data synced yet. Click "Sync" to fetch market data from Apollo based on your ICP.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
