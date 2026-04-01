import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveOrg } from '@/hooks/use-effective-org';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface EnrichmentFailure {
  id: string;
  account_external_id: string;
  account_name: string | null;
  error_message: string | null;
  error_details: Record<string, any> | null;
  retry_count: number | null;
  trigger_type: string | null;
  created_at: string | null;
  last_retry_at: string | null;
  org_id: string;
}

export function EnrichmentFailureTracker() {
  const { effectiveOrgId } = useEffectiveOrg();
  const queryClient = useQueryClient();
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  const { data: failures = [], isLoading } = useQuery({
    queryKey: ['enrichment-failures', effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return [];
      const { data, error } = await supabase
        .from('auto_score_failures')
        .select('*')
        .eq('org_id', effectiveOrgId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as EnrichmentFailure[];
    },
    enabled: !!effectiveOrgId,
    refetchInterval: 30000,
  });

  const retryMutation = useMutation({
    mutationFn: async (failureId: string) => {
      const failure = failures.find(f => f.id === failureId);
      if (!failure) throw new Error('Failure not found');

      // Update retry count and timestamp
      const { error } = await supabase
        .from('auto_score_failures')
        .update({
          retry_count: (failure.retry_count || 0) + 1,
          last_retry_at: new Date().toISOString(),
        })
        .eq('id', failureId);
      if (error) throw error;

      // Trigger re-enrichment via the enrich-unified function
      const { error: fnError } = await supabase.functions.invoke('enrich-unified', {
        body: {
          account_external_ids: [failure.account_external_id],
          org_id: effectiveOrgId,
          force: true,
        },
      });
      if (fnError) throw fnError;
    },
    onSuccess: (_, failureId) => {
      setRetryingIds(prev => { const next = new Set(prev); next.delete(failureId); return next; });
      queryClient.invalidateQueries({ queryKey: ['enrichment-failures'] });
      toast.success('Retry triggered successfully');
    },
    onError: (err: Error, failureId) => {
      setRetryingIds(prev => { const next = new Set(prev); next.delete(failureId); return next; });
      toast.error(`Retry failed: ${err.message}`);
    },
  });

  const handleRetry = (id: string) => {
    setRetryingIds(prev => new Set(prev).add(id));
    retryMutation.mutate(id);
  };

  const handleRetryAll = () => {
    failures.slice(0, 10).forEach(f => handleRetry(f.id));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Loading failure data...
        </CardContent>
      </Card>
    );
  }

  if (failures.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-2">
          <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
          <p className="text-sm font-medium">No enrichment failures</p>
          <p className="text-xs text-muted-foreground">All accounts processed successfully</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Enrichment Failures ({failures.length})
          </CardTitle>
          <Button size="sm" variant="outline" onClick={handleRetryAll} disabled={retryingIds.size > 0}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Retry All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[400px] overflow-auto">
        {failures.map((failure) => (
          <div
            key={failure.id}
            className="flex items-start justify-between p-3 rounded-md border bg-card text-sm"
          >
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                <span className="font-medium truncate">
                  {failure.account_name || failure.account_external_id}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate pl-5">
                {failure.error_message || 'Unknown error'}
              </p>
              <div className="flex items-center gap-2 pl-5">
                {failure.trigger_type && (
                  <Badge variant="outline" className="text-[10px] h-4">
                    {failure.trigger_type}
                  </Badge>
                )}
                {(failure.retry_count || 0) > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4">
                    {failure.retry_count} retries
                  </Badge>
                )}
                {failure.created_at && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(parseISO(failure.created_at), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 ml-2"
              onClick={() => handleRetry(failure.id)}
              disabled={retryingIds.has(failure.id)}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${retryingIds.has(failure.id) ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
