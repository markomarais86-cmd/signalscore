import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search,
  ChevronRight,
  RefreshCw,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { formatNumber } from "@/utils/format-numbers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function EnrichmentHistoryViewer() {
  const { userProfile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [selectedHistory, setSelectedHistory] = useState<any>(null);

  const { data: historyData, isLoading, refetch } = useQuery({
    queryKey: ['enrichment-history', userProfile?.org_id, statusFilter, providerFilter],
    queryFn: async () => {
      if (!userProfile?.org_id) throw new Error('No org ID');

      let query = supabase
        .from('enrichment_history')
        .select('*, accounts(name, domain)')
        .eq('org_id', userProfile.org_id)
        .order('created_at', { ascending: false })
        .limit(100) as any;

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (providerFilter !== 'all') {
        query = query.eq('provider', providerFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!userProfile?.org_id,
  });

  const handleRetryEnrichment = async (historyRecord: any) => {
    try {
      toast.info('Retrying enrichment...');
      
      const { error } = await supabase.functions.invoke('process-enrichment', {
        body: {
          org_id: userProfile?.org_id,
          job_id: historyRecord.job_id,
          account_ids: [historyRecord.account_external_id],
          provider: historyRecord.provider,
        }
      });

      if (error) throw error;
      
      toast.success('Enrichment retry started');
      refetch();
    } catch (error: any) {
      toast.error('Failed to retry enrichment: ' + error.message);
    }
  };

  const filteredHistory = historyData?.filter((h: any) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      h.account_external_id?.toLowerCase().includes(searchLower) ||
      h.accounts?.name?.toLowerCase().includes(searchLower) ||
      h.accounts?.domain?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      success: { variant: 'default', icon: CheckCircle, text: 'Success' },
      failed: { variant: 'destructive', icon: XCircle, text: 'Failed' },
      partial: { variant: 'outline', icon: AlertCircle, text: 'Partial' },
    };
    const config = variants[status] || variants.failed;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Enrichment History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Enrichment History
          </CardTitle>
          <CardDescription>
            Detailed log of all enrichment attempts with before/after comparisons
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
              </SelectContent>
            </Select>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                <SelectItem value="clearbit">Clearbit</SelectItem>
                <SelectItem value="pdl">PDL</SelectItem>
                <SelectItem value="zoominfo">ZoomInfo</SelectItem>
                <SelectItem value="apollo">Apollo</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* History List */}
          <div className="space-y-2">
            {filteredHistory && filteredHistory.length > 0 ? (
              filteredHistory.map((record: any) => (
                <div
                  key={record.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedHistory(record)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">
                          {record.accounts?.name || record.account_external_id}
                        </span>
                        {getStatusBadge(record.status)}
                        <Badge variant="secondary" className="text-xs capitalize">
                          {record.provider}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {record.fields_enriched && record.fields_enriched.length > 0 ? (
                          <span>{record.fields_enriched.length} fields enriched</span>
                        ) : (
                          <span>No fields enriched</span>
                        )}
                        {' • '}
                        <span>{new Date(record.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {record.status === 'failed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRetryEnrichment(record);
                          }}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No enrichment history found</p>
                <p className="text-xs">Start enriching accounts to see history</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedHistory} onOpenChange={() => setSelectedHistory(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Enrichment Details
              {selectedHistory && getStatusBadge(selectedHistory.status)}
            </DialogTitle>
            <DialogDescription>
              {selectedHistory?.accounts?.name || selectedHistory?.account_external_id}
            </DialogDescription>
          </DialogHeader>

          {selectedHistory && (
            <div className="space-y-4">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">Provider</div>
                  <div className="font-medium capitalize">{selectedHistory.provider}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Type</div>
                  <div className="font-medium capitalize">{selectedHistory.enrichment_type}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Credits Used</div>
                  <div className="font-medium">{selectedHistory.credits_used || 0}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Response Time</div>
                  <div className="font-medium">{selectedHistory.response_time_ms}ms</div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm text-muted-foreground">Date</div>
                  <div className="font-medium">{new Date(selectedHistory.created_at).toLocaleString()}</div>
                </div>
              </div>

              {/* Before/After Comparison */}
              {selectedHistory.data_before && selectedHistory.data_after && (
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Before → After Comparison
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">Before</div>
                      <div className="p-3 border rounded-lg bg-muted/20 space-y-2 text-sm">
                        {Object.entries(selectedHistory.data_before).map(([key, value]) => (
                          <div key={key}>
                            <span className="text-muted-foreground capitalize">{key.replace('_', ' ')}: </span>
                            <span>{value as string || '—'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">After</div>
                      <div className="p-3 border rounded-lg bg-success/10 space-y-2 text-sm">
                        {Object.entries(selectedHistory.data_after).map(([key, value]) => (
                          <div key={key}>
                            <span className="text-muted-foreground capitalize">{key.replace('_', ' ')}: </span>
                            <span className="font-medium">{value as string || '—'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Details */}
              {selectedHistory.error_message && (
                <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <h4 className="font-semibold text-destructive flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4" />
                    Error Details
                  </h4>
                  <p className="text-sm">{selectedHistory.error_message}</p>
                  {selectedHistory.error_code && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Code: {selectedHistory.error_code}
                    </p>
                  )}
                </div>
              )}

              {/* Retry Button */}
              {selectedHistory.status === 'failed' && (
                <Button 
                  className="w-full" 
                  onClick={() => {
                    handleRetryEnrichment(selectedHistory);
                    setSelectedHistory(null);
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Enrichment
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
