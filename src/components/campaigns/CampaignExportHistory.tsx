import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { History, Download, Users, Calendar, Eye } from "lucide-react";
import { formatNumber } from "@/utils/format-numbers";

interface CampaignSnapshot {
  id: string;
  icp_name: string;
  exported_at: string;
  total_accounts: number;
  total_contacts: number;
  export_type: string;
  sync_destination: string | null;
  sync_status: string | null;
  exported_emails: any;
}

export function CampaignExportHistory() {
  const { userProfile } = useAuth();
  const [snapshots, setSnapshots] = useState<CampaignSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSnapshot, setSelectedSnapshot] = useState<CampaignSnapshot | null>(null);

  useEffect(() => {
    if (userProfile?.org_id) {
      loadSnapshots();
    }
  }, [userProfile?.org_id]);

  const loadSnapshots = async () => {
    if (!userProfile?.org_id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaign_snapshots')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .order('exported_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSnapshots(data || []);
    } catch (error) {
      console.error('[Export History] Error loading snapshots:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadEmailList = (snapshot: CampaignSnapshot) => {
    if (!snapshot.exported_emails || !Array.isArray(snapshot.exported_emails) || snapshot.exported_emails.length === 0) {
      return;
    }

    const csv = ['Email'].concat(snapshot.exported_emails).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${snapshot.icp_name.replace(/[^a-z0-9]/gi, '_')}_emails.csv`;
    a.click();
  };

  const getSyncStatusBadge = (status: string | null) => {
    if (!status) return null;
    
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      in_progress: "secondary",
      failed: "destructive",
      pending: "outline"
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Campaign Export History
          </CardTitle>
          <CardDescription>
            View past campaign exports and email lists (90-day retention)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading export history...</div>
          ) : snapshots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No campaign exports yet
            </div>
          ) : (
            <Table>
              <TableHeader>
              <TableRow>
                <TableHead>ICP Name</TableHead>
                <TableHead>Exported</TableHead>
                <TableHead>Accounts</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((snapshot) => (
                  <TableRow key={snapshot.id}>
                    <TableCell className="font-medium">
                      <Badge variant="outline">{snapshot.icp_name}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(snapshot.exported_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>{formatNumber(snapshot.total_accounts)}</TableCell>
                    <TableCell>{formatNumber(snapshot.total_contacts)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {snapshot.sync_destination || snapshot.export_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{getSyncStatusBadge(snapshot.sync_status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSnapshot(snapshot)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {snapshot.exported_emails && Array.isArray(snapshot.exported_emails) && snapshot.exported_emails.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadEmailList(snapshot)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Email List Dialog */}
      <Dialog open={!!selectedSnapshot} onOpenChange={() => setSelectedSnapshot(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Export Details: {selectedSnapshot?.icp_name}</DialogTitle>
          </DialogHeader>
          {selectedSnapshot && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">ICP</div>
                  <div className="font-medium">{selectedSnapshot.icp_name}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Exported</div>
                  <div className="font-medium">
                    {new Date(selectedSnapshot.exported_at).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Accounts</div>
                  <div className="font-medium">{formatNumber(selectedSnapshot.total_accounts)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Contacts</div>
                  <div className="font-medium">{formatNumber(selectedSnapshot.total_contacts)}</div>
                </div>
              </div>

              {selectedSnapshot.exported_emails && Array.isArray(selectedSnapshot.exported_emails) && selectedSnapshot.exported_emails.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">
                      Email List ({selectedSnapshot.exported_emails.length} contacts)
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadEmailList(selectedSnapshot)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download CSV
                    </Button>
                  </div>
                  <div className="max-h-64 overflow-y-auto border rounded-lg p-4 bg-muted/30">
                    <div className="space-y-1 font-mono text-sm">
                      {selectedSnapshot.exported_emails.map((email: string, idx: number) => (
                        <div key={idx} className="text-muted-foreground">{email}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
