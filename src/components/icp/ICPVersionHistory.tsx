import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, GitBranch } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface ICPVersionHistoryProps {
  icpId: string;
  orgId: string;
  currentVersion?: number;
}

export function ICPVersionHistory({ icpId, orgId, currentVersion }: ICPVersionHistoryProps) {
  const { data: versions, isLoading } = useQuery({
    queryKey: ['icp-versions', icpId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('icp_versions' as any)
        .select('*')
        .eq('icp_id', icpId)
        .eq('org_id', orgId)
        .order('version', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!icpId && !!orgId,
  });

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (!versions || versions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
          No version history yet. Versions are created when you update the ICP.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4" />
          Version History
        </CardTitle>
        <CardDescription>
          Current version: v{currentVersion || 1}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {versions.map((v: any) => {
            const snapshot = v.snapshot || {};
            const industriesCount = (snapshot.industries || []).length;
            const sizesCount = (snapshot.company_sizes || []).length;
            const isCurrent = v.version === currentVersion;

            return (
              <div
                key={v.id}
                className={`p-3 rounded-lg border ${isCurrent ? 'border-primary bg-primary/5' : 'border-border'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={isCurrent ? 'default' : 'outline'} className="text-xs">
                      v{v.version}
                    </Badge>
                    <span className="text-sm font-medium">{snapshot.name || 'Unnamed'}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(v.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>{industriesCount} industries</span>
                  <span>{sizesCount} sizes</span>
                  <span>Status: {snapshot.status || 'draft'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
