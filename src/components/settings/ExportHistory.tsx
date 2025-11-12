import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { formatNumber } from "@/utils/format-numbers";
import { Skeleton } from "@/components/ui/skeleton";

interface ExportRecord {
  id: string;
  batch_id: string;
  export_type: string;
  filter_params: any;
  export_count: number;
  eligible_count: number | null;
  skipped_count: number | null;
  skip_reasons: any;
  campaign_name: string | null;
  exported_by: string | null;
  exported_at: string;
}

export function ExportHistory() {
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const loadExports = async () => {
    if (!userProfile?.org_id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('lp_exports' as any)
        .select('*')
        .eq('org_id', userProfile.org_id)
        .order('exported_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setExports((data || []) as unknown as ExportRecord[]);
    } catch (error) {
      console.error('Error loading export history:', error);
      toast({
        title: "Error",
        description: "Failed to load export history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExports();
  }, [userProfile?.org_id]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getExportTypeBadge = (type: string) => {
    if (type === 'csv') return <Badge variant="outline">CSV</Badge>;
    if (type === 'crm_campaign') return <Badge variant="default">CRM Campaign</Badge>;
    return <Badge variant="secondary">{type}</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Export History</CardTitle>
          <CardDescription>View all campaign exports and batch operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Export History</CardTitle>
            <CardDescription>View all campaign exports and batch operations</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadExports}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {exports.length === 0 ? (
          <div className="text-center py-12">
            <Download className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-semibold mb-2">No Exports Yet</h3>
            <p className="text-sm text-muted-foreground">
              Your campaign exports will appear here once you start exporting leads
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Exported</TableHead>
                  <TableHead>Eligible</TableHead>
                  <TableHead>Skipped</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exports.map((exportRecord) => (
                  <TableRow key={exportRecord.id}>
                    <TableCell className="font-mono text-xs">
                      {exportRecord.batch_id}
                    </TableCell>
                    <TableCell>{getExportTypeBadge(exportRecord.export_type)}</TableCell>
                    <TableCell className="font-semibold">
                      {formatNumber(exportRecord.export_count)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {exportRecord.eligible_count !== null ? formatNumber(exportRecord.eligible_count) : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {exportRecord.skipped_count !== null ? formatNumber(exportRecord.skipped_count) : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(exportRecord.exported_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            toast({
                              title: "Re-export Coming Soon",
                              description: "CSV re-export feature will be available shortly",
                            });
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Navigate to leads with this batch_id filter
                            window.location.href = `/leads?batch_id=${exportRecord.batch_id}`;
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {exports.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {exports.length} most recent exports
          </div>
        )}
      </CardContent>
    </Card>
  );
}
