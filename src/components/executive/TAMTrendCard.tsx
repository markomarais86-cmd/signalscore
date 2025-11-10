import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Database, Users } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatNumber } from "@/utils/format-numbers";

interface TAMTrendCardProps {
  currentTAM?: {
    totalAccounts: number;
    totalContacts: number;
    provider: string;
    lastSyncedAt?: string;
  };
}

export function TAMTrendCard({ currentTAM }: TAMTrendCardProps) {
  const { userProfile } = useAuth();

  const { data: historicalTAM, isLoading } = useQuery({
    queryKey: ['tam-history', userProfile?.org_id],
    queryFn: async () => {
      if (!userProfile?.org_id) return [];

      const { data, error } = await supabase
        .from('weekly_analytics_snapshots')
        .select('snapshot_date, tam_accounts, created_at')
        .eq('org_id', userProfile.org_id)
        .order('snapshot_date', { ascending: true })
        .limit(12);

      if (error) throw error;

      return data.map(d => ({
        date: new Date(d.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        accounts: d.tam_accounts,
      }));
    },
    enabled: !!userProfile?.org_id,
  });

  const previousTAM = historicalTAM && historicalTAM.length > 1 
    ? historicalTAM[historicalTAM.length - 2]?.accounts 
    : null;
  
  const tamDelta = currentTAM && previousTAM 
    ? currentTAM.totalAccounts - previousTAM 
    : 0;
  
  const tamGrowthPct = previousTAM && currentTAM
    ? ((tamDelta / previousTAM) * 100).toFixed(1)
    : '0';

  const isPositiveGrowth = tamDelta >= 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              TAM Evolution
            </CardTitle>
            <CardDescription>
              Total Addressable Market from {currentTAM?.provider || 'External Data'}
            </CardDescription>
          </div>
          {currentTAM && previousTAM && (
            <div className={`flex items-center gap-1 text-sm font-medium ${isPositiveGrowth ? 'text-green-600' : 'text-red-600'}`}>
              {isPositiveGrowth ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>{isPositiveGrowth ? '+' : ''}{tamGrowthPct}%</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Database className="h-4 w-4" />
              Total Accounts
            </div>
            <div className="text-2xl font-bold">
              {formatNumber(currentTAM?.totalAccounts || 0)}
            </div>
            {tamDelta !== 0 && (
              <div className={`text-xs ${isPositiveGrowth ? 'text-green-600' : 'text-red-600'}`}>
                {isPositiveGrowth ? '+' : ''}{formatNumber(tamDelta)} vs last sync
              </div>
            )}
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Total Contacts
            </div>
            <div className="text-2xl font-bold">
              {formatNumber(currentTAM?.totalContacts || 0)}
            </div>
            {currentTAM?.lastSyncedAt && (
              <div className="text-xs text-muted-foreground">
                Last sync: {new Date(currentTAM.lastSyncedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : historicalTAM && historicalTAM.length > 1 ? (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicalTAM}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(value) => formatNumber(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [formatNumber(value), 'TAM Accounts']}
                />
                <Line
                  type="monotone"
                  dataKey="accounts"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No historical TAM data yet</p>
              <p className="text-xs mt-1">Data will appear after weekly snapshots</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
